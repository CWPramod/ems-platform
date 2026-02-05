// Professional Enterprise Dashboard - Phase 3 Enhanced
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
  AlertOutlined,
} from '@ant-design/icons';
import {
  AreaChart,
  Area,
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
  cpu: number;
  memory: number;
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

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [devicesRes, summaryRes, slaRes, topCpuRes] = await Promise.allSettled([
        apiService.getCriticalDevices(),
        apiService.getDashboardSummary(),
        apiService.getSLACompliance(),
        apiService.getTopDevicesByMetric('cpu', 10),
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

      if (topCpuRes.status === 'fulfilled' && topCpuRes.value.success) {
        const topDevices = topCpuRes.value.data || [];
        const mapped: ChartDataPoint[] = topDevices.map((item: any) => ({
          name: item.device || item.assetId || 'Unknown',
          cpu: typeof item.value === 'number' ? Math.round(item.value * 10) / 10 : 0,
          memory: item.health?.memoryUtilization
            ? Math.round(item.health.memoryUtilization * 10) / 10
            : 0,
        }));
        setChartData(mapped);
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

  // Compute counts from summary byStatus (server-side totals) when available
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
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: 'IP Address',
      dataIndex: 'ip',
      key: 'ip',
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      render: (tier: number) => <Tag color="purple">Tier {tier}</Tag>,
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
      title: 'Monitoring',
      dataIndex: 'monitoringEnabled',
      key: 'monitoring',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? 'Enabled' : 'Disabled'}</Tag>
      ),
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

  // Determine SLA progress color
  const slaStrokeColor =
    slaPercent >= 90 ? '#52c41a' : slaPercent >= 70 ? '#faad14' : '#f5222d';
  const slaTagColor = slaPercent >= 90 ? 'green' : slaPercent >= 70 ? 'warning' : 'error';
  const slaTagText = slaPercent >= 90 ? 'On Target' : slaPercent >= 70 ? 'Degraded' : 'Critical';

  // Table title based on filter
  const tableTitle =
    selectedStatus === 'all'
      ? `Critical Devices (${devices.length})`
      : `${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Devices (${devices.length})`;

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Critical Devices Dashboard</Title>
        <Text type="secondary">Real-time monitoring of Tier-1 critical infrastructure</Text>
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
              title="Healthy"
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
              title="Critical"
              value={criticalDevices}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* SLA & Health Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card
            title="Health Score / SLA Compliance"
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
                <Space size="large">
                  <Statistic
                    title="Active Alerts"
                    value={healthMetrics?.totalActiveAlerts ?? 0}
                    prefix={<AlertOutlined />}
                    valueStyle={{ fontSize: '18px', color: '#faad14' }}
                  />
                  <Statistic
                    title="Critical Alerts"
                    value={healthMetrics?.totalCriticalAlerts ?? 0}
                    prefix={<CloseCircleOutlined />}
                    valueStyle={{ fontSize: '18px', color: '#f5222d' }}
                  />
                </Space>
              </div>
              {sla && (
                <div style={{ marginTop: '12px' }}>
                  <Text type="secondary">
                    SLA: {sla.compliant ?? 0} compliant / {sla.total ?? 0} total devices
                    {sla.nonCompliant > 0 && (
                      <span style={{ color: '#f5222d' }}> ({sla.nonCompliant} non-compliant)</span>
                    )}
                  </Text>
                </div>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Device Distribution & Health Metrics">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text>Online: </Text>
                <Text strong style={{ fontSize: '24px', color: '#52c41a' }}>
                  {healthyDevices}
                </Text>
              </div>
              <div>
                <Text>Warning: </Text>
                <Text strong style={{ fontSize: '24px', color: '#faad14' }}>
                  {warningDevices}
                </Text>
              </div>
              <div>
                <Text>Offline / Critical: </Text>
                <Text strong style={{ fontSize: '24px', color: '#f5222d' }}>
                  {criticalDevices}
                </Text>
              </div>
              <div
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  paddingTop: '16px',
                  marginTop: '4px',
                }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Avg CPU"
                      value={healthMetrics?.averageCpuUtilization ?? 0}
                      precision={1}
                      suffix="%"
                      valueStyle={{
                        fontSize: '20px',
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
                        fontSize: '20px',
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
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Performance Charts */}
      <Card
        title="Top Devices by CPU Utilization"
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
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1890ff" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#52c41a" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 12 }}
                angle={-30}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.65)' }}
                domain={[0, 100]}
                label={{
                  value: 'Utilization %',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'rgba(255,255,255,0.45)' },
                }}
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
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="#1890ff"
                fillOpacity={1}
                fill="url(#colorCpu)"
                name="CPU %"
              />
              <Area
                type="monotone"
                dataKey="memory"
                stroke="#52c41a"
                fillOpacity={1}
                fill="url(#colorMemory)"
                name="Memory %"
              />
            </AreaChart>
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
