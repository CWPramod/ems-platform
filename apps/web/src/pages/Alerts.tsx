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
  Descriptions,
  message,
  Input,
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
  UserOutlined,
  DollarOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { alertsAPI } from '../services/api';
import type { Alert } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Extended alert type to include nested event.asset from API response
interface AlertWithAsset extends Alert {
  event?: Alert['event'] & {
    asset?: {
      id: string;
      name: string;
      type: string;
      ip: string;
      location: string;
      tier: number;
      status: string;
    };
  };
}

const SEVERITY_TAG_COLORS: Record<string, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
};

const STATUS_TAG_COLORS: Record<string, string> = {
  open: 'red',
  acknowledged: 'gold',
  resolved: 'green',
  closed: 'default',
};

const Alerts = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertWithAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterSeverity, setFilterSeverity] = useState<string | undefined>(undefined);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertWithAsset | null>(null);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveAlertId, setResolveAlertId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const params: { status?: string; limit?: number; offset?: number } = {
        limit: 200,
      };
      if (filterStatus) {
        params.status = filterStatus;
      }
      const response = await alertsAPI.getAll(params);
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      message.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Client-side severity filter (severity lives inside event, not queryable server-side)
  const filteredAlerts = filterSeverity
    ? alerts.filter((a) => a.event?.severity === filterSeverity)
    : alerts;

  // Stats
  const totalAlerts = alerts.length;
  const openAlerts = alerts.filter((a) => a.status === 'open').length;
  const criticalOpen = alerts.filter(
    (a) => a.status === 'open' && a.event?.severity === 'critical',
  ).length;
  const slaBreachedCount = alerts.filter((a) => a.slaBreached).length;

  // Handlers
  const handleAcknowledge = async (alertId: string) => {
    try {
      setActionLoading(alertId);
      await alertsAPI.acknowledge(alertId, 'admin');
      message.success('Alert acknowledged');
      await loadAlerts();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      message.error('Failed to acknowledge alert');
    } finally {
      setActionLoading(null);
    }
  };

  const openResolveModal = (alertId: string) => {
    setResolveAlertId(alertId);
    setResolveNotes('');
    setResolveModalVisible(true);
  };

  const handleResolve = async () => {
    if (!resolveAlertId) return;
    try {
      setActionLoading(resolveAlertId);
      setResolveModalVisible(false);
      await alertsAPI.resolve(resolveAlertId, {
        resolutionNotes: resolveNotes || undefined,
        resolutionCategory: 'fixed',
      });
      message.success('Alert resolved');
      await loadAlerts();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      message.error('Failed to resolve alert');
    } finally {
      setActionLoading(null);
      setResolveAlertId(null);
    }
  };

  const handleClose = async (alertId: string) => {
    try {
      setActionLoading(alertId);
      await alertsAPI.close(alertId);
      message.success('Alert closed');
      await loadAlerts();
    } catch (error) {
      console.error('Failed to close alert:', error);
      message.error('Failed to close alert');
    } finally {
      setActionLoading(null);
    }
  };

  const showDetailModal = (alert: AlertWithAsset) => {
    setSelectedAlert(alert);
    setDetailModalVisible(true);
  };

  // Table columns
  const columns: ColumnsType<AlertWithAsset> = [
    {
      title: 'Severity',
      key: 'severity',
      width: 110,
      sorter: (a, b) => {
        const order: Record<string, number> = { critical: 3, warning: 2, info: 1 };
        return (order[a.event?.severity || ''] || 0) - (order[b.event?.severity || ''] || 0);
      },
      defaultSortOrder: 'descend',
      render: (_, record) => {
        const severity = record.event?.severity || 'info';
        const icons: Record<string, React.ReactNode> = {
          critical: <CloseCircleOutlined />,
          warning: <ExclamationCircleOutlined />,
          info: <CheckCircleOutlined />,
        };
        return (
          <Tag
            icon={icons[severity]}
            color={SEVERITY_TAG_COLORS[severity] || 'default'}
          >
            {severity.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      filters: [
        { text: 'Open', value: 'open' },
        { text: 'Acknowledged', value: 'acknowledged' },
        { text: 'Resolved', value: 'resolved' },
        { text: 'Closed', value: 'closed' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: string) => {
        const icons: Record<string, React.ReactNode> = {
          open: <FireOutlined />,
          acknowledged: <UserOutlined />,
          resolved: <CheckCircleOutlined />,
          closed: <ClockCircleOutlined />,
        };
        return (
          <Tag icon={icons[status]} color={STATUS_TAG_COLORS[status] || 'default'}>
            {status.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Alert',
      key: 'title',
      ellipsis: false,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <a onClick={() => showDetailModal(record)} style={{ fontWeight: 500 }}>
            {record.event?.title || 'Alert'}
          </a>
          {record.event?.message && (
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {record.event.message}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Device',
      key: 'device',
      width: 200,
      render: (_, record) => {
        const asset = record.event?.asset;
        if (!asset) {
          return <Text type="secondary">N/A</Text>;
        }
        return (
          <Space direction="vertical" size={0}>
            <a
              onClick={() => navigate(`/device/${asset.id}`)}
              style={{ fontWeight: 500 }}
            >
              {asset.name}
            </a>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {asset.ip} - {asset.type}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Location',
      key: 'location',
      width: 120,
      render: (_, record) => {
        const location = record.event?.asset?.location;
        return location ? (
          <Space size={4}>
            <EnvironmentOutlined />
            <span>{location}</span>
          </Space>
        ) : (
          <Text type="secondary">--</Text>
        );
      },
    },
    {
      title: 'Impact',
      dataIndex: 'businessImpactScore',
      key: 'impact',
      width: 90,
      sorter: (a, b) => (a.businessImpactScore || 0) - (b.businessImpactScore || 0),
      render: (score: number | undefined) => {
        if (score == null) return <Text type="secondary">--</Text>;
        let color = '#52c41a';
        if (score >= 80) color = '#f5222d';
        else if (score >= 50) color = '#faad14';
        return (
          <Tooltip title={`Business Impact Score: ${score}/100`}>
            <Text strong style={{ color }}>
              {score}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      sorter: (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      defaultSortOrder: 'descend',
      render: (date: string) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          <span>{formatTimeAgo(date)}</span>
        </Tooltip>
      ),
    },
    {
      title: 'SLA',
      key: 'sla',
      width: 70,
      render: (_, record) => {
        if (record.slaBreached) {
          return (
            <Tooltip title="SLA Breached">
              <Badge status="error" text={<Text type="danger" style={{ fontSize: 12 }}>Breached</Text>} />
            </Tooltip>
          );
        }
        if (record.slaDeadline) {
          return (
            <Tooltip title={`Deadline: ${new Date(record.slaDeadline).toLocaleString()}`}>
              <Badge status="processing" text={<Text style={{ fontSize: 12 }}>Active</Text>} />
            </Tooltip>
          );
        }
        return <Text type="secondary" style={{ fontSize: 12 }}>--</Text>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
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
                  onClick={() => handleAcknowledge(record.id)}
                >
                  Acknowledge
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
            {record.status === 'acknowledged' && (
              <Button
                size="small"
                type="primary"
                loading={isLoading}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => openResolveModal(record.id)}
              >
                Resolve
              </Button>
            )}
            {record.status === 'resolved' && (
              <Button
                size="small"
                loading={isLoading}
                onClick={() => handleClose(record.id)}
              >
                Close
              </Button>
            )}
            {record.status === 'closed' && (
              <Tag color="default">Closed</Tag>
            )}
          </Space>
        );
      },
    },
  ];

  // Expandable row render
  const expandedRowRender = (record: AlertWithAsset) => {
    const event = record.event;
    const asset = event?.asset;

    return (
      <Descriptions
        bordered
        size="small"
        column={{ xs: 1, sm: 2, md: 3 }}
        style={{ margin: '8px 0' }}
      >
        <Descriptions.Item label="Alert ID">
          <Text copyable style={{ fontSize: 12 }}>{record.id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Event ID">
          <Text copyable style={{ fontSize: 12 }}>{record.eventId}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Source">
          <Tag>{event?.source?.toUpperCase() || 'N/A'}</Tag>
        </Descriptions.Item>

        <Descriptions.Item label="Category">
          {event?.category || 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Occurrences">
          <Badge
            count={event?.occurrenceCount || 0}
            showZero
            style={{ backgroundColor: (event?.occurrenceCount || 0) > 1 ? '#faad14' : '#52c41a' }}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Event Timestamp">
          {event?.timestamp ? new Date(event.timestamp).toLocaleString() : 'N/A'}
        </Descriptions.Item>

        <Descriptions.Item label="Event Message" span={3}>
          {event?.message || 'No message available'}
        </Descriptions.Item>

        {asset && (
          <>
            <Descriptions.Item label="Device Name">
              <a onClick={() => navigate(`/device/${asset.id}`)}>{asset.name}</a>
            </Descriptions.Item>
            <Descriptions.Item label="Device IP">{asset.ip}</Descriptions.Item>
            <Descriptions.Item label="Device Type">
              <Tag color="blue">{asset.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Location">{asset.location}</Descriptions.Item>
            <Descriptions.Item label="Tier">
              <Tag color="purple">Tier {asset.tier}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Device Status">
              <Tag color={asset.status === 'online' ? 'green' : asset.status === 'offline' ? 'red' : 'orange'}>
                {asset.status?.toUpperCase()}
              </Tag>
            </Descriptions.Item>
          </>
        )}

        {(record.affectedUsers != null || record.revenueAtRisk != null) && (
          <>
            <Descriptions.Item label="Affected Users">
              {record.affectedUsers != null ? (
                <Space>
                  <UserOutlined />
                  <span>~{record.affectedUsers.toLocaleString()}</span>
                </Space>
              ) : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Revenue at Risk">
              {record.revenueAtRisk != null ? (
                <Space>
                  <DollarOutlined />
                  <Text type="danger">${record.revenueAtRisk.toLocaleString()}</Text>
                </Space>
              ) : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Impact Score">
              {record.businessImpactScore ?? 'N/A'}
            </Descriptions.Item>
          </>
        )}

        <Descriptions.Item label="Owner">{record.owner || 'Unassigned'}</Descriptions.Item>
        <Descriptions.Item label="Team">{record.team || 'Unassigned'}</Descriptions.Item>
        <Descriptions.Item label="SLA Breached">
          {record.slaBreached ? (
            <Tag color="red">YES</Tag>
          ) : (
            <Tag color="green">NO</Tag>
          )}
        </Descriptions.Item>

        {record.acknowledgedAt && (
          <Descriptions.Item label="Acknowledged At">
            {new Date(record.acknowledgedAt).toLocaleString()}
          </Descriptions.Item>
        )}
        {record.resolvedAt && (
          <Descriptions.Item label="Resolved At">
            {new Date(record.resolvedAt).toLocaleString()}
          </Descriptions.Item>
        )}
        {record.resolutionNotes && (
          <Descriptions.Item label="Resolution Notes" span={3}>
            <Text>{record.resolutionNotes}</Text>
          </Descriptions.Item>
        )}
        {record.resolutionCategory && (
          <Descriptions.Item label="Resolution Category">
            <Tag>{record.resolutionCategory}</Tag>
          </Descriptions.Item>
        )}
      </Descriptions>
    );
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <AlertOutlined style={{ marginRight: 8 }} />
          Alert Management
        </Title>
        <Text type="secondary">
          Monitor, triage, and resolve infrastructure alerts
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Alerts"
              value={totalAlerts}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Open"
              value={openAlerts}
              prefix={<FireOutlined />}
              valueStyle={{ color: openAlerts > 0 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Critical (Open)"
              value={criticalOpen}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: criticalOpen > 0 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="SLA Breached"
              value={slaBreachedCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: slaBreachedCount > 0 ? '#faad14' : '#52c41a' }}
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
              style={{ width: 180 }}
              options={[
                { label: 'Open', value: 'open' },
                { label: 'Acknowledged', value: 'acknowledged' },
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
              style={{ width: 180 }}
              options={[
                { label: 'Critical', value: 'critical' },
                { label: 'Warning', value: 'warning' },
                { label: 'Info', value: 'info' },
              ]}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingTop: 18 }}>
            <Button
              icon={<SyncOutlined spin={loading} />}
              onClick={loadAlerts}
              loading={loading}
            >
              Refresh
            </Button>
          </div>
        </Space>
      </Card>

      {/* Alerts Table */}
      <Card
        title={
          <Space>
            <AlertOutlined />
            <span>Alerts ({filteredAlerts.length})</span>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredAlerts}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '25', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} alerts`,
          }}
          expandable={{
            expandedRowRender,
            rowExpandable: () => true,
          }}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>

      {/* Alert Detail Modal */}
      <Modal
        title={
          <Space>
            <AlertOutlined />
            <span>Alert Details</span>
          </Space>
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedAlert(null);
        }}
        footer={
          selectedAlert ? (
            <Space>
              {selectedAlert.status === 'open' && (
                <>
                  <Button
                    type="primary"
                    ghost
                    onClick={() => {
                      handleAcknowledge(selectedAlert.id);
                      setDetailModalVisible(false);
                    }}
                  >
                    Acknowledge
                  </Button>
                  <Button
                    type="primary"
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    onClick={() => {
                      openResolveModal(selectedAlert.id);
                      setDetailModalVisible(false);
                    }}
                  >
                    Resolve
                  </Button>
                </>
              )}
              {selectedAlert.status === 'acknowledged' && (
                <Button
                  type="primary"
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  onClick={() => {
                    openResolveModal(selectedAlert.id);
                    setDetailModalVisible(false);
                  }}
                >
                  Resolve
                </Button>
              )}
              {selectedAlert.status === 'resolved' && (
                <Button
                  onClick={() => {
                    handleClose(selectedAlert.id);
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
        width={800}
      >
        {selectedAlert && expandedRowRender(selectedAlert)}
      </Modal>

      {/* Resolve Modal */}
      <Modal
        title="Resolve Alert"
        open={resolveModalVisible}
        onOk={handleResolve}
        onCancel={() => {
          setResolveModalVisible(false);
          setResolveAlertId(null);
          setResolveNotes('');
        }}
        okText="Resolve"
        okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Provide optional resolution notes before resolving this alert.
          </Text>
        </div>
        <TextArea
          rows={4}
          value={resolveNotes}
          onChange={(e) => setResolveNotes(e.target.value)}
          placeholder="Resolution notes (optional)..."
        />
      </Modal>
    </div>
  );
};

// Utility: human-readable relative time
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

export default Alerts;
