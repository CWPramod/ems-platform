import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Tag,
  Space,
  Button,
  Select,
  Typography,
  Badge,
  Tooltip,
  Modal,
  Input,
  Progress,
  message,
  Descriptions,
  Tabs,
  List,
  Timeline,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  AlertOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  FireOutlined,
  ClockCircleOutlined,
  UserOutlined,
  LinkOutlined,
} from '@ant-design/icons';
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

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open: <FireOutlined />,
  acknowledged: <ExclamationCircleOutlined />,
  in_progress: <SyncOutlined spin />,
  pending: <ClockCircleOutlined />,
  resolved: <CheckCircleOutlined />,
  closed: <CloseCircleOutlined />,
};

// ============================================================================
// Helpers
// ============================================================================

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getSlaProgress(ticket: ITSMTicket): { percent: number; color: string; text: string } {
  if (ticket.breached) {
    return { percent: 0, color: '#f5222d', text: 'BREACHED' };
  }
  if (!ticket.slaDueAt) {
    return { percent: 100, color: '#8c8c8c', text: 'No SLA' };
  }
  const now = Date.now();
  const due = new Date(ticket.slaDueAt).getTime();
  const created = new Date(ticket.createdAt).getTime();
  const totalWindow = due - created;
  const remaining = due - now;

  if (remaining <= 0) {
    return { percent: 0, color: '#f5222d', text: 'OVERDUE' };
  }

  const pct = Math.round((remaining / totalWindow) * 100);
  const clampedPct = Math.max(0, Math.min(100, pct));

  let color = '#52c41a'; // green > 50%
  if (clampedPct <= 20) color = '#f5222d'; // red < 20%
  else if (clampedPct <= 50) color = '#faad14'; // gold < 50%

  const remainingMin = Math.floor(remaining / 60000);
  const h = Math.floor(remainingMin / 60);
  const m = remainingMin % 60;
  const text = h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;

  return { percent: clampedPct, color, text };
}

// ============================================================================
// Component
// ============================================================================

