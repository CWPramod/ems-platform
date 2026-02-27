// NMS Dashboard — Bank Demo Ready
// apps/web/src/pages/Dashboard.tsx

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Progress,
  Space,
  Button,
  Typography,
  Select,
  List,
  message,
} from 'antd';
import {
  ArrowUpOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  EyeOutlined,
  DashboardOutlined,
  GatewayOutlined,
  ClusterOutlined,
  SafetyOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { alertsAPI, assetsAPI } from '../services/api';

const { Title, Text } = Typography;

type StatusFilter = 'all' | 'online' | 'warning' | 'critical';

interface HealthMetrics {
  averageHealthScore: number;
  averageCpuUtilization: number;
  averageMemoryUtilization: number;
  totalActiveAlerts: number;
  totalCriticalAlerts: number;
}

interface DashboardSummary {
  totalCritical: number;
  byStatus: Record<string, number>;
  healthMetrics: HealthMetrics;
}

interface ChartDataPoint {
  name: string;
  bandwidth: number;
  cpu: number;
}

interface DeviceTypeCounts {
  router: number;
  switch: number;
  firewall: number;
  access_point: number;
  network_device: number;
  other: number;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sla, setSla] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [filterLoading, setFilterLoading] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [typeCounts, setTypeCounts] = useState<DeviceTypeCounts>({
    router: 0,
    switch: 0,
    firewall: 0,
    access_point: 0,
    network_device: 0,
    other: 0,
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [devicesRes, summaryRes, slaRes, topBwRes, alertsRes, assetsRes] = await Promise.allSettled([
        apiService.getCriticalDevices(),
        apiService.getDashboardSummary(),
        apiService.getSLACompliance(),
        apiService.getTopDevicesByMetric('bandwidth', 10),
        alertsAPI.getAll({ status: 'open', limit: 10 }),
        assetsAPI.getAll(),
      ]);

      if (devicesRes.status === 'fulfilled' && devicesRes.value.success) {
        setDevices(devicesRes.value.data || []);
      }

      if (summaryRes.status === 'fulfilled' && summaryRes.value.success) {
        setSummary(summaryRes.value.data);
      }

      if (slaRes.status === 'fulfilled' && slaRes.value.success) {
        setSla(slaRes.value.data);
      }

      if (topBwRes.status === 'fulfilled' && topBwRes.value.success) {
        const topDevices = topBwRes.value.data || [];
        const mapped: ChartDataPoint[] = topDevices.map((item: any) => ({
          name: item.device || item.assetId || 'Unknown',
          bandwidth: typeof item.value === 'number' ? Math.round(item.value * 10) / 10 : 0,
          cpu: item.health?.cpuUtilization
            ? Math.round(item.health.cpuUtilization * 10) / 10
            : 0,
        }));
        setChartData(mapped);
      }

      // Recent critical alerts
      if (alertsRes.status === 'fulfilled') {
        const alertData = alertsRes.value.data || [];
        const critAlerts = alertData
          .filter((a: any) => a.event?.severity === 'critical' || a.event?.severity === 'warning')
          .slice(0, 8);
        setRecentAlerts(critAlerts);
      }

      // Device type counts
      if (assetsRes.status === 'fulfilled') {
        const allAssets = Array.isArray(assetsRes.value) ? assetsRes.value : (assetsRes.value as any).data || [];
        const counts: DeviceTypeCounts = {
          router: 0,
          switch: 0,
          firewall: 0,
          access_point: 0,
          network_device: 0,
          other: 0,
        };
        for (const asset of allAssets) {
          const t = asset.type?.toLowerCase();
          if (t === 'router') counts.router++;
          else if (t === 'switch') counts.switch++;
          else if (t === 'firewall') counts.firewall++;
          else if (t === 'access_point') counts.access_point++;
          else if (t === 'network_device') counts.network_device++;
          else counts.other++;
        }
        setTypeCounts(counts);
      }

      setSelectedStatus('all');
    } catch (error: any) {
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Stat card click handler
  const handleStatusFilter = async (status: StatusFilter) => {
    setSelectedStatus(status);
    setFilterLoading(true);
    try {
      if (status === 'all') {
        const res = await apiService.getCriticalDevices();
        if (res.success) {
          setDevices(res.data || []);
        }
      } else {
        const apiStatus = status === 'critical' ? 'offline' : status;
        const res = await apiService.getDevicesByStatus(apiStatus);
        if (res.success) {
          setDevices(res.data || []);
        }
      }
    } catch {
      message.error('Failed to filter devices');
    } finally {
      setFilterLoading(false);
    }
  };

  // Compute counts from summary byStatus
  const byStatus = summary?.byStatus || {};
  const totalDevices = Object.values(byStatus).reduce((sum: number, v: any) => sum + (v || 0), 0) || devices.length;
  const healthyDevices = byStatus.online || devices.filter((d) => d.status === 'online').length;
  const warningDevices = byStatus.warning || devices.filter((d) => d.status === 'warning').length;
  const criticalDevices =
    (byStatus.offline || 0) + (byStatus.critical || 0) ||
    devices.filter((d) => d.status === 'offline' || d.status === 'critical').length;

  const healthMetrics = summary?.healthMetrics;

  // SLA data
  const slaPercent =
    healthMetrics?.averageHealthScore != null
      ? Math.round(healthMetrics.averageHealthScore * 10) / 10
      : sla?.compliancePercent ?? 0;

  // Stat card styling helper
  const cardStyle = (status: StatusFilter): React.CSSProperties => ({
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    borderWidth: selectedStatus === status ? '2px' : '1px',
    borderStyle: 'solid',
    borderColor:
      selectedStatus === status
        ? status === 'all'
          ? '#1890ff'
          : status === 'online'
            ? '#52c41a'
            : status === 'warning'
              ? '#faad14'
              : '#f5222d'
        : 'transparent',
    boxShadow:
      selectedStatus === status
        ? `0 0 12px ${
            status === 'all'
              ? 'rgba(24,144,255,0.3)'
              : status === 'online'
                ? 'rgba(82,196,26,0.3)'
                : status === 'warning'
                  ? 'rgba(250,173,20,0.3)'
                  : 'rgba(245,34,45,0.3)'
          }`
        : 'none',
  });

  // Table columns
  const columns: ColumnsType<any> = [
    {
      title: 'Device Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <a
          onClick={() => navigate(`/device/${record.id}`)}
          style={{ color: '#1890ff', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {text}
        </a>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'IP Address',
      dataIndex: 'ip',
      key: 'ip',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config: Record<string, { color: string; icon: React.ReactNode }> = {
          online: { color: 'success', icon: <CheckCircleOutlined /> },
          warning: { color: 'warning', icon: <ExclamationCircleOutlined /> },
          offline: { color: 'error', icon: <CloseCircleOutlined /> },
          critical: { color: 'error', icon: <CloseCircleOutlined /> },
          maintenance: { color: 'default', icon: <ExclamationCircleOutlined /> },
        };
        const statusConfig = config[status] || config.online;
        return (
          <Tag icon={statusConfig.icon} color={statusConfig.color}>
            {status?.toUpperCase() || 'ONLINE'}
          </Tag>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/device/${record.id}`)}
        >
          Details
        </Button>
      ),
    },
  ];

  // SLA styling
  const slaStrokeColor =
    slaPercent >= 90 ? '#52c41a' : slaPercent >= 70 ? '#faad14' : '#f5222d';
  const slaTagColor = slaPercent >= 90 ? 'green' : slaPercent >= 70 ? 'warning' : 'error';
  const slaTagText = slaPercent >= 90 ? 'On Target' : slaPercent >= 70 ? 'Degraded' : 'Critical';

  // Table title based on filter
  const tableTitle =
    selectedStatus === 'all'
      ? `All Devices (${devices.length})`
      : `${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Devices (${devices.length})`;

  const typeTotal = typeCounts.router + typeCounts.switch + typeCounts.firewall + typeCounts.access_point + typeCounts.network_device + typeCounts.other;

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Network Monitoring Dashboard</Title>
        <Text type="secondary">Real-time visibility into network infrastructure</Text>
      </div>

      {/* Statistics Cards - Clickable */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={cardStyle('all')}
            onClick={() => handleStatusFilter('all')}
          >
            <Statistic
              title="Total Devices"
              value={totalDevices}
              prefix={<DashboardOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={cardStyle('online')}
            onClick={() => handleStatusFilter('online')}
          >
            <Statistic
              title="Up"
              value={healthyDevices}
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix={`/ ${totalDevices}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={cardStyle('warning')}
            onClick={() => handleStatusFilter('warning')}
          >
            <Statistic
              title="Warning"
              value={warningDevices}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={cardStyle('critical')}
            onClick={() => handleStatusFilter('critical')}
          >
            <Statistic
              title="Down"
              value={criticalDevices}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Network Overview + Health Score */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={8}>
          <Card title="Network Overview" extra={<Tag color="blue">{typeTotal} Total</Tag>}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space><GatewayOutlined style={{ color: '#1890ff' }} /><Text>Routers</Text></Space>
                <Text strong style={{ fontSize: 20 }}>{typeCounts.router}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space><ClusterOutlined style={{ color: '#52c41a' }} /><Text>Switches</Text></Space>
                <Text strong style={{ fontSize: 20 }}>{typeCounts.switch}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space><SafetyOutlined style={{ color: '#faad14' }} /><Text>Firewalls</Text></Space>
                <Text strong style={{ fontSize: 20 }}>{typeCounts.firewall}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space><WifiOutlined style={{ color: '#13c2c2' }} /><Text>Access Points</Text></Space>
                <Text strong style={{ fontSize: 20 }}>{typeCounts.access_point}</Text>
              </div>
              {typeCounts.network_device + typeCounts.other > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space><DashboardOutlined style={{ color: '#8ba3c1' }} /><Text>Other</Text></Space>
                  <Text strong style={{ fontSize: 20 }}>{typeCounts.network_device + typeCounts.other}</Text>
                </div>
              )}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Health Score / SLA"
            extra={<Tag color={slaTagColor}>{slaTagText}</Tag>}
          >
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={slaPercent}
                strokeColor={slaStrokeColor}
                format={(pct) => `${pct}%`}
              />
              <div style={{ marginTop: '16px' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Avg CPU"
                      value={healthMetrics?.averageCpuUtilization ?? 0}
                      precision={1}
                      suffix="%"
                      valueStyle={{
                        fontSize: '18px',
                        color:
                          (healthMetrics?.averageCpuUtilization ?? 0) > 80
                            ? '#f5222d'
                            : (healthMetrics?.averageCpuUtilization ?? 0) > 60
                              ? '#faad14'
                              : '#52c41a',
                      }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Avg Memory"
                      value={healthMetrics?.averageMemoryUtilization ?? 0}
                      precision={1}
                      suffix="%"
                      valueStyle={{
                        fontSize: '18px',
                        color:
                          (healthMetrics?.averageMemoryUtilization ?? 0) > 80
                            ? '#f5222d'
                            : (healthMetrics?.averageMemoryUtilization ?? 0) > 60
                              ? '#faad14'
                              : '#52c41a',
                      }}
                    />
                  </Col>
                </Row>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Recent Critical Alerts"
            extra={
              <Button type="link" size="small" onClick={() => navigate('/alerts')}>
                View All
              </Button>
            }
          >
            {recentAlerts.length > 0 ? (
              <List
                size="small"
                dataSource={recentAlerts.slice(0, 5)}
                renderItem={(alert: any) => (
                  <List.Item style={{ padding: '6px 0' }}>
                    <Space size="small" style={{ width: '100%' }}>
                      <Tag
                        color={alert.event?.severity === 'critical' ? 'red' : 'orange'}
                        style={{ margin: 0, minWidth: 70, textAlign: 'center' }}
                      >
                        {(alert.event?.severity || 'info').toUpperCase()}
                      </Tag>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <Text ellipsis style={{ fontSize: 13 }}>
                          {alert.event?.title || 'Alert'}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {alert.event?.asset?.name || 'Unknown device'} &middot; {formatTimeAgo(alert.createdAt)}
                        </Text>
                      </div>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 28, color: '#52c41a' }} />
                <br />
                <Text type="secondary">No critical alerts</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Top 10 Devices by Bandwidth */}
      <Card
        title="Top 10 Devices by Bandwidth Utilization"
        extra={
          <Select
            value={timeRange}
            onChange={(val) => setTimeRange(val)}
            style={{ width: 140 }}
            options={[
              { label: 'Last 24h', value: '24h' },
              { label: 'Last 7d', value: '7d' },
              { label: 'Last 30d', value: '30d' },
            ]}
          />
        }
        style={{ marginBottom: '24px' }}
      >
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                type="number"
                tick={{ fill: 'rgba(255,255,255,0.65)' }}
                label={{
                  value: 'Mbps',
                  position: 'insideBottomRight',
                  offset: -5,
                  style: { fill: 'rgba(255,255,255,0.45)' },
                }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 12 }}
                width={140}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f1f3d',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.85)' }}
                itemStyle={{ color: 'rgba(255,255,255,0.85)' }}
              />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.65)' }} />
              <Bar dataKey="bandwidth" fill="#1890ff" name="Bandwidth (Mbps)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="cpu" fill="#52c41a" name="CPU %" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Text type="secondary">No performance data available</Text>
          </div>
        )}
      </Card>

      {/* Devices Table */}
      <Card
        title={tableTitle}
        extra={
          <Space>
            {selectedStatus !== 'all' && (
              <Button size="small" onClick={() => handleStatusFilter('all')}>
                Show All
              </Button>
            )}
            <Button
              icon={<SyncOutlined spin={loading || filterLoading} />}
              onClick={fetchDashboardData}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={devices}
          loading={loading || filterLoading}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} devices` }}
        />
      </Card>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'just now';
}
