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
  DatePicker,
  Tabs,
  Calendar,
  Badge,
  Tooltip,
  message,
  Descriptions,
} from 'antd';
import {
  SwapOutlined,
  PlusOutlined,
  SyncOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { itsmChangesAPI } from '../../services/api';
import type { ITSMChange } from '../../types';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
const formatTimeAgo = (dateStr?: string): string => {
  if (!dateStr) return '—';
  return dayjs(dateStr).fromNow();
};

const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '—';
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm');
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const RISK_COLORS: Record<string, string> = {
  low: 'green',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
};

const APPROVAL_COLORS: Record<string, string> = {
  draft: 'default',
  pending_approval: 'gold',
  approved: 'green',
  rejected: 'red',
  implemented: 'blue',
  rolled_back: 'orange',
};

const APPROVAL_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  implemented: 'Implemented',
  rolled_back: 'Rolled Back',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const Changes = () => {
  const [changes, setChanges] = useState<ITSMChange[]>([]);
  const [calendarChanges, setCalendarChanges] = useState<ITSMChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [filterApprovalStatus, setFilterApprovalStatus] = useState<string | undefined>(undefined);
  const [filterRiskLevel, setFilterRiskLevel] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingChange, setEditingChange] = useState<ITSMChange | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('list');

  // Conflict detection state
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [, setConflictChangeId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ITSMChange[]>([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);

  const [form] = Form.useForm();

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  const loadChanges = useCallback(async () => {
    try {
      setLoading(true);
      const response = await itsmChangesAPI.getAll({
        page,
        limit: pageSize,
        approvalStatus: filterApprovalStatus,
        riskLevel: filterRiskLevel,
        search: searchText || undefined,
      });
      setChanges(response.data || []);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Failed to load changes:', error);
      message.error('Failed to load changes');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterApprovalStatus, filterRiskLevel, searchText]);

  const loadCalendarData = useCallback(async () => {
    try {
      setCalendarLoading(true);
      const all = await itsmChangesAPI.getCalendar();
      setCalendarChanges(all || []);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
      message.error('Failed to load calendar data');
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChanges();
  }, [loadChanges]);

  useEffect(() => {
    if (activeTab === 'calendar') {
      loadCalendarData();
    }
  }, [activeTab, loadCalendarData]);

  // -------------------------------------------------------------------------
  // Stats derived from loaded page (approximate — server has totals)
  // -------------------------------------------------------------------------
  const totalCount = total;
  const pendingCount = changes.filter((c) => c.approvalStatus === 'pending_approval').length;
  const approvedCount = changes.filter((c) => c.approvalStatus === 'approved').length;
  const implementedCount = changes.filter((c) => c.approvalStatus === 'implemented').length;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleSearch = () => {
    setPage(1);
    loadChanges();
  };

  const handleRefresh = () => {
    setPage(1);
    loadChanges();
  };

  const openCreateModal = () => {
    setEditingChange(null);
    form.resetFields();
    setCreateModalVisible(true);
  };

  const openEditModal = (change: ITSMChange) => {
    setEditingChange(change);
    form.setFieldsValue({
      title: change.title,
      description: change.description,
      riskLevel: change.riskLevel,
      scheduledStart: change.scheduledStart ? dayjs(change.scheduledStart) : null,
      scheduledEnd: change.scheduledEnd ? dayjs(change.scheduledEnd) : null,
      rollbackPlan: change.rollbackPlan,
      implementationNotes: change.implementationNotes,
    });
    setCreateModalVisible(true);
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);

      const payload: Partial<ITSMChange> = {
        title: values.title,
        description: values.description,
        riskLevel: values.riskLevel,
        scheduledStart: values.scheduledStart ? (values.scheduledStart as Dayjs).toISOString() : undefined,
        scheduledEnd: values.scheduledEnd ? (values.scheduledEnd as Dayjs).toISOString() : undefined,
        rollbackPlan: values.rollbackPlan,
        implementationNotes: values.implementationNotes,
      };

      if (editingChange) {
        await itsmChangesAPI.update(editingChange.id, payload);
        message.success('Change updated successfully');
      } else {
        await itsmChangesAPI.create(payload);
        message.success('Change created successfully');
      }

      setCreateModalVisible(false);
      form.resetFields();
      setEditingChange(null);
      setPage(1);
      loadChanges();
    } catch (error) {
      console.error('Failed to save change:', error);
      message.error('Failed to save change');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleModalCancel = () => {
    setCreateModalVisible(false);
    form.resetFields();
    setEditingChange(null);
  };

  const handleApprovalAction = async (
    change: ITSMChange,
    newStatus: string,
    successMsg: string,
  ) => {
    try {
      setActionLoading(change.id + '_' + newStatus);
      await itsmChangesAPI.updateStatus(change.id, { approvalStatus: newStatus });
      message.success(successMsg);
      loadChanges();
    } catch (error) {
      console.error('Failed to update change status:', error);
      message.error('Failed to update change status');
    } finally {
      setActionLoading(null);
    }
  };

  const renderApprovalActions = (change: ITSMChange) => {
    const isLoading = (status: string) => actionLoading === change.id + '_' + status;

    switch (change.approvalStatus) {
      case 'draft':
        return (
          <Tooltip title="Submit for Approval">
            <Button
              size="small"
              type="primary"
              icon={<SwapOutlined />}
              loading={isLoading('pending_approval')}
              onClick={() =>
                handleApprovalAction(change, 'pending_approval', 'Submitted for approval')
              }
            >
              Submit
            </Button>
          </Tooltip>
        );
      case 'pending_approval':
        return (
          <Space>
            <Tooltip title="Approve">
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={isLoading('approved')}
                onClick={() => handleApprovalAction(change, 'approved', 'Change approved')}
              >
                Approve
              </Button>
            </Tooltip>
            <Tooltip title="Reject">
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                loading={isLoading('rejected')}
                onClick={() => handleApprovalAction(change, 'rejected', 'Change rejected')}
              >
                Reject
              </Button>
            </Tooltip>
          </Space>
        );
      case 'approved':
        return (
          <Tooltip title="Mark Implemented">
            <Button
              size="small"
              type="primary"
              style={{ background: '#1677ff' }}
              icon={<CheckCircleOutlined />}
              loading={isLoading('implemented')}
              onClick={() =>
                handleApprovalAction(change, 'implemented', 'Change marked as implemented')
              }
            >
              Implement
            </Button>
          </Tooltip>
        );
      case 'rejected':
        return (
          <Tooltip title="Revise (back to draft)">
            <Button
              size="small"
              icon={<SyncOutlined />}
              loading={isLoading('draft')}
              onClick={() => handleApprovalAction(change, 'draft', 'Change moved back to draft')}
            >
              Revise
            </Button>
          </Tooltip>
        );
      case 'implemented':
        return (
          <Tooltip title="Rollback">
            <Button
              size="small"
              danger
              icon={<WarningOutlined />}
              loading={isLoading('rolled_back')}
              onClick={() => handleApprovalAction(change, 'rolled_back', 'Change rolled back')}
            >
              Rollback
            </Button>
          </Tooltip>
        );
      default:
        return null;
    }
  };

  // -------------------------------------------------------------------------
  // Conflict detection
  // -------------------------------------------------------------------------
  const handleCheckConflicts = async (change: ITSMChange) => {
    setConflictChangeId(change.id);
    setConflicts([]);
    setConflictModalVisible(true);
    try {
      setConflictsLoading(true);
      const data = await itsmChangesAPI.getConflicts(change.id);
      setConflicts(Array.isArray(data) ? data : []);
    } catch {
      message.error('Failed to check conflicts');
    } finally {
      setConflictsLoading(false);
    }
  };

  const conflictColumns: ColumnsType<ITSMChange> = [
    {
      title: 'Change #',
      key: 'changeNumber',
      width: 140,
      render: (_, record) => <Text code style={{ fontSize: 12 }}>{record.changeNumber || record.id.slice(0, 8).toUpperCase()}</Text>,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Risk',
      key: 'riskLevel',
      width: 90,
      render: (_, record) => <Tag color={RISK_COLORS[record.riskLevel] ?? 'default'}>{record.riskLevel.toUpperCase()}</Tag>,
    },
    {
      title: 'Window',
      key: 'window',
      width: 200,
      render: (_, record) => (
        <Space size={4} direction="vertical" style={{ lineHeight: 1.4 }}>
          <Text style={{ fontSize: 12 }}>{formatDateTime(record.scheduledStart)}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>→ {formatDateTime(record.scheduledEnd)}</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'approvalStatus',
      width: 130,
      render: (_, record) => <Tag color={APPROVAL_COLORS[record.approvalStatus] ?? 'default'}>{APPROVAL_LABELS[record.approvalStatus] ?? record.approvalStatus}</Tag>,
    },
  ];

  // -------------------------------------------------------------------------
  // Table columns
  // -------------------------------------------------------------------------
  const columns: ColumnsType<ITSMChange> = [
    {
      title: 'Change #',
      key: 'changeNumber',
      width: 160,
      render: (_, record) => (
        <Text code style={{ fontSize: 12 }}>
          {record.changeNumber || record.id.slice(0, 8).toUpperCase()}
        </Text>
      ),
    },
    {
      title: 'Title',
      key: 'title',
      ellipsis: true,
      render: (_, record) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => openEditModal(record)}>
          {record.title}
        </Button>
      ),
    },
    {
      title: 'Risk Level',
      key: 'riskLevel',
      width: 110,
      render: (_, record) => (
        <Tag color={RISK_COLORS[record.riskLevel] ?? 'default'}>
          {record.riskLevel.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Approval Status',
      key: 'approvalStatus',
      width: 160,
      render: (_, record) => (
        <Tag color={APPROVAL_COLORS[record.approvalStatus] ?? 'default'}>
          {APPROVAL_LABELS[record.approvalStatus] ?? record.approvalStatus}
        </Tag>
      ),
    },
    {
      title: 'Scheduled Window',
      key: 'window',
      width: 220,
      render: (_, record) => {
        if (!record.scheduledStart && !record.scheduledEnd) {
          return <Text type="secondary">Not scheduled</Text>;
        }
        return (
          <Space size={4} direction="vertical" style={{ lineHeight: 1.4 }}>
            <Text style={{ fontSize: 12 }}>{formatDateTime(record.scheduledStart)}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              → {formatDateTime(record.scheduledEnd)}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Created',
      key: 'createdAt',
      width: 120,
      render: (_, record) => (
        <Tooltip title={formatDateTime(record.createdAt)}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatTimeAgo(record.createdAt)}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <Space size={4}>
          {renderApprovalActions(record)}
          {record.scheduledStart && (
            <Tooltip title="Check for scheduling conflicts">
              <Button size="small" icon={<ThunderboltOutlined />}
                onClick={() => handleCheckConflicts(record)}>
                Conflicts
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // -------------------------------------------------------------------------
  // Expandable row content
  // -------------------------------------------------------------------------
  const expandedRowRender = (record: ITSMChange) => (
    <Descriptions size="small" column={2} bordered style={{ margin: '8px 0' }}>
      <Descriptions.Item label="Description" span={2}>
        {record.description || <Text type="secondary">—</Text>}
      </Descriptions.Item>
      <Descriptions.Item label="Implementation Notes" span={2}>
        {record.implementationNotes || <Text type="secondary">—</Text>}
      </Descriptions.Item>
      <Descriptions.Item label="Rollback Plan" span={2}>
        {record.rollbackPlan || <Text type="secondary">—</Text>}
      </Descriptions.Item>
      <Descriptions.Item label="Approved By">
        {record.approvedBy || <Text type="secondary">—</Text>}
      </Descriptions.Item>
      <Descriptions.Item label="Scheduled Window">
        {record.scheduledStart
          ? `${formatDateTime(record.scheduledStart)} → ${formatDateTime(record.scheduledEnd)}`
          : <Text type="secondary">Not scheduled</Text>}
      </Descriptions.Item>
    </Descriptions>
  );

  // -------------------------------------------------------------------------
  // Calendar date cell renderer
  // -------------------------------------------------------------------------
  const dateCellRender = (value: Dayjs) => {
    const dateStr = value.format('YYYY-MM-DD');
    const dayChanges = calendarChanges.filter((c) => {
      if (!c.scheduledStart) return false;
      return dayjs(c.scheduledStart).format('YYYY-MM-DD') === dateStr;
    });

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayChanges.slice(0, 3).map((c) => (
          <li key={c.id} style={{ marginBottom: 2 }}>
            <Badge
              color={RISK_COLORS[c.riskLevel] ?? 'blue'}
              text={
                <Text style={{ fontSize: 11 }} ellipsis>
                  {c.title}
                </Text>
              }
            />
          </li>
        ))}
        {dayChanges.length > 3 && (
          <li>
            <Text type="secondary" style={{ fontSize: 11 }}>
              +{dayChanges.length - 3} more
            </Text>
          </li>
        )}
      </ul>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div style={{ padding: '24px' }}>
      {/* Page header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <SwapOutlined style={{ marginRight: 8 }} />
            Change Management
          </Title>
          <Text type="secondary">
            Track, approve, and schedule infrastructure changes
          </Text>
        </Col>
      </Row>

      {/* Stats cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Changes"
              value={totalCount}
              prefix={<SwapOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Pending Approval"
              value={pendingCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#d48806' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Approved"
              value={approvedCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Implemented"
              value={implementedCount}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main content tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'list',
              label: (
                <span>
                  <SwapOutlined />
                  List View
                </span>
              ),
              children: (
                <>
                  {/* Filter bar */}
                  <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={12} md={5}>
                      <Select
                        placeholder="Approval Status"
                        allowClear
                        style={{ width: '100%' }}
                        value={filterApprovalStatus}
                        onChange={(v) => {
                          setFilterApprovalStatus(v);
                          setPage(1);
                        }}
                      >
                        <Option value="draft">Draft</Option>
                        <Option value="pending_approval">Pending Approval</Option>
                        <Option value="approved">Approved</Option>
                        <Option value="rejected">Rejected</Option>
                        <Option value="implemented">Implemented</Option>
                        <Option value="rolled_back">Rolled Back</Option>
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                      <Select
                        placeholder="Risk Level"
                        allowClear
                        style={{ width: '100%' }}
                        value={filterRiskLevel}
                        onChange={(v) => {
                          setFilterRiskLevel(v);
                          setPage(1);
                        }}
                      >
                        <Option value="low">Low</Option>
                        <Option value="medium">Medium</Option>
                        <Option value="high">High</Option>
                        <Option value="critical">Critical</Option>
                      </Select>
                    </Col>
                    <Col xs={24} sm={16} md={8}>
                      <Input.Search
                        placeholder="Search changes..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onSearch={handleSearch}
                        onPressEnter={handleSearch}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} sm={8} md={7} style={{ textAlign: 'right' }}>
                      <Space>
                        <Button
                          icon={<SyncOutlined spin={loading} />}
                          onClick={handleRefresh}
                          disabled={loading}
                        >
                          Refresh
                        </Button>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={openCreateModal}
                        >
                          New Change
                        </Button>
                      </Space>
                    </Col>
                  </Row>

                  {/* Changes table */}
                  <Table<ITSMChange>
                    rowKey="id"
                    dataSource={changes}
                    columns={columns}
                    loading={loading}
                    expandable={{ expandedRowRender }}
                    pagination={{
                      current: page,
                      pageSize,
                      total,
                      showSizeChanger: true,
                      showTotal: (t) => `${t} changes`,
                      pageSizeOptions: ['10', '20', '50', '100'],
                      onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                      },
                    }}
                    scroll={{ x: 1000 }}
                  />
                </>
              ),
            },
            {
              key: 'calendar',
              label: (
                <span>
                  <CalendarOutlined />
                  Calendar View
                </span>
              ),
              children: (
                <div style={{ minHeight: 500 }}>
                  {calendarLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <SyncOutlined spin style={{ fontSize: 24 }} />
                      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        Loading calendar...
                      </Text>
                    </div>
                  ) : (
                    <Calendar cellRender={dateCellRender} />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={editingChange ? 'Edit Change Request' : 'New Change Request'}
        open={createModalVisible}
        onOk={handleModalSubmit}
        onCancel={handleModalCancel}
        confirmLoading={submitLoading}
        width={680}
        okText={editingChange ? 'Update' : 'Create'}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ riskLevel: 'medium' }}
        >
          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input placeholder="Brief title for the change" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <TextArea
              rows={3}
              placeholder="Describe the change, its purpose, and scope"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Risk Level"
                name="riskLevel"
                rules={[{ required: true, message: 'Risk level is required' }]}
              >
                <Select>
                  <Option value="low">Low</Option>
                  <Option value="medium">Medium</Option>
                  <Option value="high">High</Option>
                  <Option value="critical">Critical</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Scheduled Start" name="scheduledStart">
                <DatePicker
                  showTime
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD HH:mm"
                  placeholder="Select start date/time"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Scheduled End" name="scheduledEnd">
                <DatePicker
                  showTime
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD HH:mm"
                  placeholder="Select end date/time"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Rollback Plan" name="rollbackPlan">
            <TextArea
              rows={3}
              placeholder="Steps to roll back if the change fails"
            />
          </Form.Item>

          <Form.Item label="Implementation Notes" name="implementationNotes">
            <TextArea
              rows={3}
              placeholder="Technical notes, commands, or steps for implementation"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Conflict Detection Modal */}
      <Modal
        title={<Space><ThunderboltOutlined style={{ color: '#faad14' }} /><span>Scheduling Conflicts</span></Space>}
        open={conflictModalVisible}
        onCancel={() => { setConflictModalVisible(false); setConflictChangeId(null); setConflicts([]); }}
        footer={[
          <Button key="close" type="primary"
            onClick={() => { setConflictModalVisible(false); setConflictChangeId(null); setConflicts([]); }}>
            Close
          </Button>,
        ]}
        width={750}
        destroyOnClose
      >
        {conflictsLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <SyncOutlined spin style={{ fontSize: 24 }} />
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>Checking for conflicts...</Text>
          </div>
        ) : conflicts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: 'rgba(82, 196, 26, 0.06)', borderRadius: 8, border: '1px solid rgba(82, 196, 26, 0.2)' }}>
            <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a' }} />
            <Title level={5} style={{ color: '#52c41a', marginTop: 12, marginBottom: 4 }}>No Conflicts Found</Title>
            <Text type="secondary">This change window does not overlap with any other scheduled changes.</Text>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(250, 173, 20, 0.08)', borderRadius: 6, borderLeft: '3px solid #faad14' }}>
              <Text strong style={{ color: '#faad14' }}>
                <WarningOutlined /> {conflicts.length} conflicting change{conflicts.length > 1 ? 's' : ''} found
              </Text>
            </div>
            <Table<ITSMChange>
              dataSource={conflicts}
              columns={conflictColumns}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Changes;