const TicketDetails: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<ITSMTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Comments
  const [comments, setComments] = useState<ITSMTicketComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<'internal' | 'public'>('internal');
  const [addingComment, setAddingComment] = useState(false);

  // History
  const [history, setHistory] = useState<ITSMTicketHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Resolve modal
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Assign modal
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTo, setAssignTo] = useState('');

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      setLoading(true);
      const data = await itsmTicketsAPI.getById(ticketId);
      setTicket(data);
    } catch (err) {
      console.error('Failed to load ticket:', err);
      message.error('Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const loadComments = useCallback(async () => {
    if (!ticketId) return;
    try {
      setCommentsLoading(true);
      const data = await itsmTicketsAPI.getComments(ticketId);
      setComments(data || []);
    } catch {
      message.error('Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  }, [ticketId]);

  const loadHistory = useCallback(async () => {
    if (!ticketId) return;
    try {
      setHistoryLoading(true);
      const data = await itsmTicketsAPI.getHistory(ticketId);
      setHistory(data || []);
    } catch {
      message.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handleStatusTransition = async (newStatus: string, notes?: string) => {
    if (!ticket) return;
    try {
      setActionLoading(true);
      await itsmTicketsAPI.updateStatus(ticket.id, {
        status: newStatus,
        ...(notes ? { resolutionNotes: notes } : {}),
      });
      message.success(`Ticket ${newStatus.replace('_', ' ')}`);
      await loadTicket();
    } catch {
      message.error('Failed to update ticket status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      message.error('Resolution notes are required');
      return;
    }
    setResolveModalVisible(false);
    await handleStatusTransition('resolved', resolutionNotes);
    setResolutionNotes('');
  };

  const handleAssign = async () => {
    if (!ticket || !assignTo.trim()) {
      message.error('Operator ID is required');
      return;
    }
    try {
      setActionLoading(true);
      await itsmTicketsAPI.assign(ticket.id, { assignedTo: assignTo.trim() });
      message.success('Ticket assigned');
      setAssignModalVisible(false);
      setAssignTo('');
      await loadTicket();
    } catch {
      message.error('Failed to assign ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!ticket || !newComment.trim()) {
      message.error('Comment text is required');
      return;
    }
    try {
      setAddingComment(true);
      await itsmTicketsAPI.addComment(ticket.id, {
        comment: newComment.trim(),
        visibility: commentVisibility,
      });
      message.success('Comment added');
      setNewComment('');
      await loadComments();
    } catch {
      message.error('Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  // ============================================================================
  // Loading / Not Found
  // ============================================================================

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', paddingTop: 100 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">Loading ticket...</Text>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/itsm/tickets')}>
          Back to Tickets
        </Button>
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <Title level={4} type="secondary">Ticket not found</Title>
        </div>
      </div>
    );
  }

  const sla = getSlaProgress(ticket);

  // ============================================================================
  // Status Action Buttons
  // ============================================================================

  const renderStatusActions = () => {
    const buttons: React.ReactNode[] = [];

    if (ticket.status === 'open') {
      buttons.push(
        <Button key="ack" type="primary" ghost loading={actionLoading}
          onClick={() => handleStatusTransition('acknowledged')}>
          Acknowledge
        </Button>,
        <Button key="start" type="primary" loading={actionLoading}
          onClick={() => handleStatusTransition('in_progress')}>
          Start Work
        </Button>,
      );
    }
    if (ticket.status === 'acknowledged') {
      buttons.push(
        <Button key="start" type="primary" loading={actionLoading}
          onClick={() => handleStatusTransition('in_progress')}>
          Start Work
        </Button>,
      );
    }
    if (ticket.status === 'in_progress') {
      buttons.push(
        <Button key="pending" loading={actionLoading}
          onClick={() => handleStatusTransition('pending')}>
          Pending
        </Button>,
        <Button key="resolve" type="primary" loading={actionLoading}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
          onClick={() => { setResolutionNotes(''); setResolveModalVisible(true); }}>
          Resolve
        </Button>,
      );
    }
    if (ticket.status === 'pending') {
      buttons.push(
        <Button key="resume" type="primary" ghost loading={actionLoading}
          onClick={() => handleStatusTransition('in_progress')}>
          Resume
        </Button>,
      );
    }
    if (ticket.status === 'resolved') {
      buttons.push(
        <Button key="close" loading={actionLoading}
          onClick={() => handleStatusTransition('closed')}>
          Close
        </Button>,
        <Button key="reopen" type="primary" ghost loading={actionLoading}
          onClick={() => handleStatusTransition('in_progress')}>
          Reopen
        </Button>,
      );
    }

    buttons.push(
      <Button key="assign" icon={<UserOutlined />}
        onClick={() => { setAssignTo(ticket.assignedTo || ''); setAssignModalVisible(true); }}>
        Assign
      </Button>,
    );

    return <Space wrap>{buttons}</Space>;
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space style={{ marginBottom: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/itsm/tickets')}>
            Back
          </Button>
        </Space>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Space align="center" style={{ marginBottom: 8 }}>
              <AlertOutlined style={{ fontSize: 22 }} />
              <Text strong style={{ fontFamily: 'monospace', fontSize: 18 }}>
                {ticket.ticketNumber}
              </Text>
              <Tag color={TYPE_TAG_COLORS[ticket.type] || 'default'}>
                {ticket.type?.toUpperCase()}
              </Tag>
              <Tag icon={STATUS_ICONS[ticket.status]}
                color={STATUS_TAG_COLORS[ticket.status] || 'default'}>
                {ticket.status?.replace('_', ' ').toUpperCase()}
              </Tag>
              <Tag color={SEVERITY_TAG_COLORS[ticket.severity] || 'default'}>
                {ticket.severity?.toUpperCase()}
              </Tag>
              <Tag color={PRIORITY_TAG_COLORS[ticket.priority] || 'default'}>
                {ticket.priority}
              </Tag>
            </Space>
            <Title level={4} style={{ margin: 0 }}>
              {ticket.title}
            </Title>
          </div>
          <div>
            {renderStatusActions()}
          </div>
        </div>
      </div>

      {/* Top Row: SLA + Key Info */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* SLA Countdown Card */}
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: 8, height: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>SLA Status</Text>
              <Progress
                type="dashboard"
                percent={sla.percent}
                strokeColor={sla.color}
                format={() => (
                  <span style={{ fontSize: 14, color: sla.color, fontWeight: 600 }}>
                    {sla.percent}%
                  </span>
                )}
                size={120}
              />
              <div style={{ marginTop: 8 }}>
                <Text style={{ color: sla.color, fontWeight: 500 }}>{sla.text}</Text>
              </div>
              {ticket.slaDueAt && (
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Due: {new Date(ticket.slaDueAt).toLocaleString()}
                  </Text>
                </div>
              )}
              {ticket.breached && (
                <div style={{ marginTop: 8 }}>
                  <Badge status="error" text={<Text type="danger" strong>SLA BREACHED</Text>} />
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* Ticket Fields */}
        <Col xs={24} md={16}>
          <Card bordered={false} style={{ borderRadius: 8, height: '100%' }}>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Ticket Number">
                <Text copyable style={{ fontFamily: 'monospace' }}>{ticket.ticketNumber}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Source">
                <Tag>{ticket.source?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Assigned To">
                {ticket.assignedTo ? (
                  <Text copyable style={{ fontSize: 12 }}>{ticket.assignedTo}</Text>
                ) : (
                  <Text type="secondary">Unassigned</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Created By">
                <Text style={{ fontSize: 12 }}>{ticket.createdBy}</Text>
              </Descriptions.Item>
              {ticket.assetId && (
                <Descriptions.Item label="Asset ID">
                  <Text copyable style={{ fontSize: 12 }}>{ticket.assetId}</Text>
                </Descriptions.Item>
              )}
              {ticket.alertId && (
                <Descriptions.Item label="Alert ID">
                  <Text copyable style={{ fontSize: 12 }}>{ticket.alertId}</Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Created">
                <Tooltip title={new Date(ticket.createdAt).toLocaleString()}>
                  {formatTimeAgo(ticket.createdAt)}
                </Tooltip>
              </Descriptions.Item>
              <Descriptions.Item label="Updated">
                <Tooltip title={new Date(ticket.updatedAt).toLocaleString()}>
                  {formatTimeAgo(ticket.updatedAt)}
                </Tooltip>
              </Descriptions.Item>
              {ticket.description && (
                <Descriptions.Item label="Description" span={2}>
                  {ticket.description}
                </Descriptions.Item>
              )}
              {ticket.resolutionNotes && (
                <Descriptions.Item label="Resolution Notes" span={2}>
                  <Text style={{ color: '#52c41a' }}>{ticket.resolutionNotes}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* Tabs: Comments, History, Linked Tickets */}
      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Tabs
          defaultActiveKey="comments"
          onChange={(key) => {
            if (key === 'comments') loadComments();
            if (key === 'history') loadHistory();
          }}
          items={[
            {
              key: 'comments',
              label: <span><ExclamationCircleOutlined /> Comments</span>,
              children: (
                <div>
                  <List
                    loading={commentsLoading}
                    dataSource={comments}
                    locale={{ emptyText: 'No comments yet. Click tab to load.' }}
                    renderItem={(c) => (
                      <List.Item
                        style={{
                          background: c.visibility === 'internal'
                            ? 'rgba(250, 173, 20, 0.06)'
                            : 'rgba(82, 196, 26, 0.06)',
                          borderRadius: 4,
                          marginBottom: 8,
                          padding: '8px 12px',
                        }}
                      >
                        <List.Item.Meta
                          title={
                            <Space>
                              <Text strong style={{ fontSize: 12 }}>{c.createdBy}</Text>
                              <Tag color={c.visibility === 'internal' ? 'gold' : 'green'}
                                style={{ fontSize: 11 }}>
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
                    style={{ marginBottom: 16, maxHeight: 400, overflowY: 'auto' }}
                  />
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Add Comment</Text>
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
                      <Button type="primary" loading={addingComment} onClick={handleAddComment}>
                        Add Comment
                      </Button>
                    </Space>
                  </div>
                </div>
              ),
            },
            {
              key: 'history',
              label: <span><ClockCircleOutlined /> History</span>,
              children: (
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                      <Spin />
                    </div>
                  ) : history.length === 0 ? (
                    <Text type="secondary">No history recorded yet. Click tab to load.</Text>
                  ) : (
                    <Timeline
                      style={{ marginTop: 16 }}
                      items={history.map((h) => ({
                        key: h.id,
                        color: h.fieldChanged === 'status' ? 'blue'
                          : h.fieldChanged === 'breached' ? 'red' : 'gray',
                        children: (
                          <div>
                            <Space style={{ marginBottom: 2 }}>
                              <Text strong style={{ fontSize: 12 }}>{h.fieldChanged}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {formatTimeAgo(h.changedAt)}
                              </Text>
                            </Space>
                            <div>
                              {h.oldValue && (
                                <Text delete type="secondary"
                                  style={{ fontSize: 12, marginRight: 8 }}>
                                  {h.oldValue}
                                </Text>
                              )}
                              {h.newValue && (
                                <Text strong style={{ fontSize: 12 }}>{h.newValue}</Text>
                              )}
                            </div>
                            <Text type="secondary" style={{ fontSize: 11 }}>by {h.changedBy}</Text>
                          </div>
                        ),
                      }))}
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'linked',
              label: <span><LinkOutlined /> Linked Tickets</span>,
              children: (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <Text type="secondary">
                    Linked tickets will be available in a future update.
                  </Text>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Resolve Modal */}
      <Modal
        title="Resolve Ticket"
        open={resolveModalVisible}
        onOk={handleResolve}
        onCancel={() => { setResolveModalVisible(false); setResolutionNotes(''); }}
        okText="Resolve"
        okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">
            Resolution notes are required. Describe what was done to fix the issue.
          </Text>
        </div>
        <TextArea
          rows={5}
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
          placeholder="Describe the resolution steps taken..."
        />
      </Modal>

      {/* Assign Modal */}
      <Modal
        title="Assign Ticket"
        open={assignModalVisible}
        onOk={handleAssign}
        onCancel={() => { setAssignModalVisible(false); setAssignTo(''); }}
        okText="Assign"
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">Enter the operator UUID to assign this ticket to.</Text>
        </div>
        <Input
          value={assignTo}
          onChange={(e) => setAssignTo(e.target.value)}
          placeholder="Operator UUID..."
        />
      </Modal>
    </div>
  );
};

export default TicketDetails;
