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
  Badge,
  Tooltip,
  Modal,
  Input,
  Form,
  message,
  Descriptions,
  Tabs,
  List,
  Timeline,
} from 'antd';
import {
  AlertOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  FireOutlined,
  ClockCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { itsmTicketsAPI } from '../../services/api';
import type { ITSMTicket, ITSMTicketComment, ITSMTicketHistory } from '../../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// Color Mappings
// ============================================================================

const SEVERITY_TAG_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'blue',
};

const STATUS_TAG_COLORS: Record<string, string> = {
  open: 'red',
  acknowledged: 'gold',
  in_progress: 'blue',
  pending: 'orange',
  resolved: 'green',
  closed: 'default',
};

const PRIORITY_TAG_COLORS: Record<string, string> = {
  P1: 'red',
  P2: 'orange',
  P3: 'blue',
  P4: 'default',
};

const TYPE_TAG_COLORS: Record<string, string> = {
  incident: 'red',
  problem: 'purple',
  change: 'cyan',
};

// ============================================================================
// Status Icon mapping
// ============================================================================

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open: <FireOutlined />,
  acknowledged: <ExclamationCircleOutlined />,
  in_progress: <SyncOutlined spin />,
  pending: <ClockCircleOutlined />,
  resolved: <CheckCircleOutlined />,
  closed: <CloseCircleOutlined />,
};

// ============================================================================
// SLA Countdown helper
// ============================================================================

