import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Typography,
  Modal,
  Input,
  Form,
  message,
  Tooltip,
} from 'antd';
import {
  ReadOutlined,
  PlusOutlined,
  SyncOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  TagOutlined,
} from '@ant-design/icons';
import { itsmKbAPI } from '../../services/api';
import type { ITSMKbArticle } from '../../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<ITSMKbArticle['status'], string> = {
  draft: 'default',
  published: 'green',
  archived: 'orange',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const KnowledgeBase: React.FC = () => {
  // --- state ---
  const [articles, setArticles] = useState<ITSMKbArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  // filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  // categories
  const [categories, setCategories] = useState<string[]>([]);

  // view modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<ITSMKbArticle | null>(null);

  // create / edit modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ITSMKbArticle | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const [form] = Form.useForm();

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadArticles = useCallback(
    async (page = pagination.current, pageSize = pagination.pageSize) => {
      setLoading(true);
      try {
        const result = await itsmKbAPI.getAll({
          page,
          limit: pageSize,
          search: search || undefined,
          category: filterCategory,
          status: filterStatus,
        });
        setArticles(result.data);
        setPagination((prev) => ({
          ...prev,
          current: result.page,
          pageSize: result.limit,
          total: result.total,
        }));
      } catch {
        message.error('Failed to load KB articles');
      } finally {
        setLoading(false);
      }
    },
    [search, filterCategory, filterStatus, pagination.current, pagination.pageSize],
  );

  const loadCategories = useCallback(async () => {
    try {
      const cats = await itsmKbAPI.getCategories();
      setCategories(cats);
    } catch {
      // non-critical — just leave the list empty
    }
  }, []);

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadArticles(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterCategory, filterStatus]);

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------

  const totalArticles = pagination.total;
  const publishedCount = articles.filter((a) => a.status === 'published').length;
  const draftCount = articles.filter((a) => a.status === 'draft').length;
  const totalViews = articles.reduce((sum, a) => sum + (a.viewCount ?? 0), 0);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    loadArticles(pagination.current, pagination.pageSize);
  };

  const handleTableChange = (pag: { current?: number; pageSize?: number }) => {
    const page = pag.current ?? 1;
    const pageSize = pag.pageSize ?? pagination.pageSize;
    setPagination((prev) => ({ ...prev, current: page, pageSize }));
    loadArticles(page, pageSize);
  };

  const openViewModal = async (article: ITSMKbArticle) => {
    // Fetch fresh copy (increments view count server-side)
    try {
      const fresh = await itsmKbAPI.getById(article.id);
      setSelectedArticle(fresh);
    } catch {
      setSelectedArticle(article);
    }
    setViewModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingArticle(null);
    form.resetFields();
    setFormModalOpen(true);
  };

  const openEditModal = (article: ITSMKbArticle) => {
    setEditingArticle(article);
    form.setFieldsValue({
      title: article.title,
      content: article.content,
      category: article.category ?? '',
      tags: article.tags ?? [],
      status: article.status,
    });
    setFormModalOpen(true);
  };

  const handleFormSave = async () => {
    try {
      const values = await form.validateFields();
      setFormSaving(true);

      const payload: Partial<ITSMKbArticle> = {
        title: values.title,
        content: values.content,
        category: values.category || undefined,
        tags: values.tags ?? [],
      };

      if (editingArticle) {
        // status can only be changed in edit mode
        payload.status = values.status;
        await itsmKbAPI.update(editingArticle.id, payload);
        message.success('Article updated');
      } else {
        await itsmKbAPI.create(payload);
        message.success('Article created');
      }

      setFormModalOpen(false);
      loadArticles(1, pagination.pageSize);
      loadCategories();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        // Ant Design validation error — do nothing, form shows inline errors
        return;
      }
      message.error('Failed to save article');
    } finally {
      setFormSaving(false);
    }
  };

  const handleStatusChange = async (
    article: ITSMKbArticle,
    newStatus: ITSMKbArticle['status'],
    closeViewModal = false,
  ) => {
    try {
      await itsmKbAPI.update(article.id, { status: newStatus });
      message.success(`Article ${newStatus === 'published' ? 'published' : newStatus === 'archived' ? 'archived' : 'reverted to draft'}`);
      if (closeViewModal) {
        setViewModalOpen(false);
      }
      // Update selected article if view modal is open
      if (selectedArticle?.id === article.id) {
        setSelectedArticle((prev) => (prev ? { ...prev, status: newStatus } : prev));
      }
      loadArticles(pagination.current, pagination.pageSize);
    } catch {
      message.error('Failed to update article status');
    }
  };

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, record: ITSMKbArticle) => (
        <Button
          type="link"
          style={{ padding: 0, height: 'auto', textAlign: 'left', whiteSpace: 'normal' }}
          onClick={() => openViewModal(record)}
        >
          {title}
        </Button>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (cat: string | undefined) =>
        cat ? <Tag color="blue">{cat}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: ITSMKbArticle['status']) => (
        <Tag color={STATUS_COLOR[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Tag>
      ),
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number) => <Text type="secondary">v{v}</Text>,
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags: string[] | undefined) =>
        tags && tags.length > 0 ? (
          <Space size={4} wrap>
            {tags.map((t) => (
              <Tag key={t} icon={<TagOutlined />} style={{ fontSize: 11 }}>
                {t}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Views',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 80,
      render: (count: number) => (
        <Space size={4}>
          <EyeOutlined style={{ color: '#8c8c8c' }} />
          <Text>{count ?? 0}</Text>
        </Space>
      ),
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 130,
      render: (date: string) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          <Text type="secondary">{formatTimeAgo(date)}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 210,
      render: (_: unknown, record: ITSMKbArticle) => (
        <Space size={4}>
          <Tooltip title="View article">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openViewModal(record)}
            />
          </Tooltip>
          <Tooltip title="Edit article">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          {record.status === 'draft' && (
            <Tooltip title="Publish">
              <Button
                size="small"
                type="primary"
                onClick={() => handleStatusChange(record, 'published')}
              >
                Publish
              </Button>
            </Tooltip>
          )}
          {record.status === 'published' && (
            <>
              <Tooltip title="Archive">
                <Button
                  size="small"
                  danger
                  onClick={() => handleStatusChange(record, 'archived')}
                >
                  Archive
                </Button>
              </Tooltip>
              <Tooltip title="Revert to draft">
                <Button
                  size="small"
                  onClick={() => handleStatusChange(record, 'draft')}
                >
                  Draft
                </Button>
              </Tooltip>
            </>
          )}
          {record.status === 'archived' && (
            <Tooltip title="Revert to draft">
              <Button
                size="small"
                onClick={() => handleStatusChange(record, 'draft')}
              >
                Revert
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ padding: 24 }}>
      {/* Page header */}
      <Space style={{ marginBottom: 24 }}>
        <ReadOutlined style={{ fontSize: 24, color: '#1890ff' }} />
        <Title level={3} style={{ margin: 0 }}>
          Knowledge Base
        </Title>
      </Space>

      {/* Stats cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Articles"
              value={totalArticles}
              prefix={<ReadOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Published"
              value={publishedCount}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Draft"
              value={draftCount}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Views"
              value={totalViews}
              prefix={<EyeOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Search + Filter bar */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          {/* Prominent search bar */}
          <Col xs={24} md={10}>
            <Input.Search
              placeholder="Search knowledge base..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={(val) => {
                setSearch(val);
              }}
            />
          </Col>

          {/* Category filter */}
          <Col xs={24} sm={8} md={5}>
            <Select
              allowClear
              placeholder="Category"
              style={{ width: '100%' }}
              value={filterCategory}
              onChange={(val) => setFilterCategory(val)}
              options={categories.map((c) => ({ label: c, value: c }))}
            />
          </Col>

          {/* Status filter */}
          <Col xs={24} sm={8} md={4}>
            <Select
              allowClear
              placeholder="Status"
              style={{ width: '100%' }}
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { label: 'Draft', value: 'draft' },
                { label: 'Published', value: 'published' },
                { label: 'Archived', value: 'archived' },
              ]}
            />
          </Col>

          {/* Action buttons */}
          <Col xs={24} sm={8} md={5}>
            <Space>
              <Button icon={<SyncOutlined />} onClick={handleRefresh} loading={loading}>
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
              >
                New Article
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Articles table */}
      <Card>
        <Table<ITSMKbArticle>
          rowKey="id"
          columns={columns}
          dataSource={articles}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `${total} articles`,
          }}
          onChange={(pag) => handleTableChange(pag)}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* View Modal                                                          */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        width={800}
        title={null}
        footer={
          selectedArticle ? (
            <Space>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setViewModalOpen(false);
                  openEditModal(selectedArticle);
                }}
              >
                Edit
              </Button>
              {selectedArticle.status === 'draft' && (
                <Button
                  type="primary"
                  onClick={() => handleStatusChange(selectedArticle, 'published', true)}
                >
                  Publish
                </Button>
              )}
              {selectedArticle.status === 'published' && (
                <>
                  <Button
                    danger
                    onClick={() => handleStatusChange(selectedArticle, 'archived', true)}
                  >
                    Archive
                  </Button>
                  <Button
                    onClick={() => handleStatusChange(selectedArticle, 'draft', true)}
                  >
                    Revert to Draft
                  </Button>
                </>
              )}
              {selectedArticle.status === 'archived' && (
                <Button
                  onClick={() => handleStatusChange(selectedArticle, 'draft', true)}
                >
                  Revert to Draft
                </Button>
              )}
            </Space>
          ) : null
        }
      >
        {selectedArticle && (
          <div>
            <Title level={4} style={{ marginTop: 0, marginBottom: 12 }}>
              {selectedArticle.title}
            </Title>

            {/* Meta info */}
            <Space size={8} wrap style={{ marginBottom: 16 }}>
              {selectedArticle.category && (
                <Tag color="blue">{selectedArticle.category}</Tag>
              )}
              <Tag>v{selectedArticle.version}</Tag>
              <Tag color={STATUS_COLOR[selectedArticle.status]}>
                {selectedArticle.status.charAt(0).toUpperCase() + selectedArticle.status.slice(1)}
              </Tag>
              <Space size={4}>
                <EyeOutlined style={{ color: '#8c8c8c' }} />
                <Text type="secondary">{selectedArticle.viewCount ?? 0} views</Text>
              </Space>
              {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                <Space size={4} wrap>
                  {selectedArticle.tags.map((t) => (
                    <Tag key={t} icon={<TagOutlined />} style={{ fontSize: 11 }}>
                      {t}
                    </Tag>
                  ))}
                </Space>
              )}
            </Space>

            {/* Content */}
            <Card
              style={{
                background: '#fafafa',
                borderRadius: 6,
                maxHeight: 460,
                overflowY: 'auto',
              }}
              bodyStyle={{ padding: 16 }}
            >
              <Text style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', display: 'block' }}>
                {selectedArticle.content}
              </Text>
            </Card>

            <Text type="secondary" style={{ marginTop: 8, display: 'block', fontSize: 12 }}>
              Last updated {formatTimeAgo(selectedArticle.updatedAt)}
            </Text>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Create / Edit Modal                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={formModalOpen}
        onCancel={() => setFormModalOpen(false)}
        title={editingArticle ? 'Edit Article' : 'New Article'}
        width={700}
        onOk={handleFormSave}
        okText={editingArticle ? 'Save Changes' : 'Create'}
        confirmLoading={formSaving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input placeholder="Article title" />
          </Form.Item>

          <Form.Item
            name="content"
            label="Content"
            rules={[{ required: true, message: 'Content is required' }]}
          >
            <TextArea
              rows={10}
              placeholder="Write article content here..."
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category">
                <Input placeholder="e.g. Network, Security, Database" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tags" label="Tags">
                <Select
                  mode="tags"
                  placeholder="Add tags (press Enter)"
                  style={{ width: '100%' }}
                  tokenSeparators={[',']}
                  options={[]}
                />
              </Form.Item>
            </Col>
          </Row>

          {editingArticle && (
            <Form.Item name="status" label="Status">
              <Select
                options={[
                  { label: 'Draft', value: 'draft' },
                  { label: 'Published', value: 'published' },
                  { label: 'Archived', value: 'archived' },
                ]}
              />
            </Form.Item>
          )}

          {editingArticle && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Note: Saving content changes will auto-increment the version number on the server.
            </Text>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default KnowledgeBase;
