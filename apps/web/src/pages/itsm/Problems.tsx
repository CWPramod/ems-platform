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
  Descriptions,
  Tabs,
  message,
  Tooltip,
} from 'antd';
import {
  BugOutlined,
  SearchOutlined,
  PlusOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { itsmProblemsAPI } from '../../services/api';
import type { ITSMProblem, ITSMTicket } from '../../types';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ============================================================================
// Utility
// ============================================================================

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears}y ago`;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_TAG_COLORS: Record<string, string> = {
  open: 'red',
  investigating: 'blue',
  known_error: 'orange',
  resolved: 'green',
  closed: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  investigating: 'Investigating',
  known_error: 'Known Error',
  resolved: 'Resolved',
  closed: 'Closed',
};

// ============================================================================
// Types
// ============================================================================

interface ProblemFormValues {
  title: string;
  description?: string;
  rootCause?: string;
  workaround?: string;
}

// ============================================================================
// Component
// ============================================================================

const Problems = () => {
  // State
  const [problems, setProblems] = useState<ITSMProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Pagination
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  // Filters
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProblem, setEditingProblem] = useState<ITSMProblem | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Detail modal state
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<ITSMProblem | null>(null);

  // Linked incidents state
  const [linkedIncidents, setLinkedIncidents] = useState<ITSMTicket[]>([]);
  const [linkedIncidentsLoading, setLinkedIncidentsLoading] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkTicketId, setLinkTicketId] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  // Known errors state
  const [knownErrors, setKnownErrors] = useState<ITSMProblem[]>([]);
  const [knownErrorsLoading, setKnownErrorsLoading] = useState(false);

  // Main page tab
  const [activeMainTab, setActiveMainTab] = useState('all');

  const [form] = Form.useForm<ProblemFormValues>();

  // ============================================================================
  // Data loading
  // ============================================================================

  const loadProblems = useCallback(async (page = 1, pageSize = 20) => {
    try {
      setLoading(true);
      const response = await itsmProblemsAPI.getAll({
        page,
        limit: pageSize,
        status: filterStatus || undefined,
        search: search || undefined,
      });
      setProblems(response.data || []);
      setPagination((prev) => ({
        ...prev,
        current: page,
        pageSize,
        total: response.total || 0,
      }));
    } catch (error) {
      console.error('Failed to load problems:', error);
      message.error('Failed to load problems');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  const loadKnownErrors = useCallback(async () => {
    try {
      setKnownErrorsLoading(true);
      const response = await itsmProblemsAPI.getKnownErrors({ page: 1, limit: 100 });
      setKnownErrors(response.data || []);
    } catch {
      message.error('Failed to load known errors');
    } finally {
      setKnownErrorsLoading(false);
    }
  }, []);

  const loadLinkedIncidents = useCallback(async (problemId: string) => {
    try {
      setLinkedIncidentsLoading(true);
      const data = await itsmProblemsAPI.getLinkedIncidents(problemId);
      setLinkedIncidents(Array.isArray(data) ? data : []);
    } catch {
      message.error('Failed to load linked incidents');
    } finally {
      setLinkedIncidentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProblems(1, pagination.pageSize);
  }, [loadProblems]);

  // ============================================================================
  // Stats
  // ============================================================================

  const totalProblems = pagination.total;
  const openCount = problems.filter((p) => p.status === 'open').length;
  const investigatingCount = problems.filter((p) => p.status === 'investigating').length;
  const knownErrorCount = problems.filter((p) => p.status === 'known_error').length;

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleRefresh = () => {
    loadProblems(pagination.current, pagination.pageSize);
  };

  const handleSearchCommit = () => {
    setSearch(searchInput);
  };

  const handleStatusTransition = async (problemId: string, newStatus: string) => {
    try {
      setActionLoading(problemId);
      await itsmProblemsAPI.updateStatus(problemId, { status: newStatus });
      message.success(`Problem moved to ${STATUS_LABELS[newStatus] || newStatus}`);
      await loadProblems(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('Failed to update problem status:', error);
      message.error('Failed to update problem status');
    } finally {
      setActionLoading(null);
    }
  };

  const openCreateModal = () => {
    setEditingProblem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const openEditModal = (problem: ITSMProblem) => {
    setEditingProblem(problem);
    form.setFieldsValue({
      title: problem.title,
      description: problem.description || '',
      rootCause: problem.rootCause || '',
      workaround: problem.workaround || '',
    });
    setModalVisible(true);
  };

  const handleModalSave = async () => {
    let values: ProblemFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    try {
      setModalLoading(true);
      if (editingProblem) {
        await itsmProblemsAPI.update(editingProblem.id, {
          title: values.title,
          description: values.description,
          rootCause: values.rootCause,
          workaround: values.workaround,
        });
        message.success('Problem updated');
      } else {
        await itsmProblemsAPI.create({
          title: values.title,
          description: values.description,
          rootCause: values.rootCause,
          workaround: values.workaround,
        });
        message.success('Problem created');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingProblem(null);
      await loadProblems(editingProblem ? pagination.current : 1, pagination.pageSize);
    } catch (error) {
      console.error('Failed to save problem:', error);
      message.error('Failed to save problem');
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    form.resetFields();
    setEditingProblem(null);
  };

  const showDetailModal = (problem: ITSMProblem) => {
    setSelectedProblem(problem);
    setLinkedIncidents([]);
    setDetailVisible(true);
  };

  const handleLinkIncident = async () => {
    if (!selectedProblem || !linkTicketId.trim()) {
      message.error('Ticket ID is required');
      return;
    }
    try {
      setLinkLoading(true);
      await itsmProblemsAPI.linkIncident(selectedProblem.id, { ticketId: linkTicketId.trim() });
      message.success('Incident linked');
      setLinkModalVisible(false);
      setLinkTicketId('');
      await loadLinkedIncidents(selectedProblem.id);
    } catch {
      message.error('Failed to link incident');
    } finally {
      setLinkLoading(false);
    }
  };

  // ============================================================================
  // Table columns
  // ============================================================================

  const columns: ColumnsType<ITSMProblem> = [
    {
      title: 'Title',
      key: 'title',
      ellipsis: true,
      render: (_, record) => (
        <a
          onClick={() => showDetailModal(record)}
          style={{ fontWeight: 500 }}
        >
          {record.title}
        </a>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string) => (
        <Tag color={STATUS_TAG_COLORS[status] || 'default'}>
          {STATUS_LABELS[status] || status}
        </Tag>
      ),
    },
    {
      title: 'Root Cause',
      dataIndex: 'rootCause',
      key: 'rootCause',
      ellipsis: true,
      render: (rootCause: string | undefined) => {
        if (!rootCause) return <Text type="secondary">—</Text>;
        const truncated = rootCause.length > 60 ? `${rootCause.slice(0, 60)}…` : rootCause;
        return (
          <Tooltip title={rootCause}>
            <Text>{truncated}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Workaround',
      dataIndex: 'workaround',
      key: 'workaround',
      width: 130,
      render: (workaround: string | undefined) => {
        if (workaround && workaround.trim().length > 0) {
          return (
            <Tooltip title={workaround}>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
            </Tooltip>
          );
        }
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (createdAt: string) => (
        <Tooltip title={new Date(createdAt).toLocaleString()}>
          <Text type="secondary">{formatTimeAgo(createdAt)}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 260,
      render: (_, record) => {
        const isActing = actionLoading === record.id;
        const buttons: React.ReactNode[] = [];

        if (record.status === 'open') {
          buttons.push(
            <Button key="investigate" size="small" type="primary" loading={isActing}
              onClick={() => handleStatusTransition(record.id, 'investigating')}>
              Investigate
            </Button>,
          );
        }

        if (record.status === 'investigating') {
          buttons.push(
            <Button key="known_error" size="small" loading={isActing}
              onClick={() => handleStatusTransition(record.id, 'known_error')}>
              Mark Known Error
            </Button>,
            <Button key="resolve" size="small" type="primary" ghost loading={isActing}
              onClick={() => handleStatusTransition(record.id, 'resolved')}>
              Resolve
            </Button>,
          );
        }

        if (record.status === 'known_error') {
          buttons.push(
            <Button key="resolve" size="small" type="primary" ghost loading={isActing}
              onClick={() => handleStatusTransition(record.id, 'resolved')}>
              Resolve
            </Button>,
          );
        }

        if (record.status === 'resolved') {
          buttons.push(
            <Button key="close" size="small" loading={isActing}
              onClick={() => handleStatusTransition(record.id, 'closed')}>
              Close
            </Button>,
          );
        }

        buttons.push(
          <Button key="edit" size="small" onClick={() => openEditModal(record)}>
            Edit
          </Button>,
        );

        return <Space size={4}>{buttons}</Space>;
      },
    },
  ];

  // Linked incidents table columns
  const linkedIncidentColumns: ColumnsType<ITSMTicket> = [
    {
      title: 'Ticket #',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      width: 160,
      render: (val: string) => <Text code style={{ fontSize: 12 }}>{val}</Text>,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (val: string) => <Tag color={val === 'critical' ? 'red' : val === 'high' ? 'orange' : val === 'medium' ? 'gold' : 'blue'}>{val}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: string) => <Tag color={val === 'open' ? 'red' : val === 'in_progress' ? 'blue' : val === 'resolved' ? 'green' : 'default'}>{val?.replace('_', ' ')}</Tag>,
    },
  ];

  // ============================================================================
  // Expandable row render
  // ============================================================================

  const expandedRowRender = (record: ITSMProblem) => (
    <Descriptions bordered size="small" column={1}
      style={{ background: 'rgba(255,255,255,0.03)' }}>
      <Descriptions.Item label="Description">
        {record.description ? <Text>{record.description}</Text> : <Text type="secondary">No description provided.</Text>}
      </Descriptions.Item>
      <Descriptions.Item label="Root Cause">
        {record.rootCause ? <Text>{record.rootCause}</Text> : <Text type="secondary">Root cause not yet identified.</Text>}
      </Descriptions.Item>
      <Descriptions.Item label="Workaround">
        {record.workaround ? <Text>{record.workaround}</Text> : <Text type="secondary">No workaround available.</Text>}
      </Descriptions.Item>
    </Descriptions>
  );

  // ============================================================================
  // Known Errors Table
  // ============================================================================

  const knownErrorColumns: ColumnsType<ITSMProblem> = [
    {
      title: 'Title',
      key: 'title',
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => showDetailModal(record)} style={{ fontWeight: 500 }}>{record.title}</a>
      ),
    },
    {
      title: 'Root Cause',
      dataIndex: 'rootCause',
      key: 'rootCause',
      ellipsis: true,
      render: (val: string | undefined) => val || <Text type="secondary">—</Text>,
    },
    {
      title: 'Workaround',
      dataIndex: 'workaround',
      key: 'workaround',
      ellipsis: true,
      render: (val: string | undefined) => {
        if (!val) return <Text type="secondary">—</Text>;
        return (
          <div style={{ background: 'rgba(82, 196, 26, 0.08)', padding: '4px 8px', borderRadius: 4, borderLeft: '3px solid #52c41a' }}>
            <Text style={{ fontSize: 12 }}>{val}</Text>
          </div>
        );
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (val: string) => <Text type="secondary">{formatTimeAgo(val)}</Text>,
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  const renderProblemsTable = () => (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Select placeholder="Filter by status" allowClear style={{ width: 180 }}
            value={filterStatus} onChange={(val) => setFilterStatus(val)}>
            <Option value="open">Open</Option>
            <Option value="investigating">Investigating</Option>
            <Option value="known_error">Known Error</Option>
            <Option value="resolved">Resolved</Option>
            <Option value="closed">Closed</Option>
          </Select>
        </Col>
        <Col flex="auto">
          <Input placeholder="Search problems..." prefix={<SearchOutlined />} allowClear
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={handleSearchCommit}
            onClear={() => { setSearchInput(''); setSearch(''); }}
            style={{ maxWidth: 320 }} />
        </Col>
        <Col>
          <Space>
            <Button icon={<SearchOutlined />} onClick={handleSearchCommit}>Search</Button>
            <Button icon={<SyncOutlined />} onClick={handleRefresh} loading={loading}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>New Problem</Button>
          </Space>
        </Col>
      </Row>
      <Table<ITSMProblem>
        columns={columns} dataSource={problems} rowKey="id" loading={loading}
        expandable={{ expandedRowRender }}
        pagination={{
          current: pagination.current, pageSize: pagination.pageSize, total: pagination.total,
          showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} problems`,
          onChange: (page, pageSize) => { loadProblems(page, pageSize); },
        }}
        size="middle"
      />
    </>
  );

  return (
    <div style={{ padding: '24px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="center">
          <BugOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={3} style={{ margin: 0 }}>Problem Management</Title>
        </Space>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary">Track recurring issues, root cause investigations, and known errors.</Text>
        </div>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Total Problems" value={totalProblems} prefix={<BugOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Open" value={openCount} valueStyle={{ color: '#ff4d4f' }} prefix={<ExclamationCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Investigating" value={investigatingCount} valueStyle={{ color: '#1890ff' }} prefix={<SyncOutlined spin={investigatingCount > 0} />} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Known Errors" value={knownErrorCount} valueStyle={{ color: '#fa8c16' }} prefix={<ExclamationCircleOutlined />} /></Card>
        </Col>
      </Row>

      {/* Main Card with Tabs */}
      <Card>
        <Tabs
          activeKey={activeMainTab}
          onChange={(key) => {
            setActiveMainTab(key);
            if (key === 'known_errors') loadKnownErrors();
          }}
          items={[
            {
              key: 'all',
              label: <span><BugOutlined /> All Problems</span>,
              children: renderProblemsTable(),
            },
            {
              key: 'known_errors',
              label: (
                <span>
                  <WarningOutlined style={{ color: '#fa8c16' }} /> Known Errors
                  {knownErrorCount > 0 && (
                    <Tag color="orange" style={{ marginLeft: 6, fontSize: 11 }}>{knownErrorCount}</Tag>
                  )}
                </span>
              ),
              children: (
                <Table<ITSMProblem>
                  columns={knownErrorColumns}
                  dataSource={knownErrors}
                  rowKey="id"
                  loading={knownErrorsLoading}
                  size="middle"
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  locale={{ emptyText: 'No known errors found.' }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={editingProblem ? 'Edit Problem' : 'New Problem'}
        open={modalVisible} onOk={handleModalSave} onCancel={handleModalCancel}
        confirmLoading={modalLoading}
        okText={editingProblem ? 'Save Changes' : 'Create Problem'}
        width={600} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Title" name="title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input placeholder="Short description of the problem" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <TextArea rows={3} placeholder="Detailed description of the problem" />
          </Form.Item>
          <Form.Item label="Root Cause" name="rootCause">
            <TextArea rows={3} placeholder="Identified or suspected root cause" />
          </Form.Item>
          <Form.Item label="Workaround" name="workaround">
            <TextArea rows={3} placeholder="Temporary workaround for affected users" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal with Tabs */}
      <Modal
        title={<Space><BugOutlined /><span>{selectedProblem?.title}</span></Space>}
        open={detailVisible}
        onCancel={() => { setDetailVisible(false); setSelectedProblem(null); setLinkedIncidents([]); }}
        footer={[
          <Button key="edit" onClick={() => { setDetailVisible(false); if (selectedProblem) openEditModal(selectedProblem); }}>Edit</Button>,
          <Button key="close" type="primary" onClick={() => { setDetailVisible(false); setSelectedProblem(null); }}>Close</Button>,
        ]}
        width={750} destroyOnClose>
        {selectedProblem && (
          <Tabs
            defaultActiveKey="details"
            onChange={(key) => {
              if (key === 'linked' && selectedProblem) loadLinkedIncidents(selectedProblem.id);
            }}
            items={[
              {
                key: 'details',
                label: 'Details',
                children: (
                  <Descriptions bordered column={1} size="small" style={{ marginTop: 8 }}>
                    <Descriptions.Item label="Status">
                      <Tag color={STATUS_TAG_COLORS[selectedProblem.status] || 'default'}>
                        {STATUS_LABELS[selectedProblem.status] || selectedProblem.status}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Description">
                      {selectedProblem.description || <Text type="secondary">No description provided.</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Root Cause">
                      {selectedProblem.rootCause || <Text type="secondary">Root cause not yet identified.</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Workaround">
                      {selectedProblem.workaround ? (
                        <div style={{ background: 'rgba(82, 196, 26, 0.08)', padding: '8px 12px', borderRadius: 4, borderLeft: '3px solid #52c41a' }}>
                          {selectedProblem.workaround}
                        </div>
                      ) : (
                        <Text type="secondary">No workaround available.</Text>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Created">
                      {new Date(selectedProblem.createdAt).toLocaleString()} ({formatTimeAgo(selectedProblem.createdAt)})
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Updated">
                      {new Date(selectedProblem.updatedAt).toLocaleString()} ({formatTimeAgo(selectedProblem.updatedAt)})
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'linked',
                label: <span><LinkOutlined /> Linked Incidents</span>,
                children: (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text strong>Linked Incidents ({linkedIncidents.length})</Text>
                      <Button size="small" icon={<PlusOutlined />} onClick={() => { setLinkTicketId(''); setLinkModalVisible(true); }}>
                        Link Incident
                      </Button>
                    </div>
                    <Table<ITSMTicket>
                      dataSource={linkedIncidents}
                      columns={linkedIncidentColumns}
                      rowKey="id"
                      loading={linkedIncidentsLoading}
                      size="small"
                      pagination={false}
                      locale={{ emptyText: 'No linked incidents. Click "Link Incident" to add one.' }}
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>

      {/* Link Incident Modal */}
      <Modal
        title="Link Incident to Problem"
        open={linkModalVisible}
        onOk={handleLinkIncident}
        onCancel={() => { setLinkModalVisible(false); setLinkTicketId(''); }}
        confirmLoading={linkLoading}
        okText="Link">
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">Enter the ticket ID (UUID) of the incident to link to this problem.</Text>
        </div>
        <Input value={linkTicketId} onChange={(e) => setLinkTicketId(e.target.value)} placeholder="Ticket UUID..." />
      </Modal>
    </div>
  );
};

export default Problems;