function getSlaDisplay(ticket: ITSMTicket): React.ReactNode {
  if (ticket.breached) {
    return (
      <Tooltip title="SLA Breached">
        <Badge
          status="error"
          text={
            <Text type="danger" style={{ fontSize: 12 }}>
              Breached
            </Text>
          }
        />
      </Tooltip>
    );
  }
  if (ticket.slaDueAt) {
    const due = new Date(ticket.slaDueAt);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    if (diffMs <= 0) {
      return (
        <Tooltip title={`Due: ${due.toLocaleString()}`}>
          <Badge
            status="error"
            text={
              <Text type="danger" style={{ fontSize: 12 }}>
                Overdue
              </Text>
            }
          />
        </Tooltip>
      );
    }
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const remaining =
      diffHr > 0
        ? `${diffHr}h ${diffMin % 60}m left`
        : `${diffMin}m left`;
    const isWarning = diffMin < 30;
    return (
      <Tooltip title={`Due: ${due.toLocaleString()}`}>
        <Badge
          status={isWarning ? 'warning' : 'processing'}
          text={
            <Text style={{ fontSize: 12, color: isWarning ? '#faad14' : undefined }}>
              {remaining}
            </Text>
          }
        />
      </Tooltip>
    );
  }
  return (
    <Text type="secondary" style={{ fontSize: 12 }}>
      --
    </Text>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const Tickets = () => {
  // State: data
  const [tickets, setTickets] = useState<ITSMTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // State: pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [total, setTotal] = useState(0);

  // State: filters
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterSeverity, setFilterSeverity] = useState<string | undefined>(undefined);
  const [filterPriority, setFilterPriority] = useState<string | undefined>(undefined);
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [filterSearch, setFilterSearch] = useState<string>('');

  // State: modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // State: selected ticket and resolution
  const [selectedTicket, setSelectedTicket] = useState<ITSMTicket | null>(null);
  const [resolveTicketId, setResolveTicketId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // State: action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // State: detail modal tabs data
  const [comments, setComments] = useState<ITSMTicketComment[]>([]);
  const [history, setHistory] = useState<ITSMTicketHistory[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<'internal' | 'public'>('internal');
  const [addingComment, setAddingComment] = useState(false);

  // State: create form
  const [createForm] = Form.useForm();

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params: {
        page?: number;
        limit?: number;
        status?: string;
        severity?: string;
        priority?: string;
        type?: string;
        search?: string;
        sort?: string;
      } = {
        page,
        limit: pageSize,
        sort: 'created_at:desc',
      };
      if (filterStatus) params.status = filterStatus;
      if (filterSeverity) params.severity = filterSeverity;
      if (filterPriority) params.priority = filterPriority;
      if (filterType) params.type = filterType;
      if (filterSearch) params.search = filterSearch;

      const response = await itsmTicketsAPI.getAll(params);
      setTickets(response.data || []);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      message.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterStatus, filterSeverity, filterPriority, filterType, filterSearch]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterSeverity, filterPriority, filterType, filterSearch]);

  // ============================================================================
  // Derived Stats
  // ============================================================================

  const totalTickets = total;
  const openCount = tickets.filter((t) => t.status === 'open').length;
  const breachedCount = tickets.filter((t) => t.breached).length;
  const p1Count = tickets.filter((t) => t.priority === 'P1').length;

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handleStatusTransition = async (ticketId: string, newStatus: string, notes?: string) => {
    try {
      setActionLoading(ticketId);
      await itsmTicketsAPI.updateStatus(ticketId, {
        status: newStatus,
        ...(notes ? { resolutionNotes: notes } : {}),
      });
      message.success(`Ticket ${newStatus.replace('_', ' ')}`);
      await loadTickets();
    } catch (error) {
      console.error(`Failed to update ticket status to ${newStatus}:`, error);
      message.error(`Failed to update ticket status`);
    } finally {
      setActionLoading(null);
    }
  };

  const openResolveModal = (ticketId: string) => {
    setResolveTicketId(ticketId);
    setResolutionNotes('');
    setResolveModalVisible(true);
  };

  const handleResolve = async () => {
    if (!resolveTicketId) return;
    if (!resolutionNotes.trim()) {
      message.error('Resolution notes are required to resolve a ticket');
      return;
    }
    setResolveModalVisible(false);
    await handleStatusTransition(resolveTicketId, 'resolved', resolutionNotes);
    setResolveTicketId(null);
    setResolutionNotes('');
  };

  const handleCreateTicket = async () => {
    try {
      const values = await createForm.validateFields();
      const payload: Partial<ITSMTicket> = {
        title: values.title,
        description: values.description,
        type: values.type,
        severity: values.severity,
        priority: values.priority,
        assetId: values.assetId || undefined,
        assignedTo: values.assignedTo || undefined,
        createdBy: 'admin', // placeholder — real auth from EMS Core JWT
        source: 'manual',
      };
      await itsmTicketsAPI.create(payload);
      message.success('Ticket created successfully');
      createForm.resetFields();
      setCreateModalVisible(false);
      await loadTickets();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        // Ant Design form validation error — do nothing, form shows errors
        return;
      }
      console.error('Failed to create ticket:', error);
      message.error('Failed to create ticket');
    }
  };

  const showDetailModal = async (ticket: ITSMTicket) => {
    setSelectedTicket(ticket);
    setComments([]);
    setHistory([]);
    setDetailModalVisible(true);
  };

  const handleLoadComments = async (ticketId: string) => {
    try {
      setCommentsLoading(true);
      const data = await itsmTicketsAPI.getComments(ticketId);
      setComments(data || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
      message.error('Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleLoadHistory = async (ticketId: string) => {
    try {
      setHistoryLoading(true);
      const data = await itsmTicketsAPI.getHistory(ticketId);
      setHistory(data || []);
    } catch (error) {
      console.error('Failed to load history:', error);
      message.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !newComment.trim()) {
      message.error('Comment text is required');
      return;
    }
    try {
      setAddingComment(true);
      await itsmTicketsAPI.addComment(selectedTicket.id, {
        comment: newComment.trim(),
        visibility: commentVisibility,
      });
      message.success('Comment added');
      setNewComment('');
      await handleLoadComments(selectedTicket.id);
    } catch (error) {
      console.error('Failed to add comment:', error);
      message.error('Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: ColumnsType<ITSMTicket> = [
    {
      title: 'Ticket #',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      width: 160,
      render: (num: string) => (
        <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {num}
        </Text>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 110,
      render: (severity: string) => {
        const icons: Record<string, React.ReactNode> = {
          critical: <CloseCircleOutlined />,
          high: <WarningOutlined />,
          medium: <ExclamationCircleOutlined />,
          low: <CheckCircleOutlined />,
        };
        return (
          <Tag icon={icons[severity]} color={SEVERITY_TAG_COLORS[severity] || 'default'}>
            {severity?.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => (
        <Tag color={PRIORITY_TAG_COLORS[priority] || 'default'}>{priority}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => (
        <Tag icon={STATUS_ICONS[status]} color={STATUS_TAG_COLORS[status] || 'default'}>
          {status?.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Title',
      key: 'title',
      ellipsis: true,
      render: (_, record) => (
        <Tooltip title={record.description}>
          <a onClick={() => showDetailModal(record)} style={{ fontWeight: 500 }}>
            {record.title}
          </a>
        </Tooltip>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={TYPE_TAG_COLORS[type] || 'default'}>{type?.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'SLA',
      key: 'sla',
      width: 120,
      render: (_, record) => getSlaDisplay(record),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          <span style={{ fontSize: 12 }}>{formatTimeAgo(date)}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, record) => {
        const isLoading = actionLoading === record.id;
        return (
          <Space size="small" wrap>
            {record.status === 'open' && (
              <>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  loading={isLoading}
                  onClick={() => handleStatusTransition(record.id, 'acknowledged')}
                >
                  Acknowledge
                </Button>
                <Button
                  size="small"
                  type="primary"
                  loading={isLoading}
                  onClick={() => handleStatusTransition(record.id, 'in_progress')}
                >
                  Start Work
                </Button>
              </>
            )}
            {record.status === 'acknowledged' && (
              <Button
                size="small"
                type="primary"
                loading={isLoading}
                onClick={() => handleStatusTransition(record.id, 'in_progress')}
              >
                Start Work
              </Button>
            )}
            {record.status === 'in_progress' && (
              <>
                <Button
                  size="small"
                  loading={isLoading}
                  onClick={() => handleStatusTransition(record.id, 'pending')}
                >
                  Pending
                </Button>
                <Button
                  size="small"
                  type="primary"
                  loading={isLoading}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  onClick={() => openResolveModal(record.id)}
                >
                  Resolve
                </Button>
              </>
            )}
            {record.status === 'pending' && (
              <Button
                size="small"
                type="primary"
                ghost
                loading={isLoading}
                onClick={() => handleStatusTransition(record.id, 'in_progress')}
              >
                Resume
              </Button>
            )}
            {record.status === 'resolved' && (
              <Button
                size="small"
                loading={isLoading}
                onClick={() => handleStatusTransition(record.id, 'closed')}
              >
                Close
              </Button>
            )}
            {record.status === 'closed' && <Tag color="default">Closed</Tag>}
          </Space>
        );
      },
    },
  ];

  // ============================================================================
  // Detail Modal Content
  // ============================================================================

  const renderDetailContent = (ticket: ITSMTicket) => (
    <Tabs
      defaultActiveKey="details"
      onChange={(key) => {
        if (key === 'comments') handleLoadComments(ticket.id);
        if (key === 'history') handleLoadHistory(ticket.id);
      }}
      items={[
        {
          key: 'details',
          label: 'Details',
          children: (
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, sm: 2 }}
              style={{ marginTop: 8 }}
            >
              <Descriptions.Item label="Ticket Number">
                <Text copyable style={{ fontFamily: 'monospace' }}>
                  {ticket.ticketNumber}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color={TYPE_TAG_COLORS[ticket.type] || 'default'}>
                  {ticket.type?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Severity">
                <Tag color={SEVERITY_TAG_COLORS[ticket.severity] || 'default'}>
                  {ticket.severity?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={PRIORITY_TAG_COLORS[ticket.priority] || 'default'}>
                  {ticket.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag
                  icon={STATUS_ICONS[ticket.status]}
                  color={STATUS_TAG_COLORS[ticket.status] || 'default'}
                >
                  {ticket.status?.replace('_', ' ').toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Source">
                <Tag>{ticket.source?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Title" span={2}>
                {ticket.title}
              </Descriptions.Item>
              {ticket.description && (
                <Descriptions.Item label="Description" span={2}>
                  {ticket.description}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Assigned To">
                {ticket.assignedTo ? (
                  <Text copyable style={{ fontSize: 12 }}>
                    {ticket.assignedTo}
                  </Text>
                ) : (
                  <Text type="secondary">Unassigned</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Created By">
                <Text style={{ fontSize: 12 }}>{ticket.createdBy}</Text>
              </Descriptions.Item>
              {ticket.assetId && (
                <Descriptions.Item label="Asset ID">
                  <Text copyable style={{ fontSize: 12 }}>
                    {ticket.assetId}
                  </Text>
                </Descriptions.Item>
              )}
              {ticket.alertId && (
                <Descriptions.Item label="Alert ID">
                  <Text copyable style={{ fontSize: 12 }}>
                    {ticket.alertId}
                  </Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="SLA Breached">
                {ticket.breached ? (
                  <Tag color="red">YES</Tag>
                ) : (
                  <Tag color="green">NO</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="SLA Due At">
                {ticket.slaDueAt
                  ? new Date(ticket.slaDueAt).toLocaleString()
                  : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="Created At">
                {new Date(ticket.createdAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Updated At">
                {new Date(ticket.updatedAt).toLocaleString()}
              </Descriptions.Item>
              {ticket.resolutionNotes && (
                <Descriptions.Item label="Resolution Notes" span={2}>
                  <Text>{ticket.resolutionNotes}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          ),
        },
        {
          key: 'comments',
          label: 'Comments',
          children: (
            <div>
              <List
                loading={commentsLoading}
                dataSource={comments}
                locale={{ emptyText: 'No comments yet' }}
                renderItem={(c) => (
                  <List.Item
                    style={{
                      background: c.visibility === 'internal' ? '#fffbe6' : '#f6ffed',
                      borderRadius: 4,
                      marginBottom: 8,
                      padding: '8px 12px',
                    }}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong style={{ fontSize: 12 }}>
                            {c.createdBy}
                          </Text>
                          <Tag
                            color={c.visibility === 'internal' ? 'gold' : 'green'}
                            style={{ fontSize: 11 }}
                          >
                            {c.visibility}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {formatTimeAgo(c.createdAt)}
                          </Text>
                        </Space>
                      }
                      description={c.comment}
                    />
                  </List.Item>
                )}
                style={{ marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}
              />
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Add Comment
                </Text>
                <TextArea
                  rows={3}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Enter your comment..."
                  style={{ marginBottom: 8 }}
                />
                <Space>
                  <Select
                    value={commentVisibility}
                    onChange={(v) => setCommentVisibility(v)}
                    style={{ width: 120 }}
                    options={[
                      { label: 'Internal', value: 'internal' },
                      { label: 'Public', value: 'public' },
                    ]}
                  />
                  <Button
                    type="primary"
                    loading={addingComment}
                    onClick={handleAddComment}
                  >
                    Add Comment
                  </Button>
                </Space>
              </div>
            </div>
          ),
        },
        {
          key: 'history',
          label: 'History',
          children: (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <SyncOutlined spin style={{ fontSize: 24 }} />
                </div>
              ) : history.length === 0 ? (
                <Text type="secondary">No history recorded yet</Text>
              ) : (
                <Timeline
                  style={{ marginTop: 16 }}
                  items={history.map((h) => ({
                    key: h.id,
                    color:
                      h.fieldChanged === 'status'
                        ? 'blue'
                        : h.fieldChanged === 'breached'
                          ? 'red'
                          : 'gray',
                    children: (
                      <div>
                        <Space style={{ marginBottom: 2 }}>
                          <Text strong style={{ fontSize: 12 }}>
                            {h.fieldChanged}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {formatTimeAgo(h.changedAt)}
                          </Text>
                        </Space>
                        <div>
                          {h.oldValue && (
                            <Text
                              delete
                              type="secondary"
                              style={{ fontSize: 12, marginRight: 8 }}
                            >
                              {h.oldValue}
                            </Text>
                          )}
                          {h.newValue && (
                            <Text strong style={{ fontSize: 12 }}>
                              {h.newValue}
                            </Text>
                          )}
                        </div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          by {h.changedBy}
                        </Text>
                      </div>
                    ),
                  }))}
                />
              )}
            </div>
          ),
        },
      ]}
    />
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <AlertOutlined style={{ marginRight: 8 }} />
          ITSM Tickets
        </Title>
        <Text type="secondary">
          Manage incidents, problems, and change requests with SLA tracking
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Tickets"
              value={totalTickets}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Open"
              value={openCount}
              prefix={<FireOutlined />}
              valueStyle={{ color: openCount > 0 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="SLA Breached"
              value={breachedCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: breachedCount > 0 ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="P1 Critical"
              value={p1Count}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: p1Count > 0 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card style={{ marginBottom: 24 }}>
        <Space wrap size="middle">
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
              Status
            </Text>
            <Select
              value={filterStatus}
              onChange={(value) => setFilterStatus(value)}
              allowClear
              placeholder="All Statuses"
              style={{ width: 160 }}
              options={[
                { label: 'Open', value: 'open' },
                { label: 'Acknowledged', value: 'acknowledged' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Pending', value: 'pending' },
                { label: 'Resolved', value: 'resolved' },
                { label: 'Closed', value: 'closed' },
              ]}
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
              Severity
            </Text>
            <Select
              value={filterSeverity}
              onChange={(value) => setFilterSeverity(value)}
              allowClear
              placeholder="All Severities"
              style={{ width: 150 }}
              options={[
                { label: 'Critical', value: 'critical' },
                { label: 'High', value: 'high' },
                { label: 'Medium', value: 'medium' },
                { label: 'Low', value: 'low' },
              ]}
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
              Priority
            </Text>
            <Select
              value={filterPriority}
              onChange={(value) => setFilterPriority(value)}
              allowClear
              placeholder="All Priorities"
              style={{ width: 140 }}
              options={[
                { label: 'P1', value: 'P1' },
                { label: 'P2', value: 'P2' },
                { label: 'P3', value: 'P3' },
                { label: 'P4', value: 'P4' },
              ]}
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
              Type
            </Text>
            <Select
              value={filterType}
              onChange={(value) => setFilterType(value)}
              allowClear
              placeholder="All Types"
              style={{ width: 140 }}
              options={[
                { label: 'Incident', value: 'incident' },
                { label: 'Problem', value: 'problem' },
                { label: 'Change', value: 'change' },
              ]}
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
              Search
            </Text>
            <Input
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search title / description..."
              style={{ width: 220 }}
              allowClear
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingTop: 18 }}>
            <Button
              icon={<SyncOutlined spin={loading} />}
              onClick={loadTickets}
              loading={loading}
            >
              Refresh
            </Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingTop: 18 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createForm.resetFields();
                setCreateModalVisible(true);
              }}
            >
              New Ticket
            </Button>
          </div>
        </Space>
      </Card>

      {/* Tickets Table */}
      <Card
        title={
          <Space>
            <AlertOutlined />
            <span>Tickets ({total})</span>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={tickets}
          loading={loading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '25', '50'],
            showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} tickets`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1300 }}
          size="middle"
        />
      </Card>

      {/* Create Ticket Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            <span>Create Ticket</span>
          </Space>
        }
        open={createModalVisible}
        onOk={handleCreateTicket}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        okText="Create Ticket"
        width={600}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input placeholder="Brief summary of the issue..." />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={4} placeholder="Detailed description of the issue..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="type"
                label="Type"
                rules={[{ required: true, message: 'Type is required' }]}
              >
                <Select placeholder="Select type">
                  <Select.Option value="incident">Incident</Select.Option>
                  <Select.Option value="problem">Problem</Select.Option>
                  <Select.Option value="change">Change</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="severity"
                label="Severity"
                rules={[{ required: true, message: 'Severity is required' }]}
              >
                <Select placeholder="Select severity">
                  <Select.Option value="critical">Critical</Select.Option>
                  <Select.Option value="high">High</Select.Option>
                  <Select.Option value="medium">Medium</Select.Option>
                  <Select.Option value="low">Low</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="priority"
                label="Priority"
                rules={[{ required: true, message: 'Priority is required' }]}
              >
                <Select placeholder="Select priority">
                  <Select.Option value="P1">P1</Select.Option>
                  <Select.Option value="P2">P2</Select.Option>
                  <Select.Option value="P3">P3</Select.Option>
                  <Select.Option value="P4">P4</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="assetId" label="Asset ID (optional)">
            <Input placeholder="UUID of the affected asset..." />
          </Form.Item>
          <Form.Item name="assignedTo" label="Assign To (optional)">
            <Input placeholder="UUID of the operator to assign..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        title="Resolve Ticket"
        open={resolveModalVisible}
        onOk={handleResolve}
        onCancel={() => {
          setResolveModalVisible(false);
          setResolveTicketId(null);
          setResolutionNotes('');
        }}
        okText="Resolve"
        okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">
            Resolution notes are required to resolve this ticket. Describe what was done to fix the
            issue.
          </Text>
        </div>
        <TextArea
          rows={5}
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
          placeholder="Describe the resolution steps taken..."
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={
          selectedTicket ? (
            <Space>
              <AlertOutlined />
              <Text strong style={{ fontFamily: 'monospace' }}>
                {selectedTicket.ticketNumber}
              </Text>
              <Tag color={TYPE_TAG_COLORS[selectedTicket.type] || 'default'}>
                {selectedTicket.type?.toUpperCase()}
              </Tag>
            </Space>
          ) : (
            'Ticket Details'
          )
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedTicket(null);
          setComments([]);
          setHistory([]);
          setNewComment('');
        }}
        footer={
          selectedTicket ? (
            <Space>
              {selectedTicket.status === 'open' && (
                <>
                  <Button
                    type="primary"
                    ghost
                    onClick={() => {
                      handleStatusTransition(selectedTicket.id, 'acknowledged');
                      setDetailModalVisible(false);
                    }}
                  >
                    Acknowledge
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => {
                      handleStatusTransition(selectedTicket.id, 'in_progress');
                      setDetailModalVisible(false);
                    }}
                  >
                    Start Work
                  </Button>
                </>
              )}
              {selectedTicket.status === 'acknowledged' && (
                <Button
                  type="primary"
                  onClick={() => {
                    handleStatusTransition(selectedTicket.id, 'in_progress');
                    setDetailModalVisible(false);
                  }}
                >
                  Start Work
                </Button>
              )}
              {selectedTicket.status === 'in_progress' && (
                <>
                  <Button
                    onClick={() => {
                      handleStatusTransition(selectedTicket.id, 'pending');
                      setDetailModalVisible(false);
                    }}
                  >
                    Pending
                  </Button>
                  <Button
                    type="primary"
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    onClick={() => {
                      openResolveModal(selectedTicket.id);
                      setDetailModalVisible(false);
                    }}
                  >
                    Resolve
                  </Button>
                </>
              )}
              {selectedTicket.status === 'pending' && (
                <Button
                  type="primary"
                  ghost
                  onClick={() => {
                    handleStatusTransition(selectedTicket.id, 'in_progress');
                    setDetailModalVisible(false);
                  }}
                >
                  Resume
                </Button>
              )}
              {selectedTicket.status === 'resolved' && (
                <Button
                  onClick={() => {
                    handleStatusTransition(selectedTicket.id, 'closed');
                    setDetailModalVisible(false);
                  }}
                >
                  Close
                </Button>
              )}
              <Button onClick={() => setDetailModalVisible(false)}>Dismiss</Button>
            </Space>
          ) : null
        }
        width={860}
      >
        {selectedTicket && renderDetailContent(selectedTicket)}
      </Modal>
    </div>
  );
};

// ============================================================================
// Utility: human-readable relative time
// ============================================================================

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'just now';
}

export default Tickets;
