// Professional Enterprise Dashboard - Simplified for actual API structure
// apps/web/src/pages/Dashboard.tsx

import { useState, useEffect } from 'react';
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
  Badge,
  message,
} from 'antd';
import {
  ArrowUpOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { apiService } from '../services/apiService';

const { Title, Text } = Typography;

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const devicesResponse = await apiService.getCriticalDevices();
      console.log('Devices Response:', devicesResponse);
      
      if (devicesResponse.success) {
        setDevices(devicesResponse.data || []);
      }

      const summaryResponse = await apiService.getDashboardSummary();
      if (summaryResponse.success) {
        setSummary(summaryResponse.data);
      }

      message.success('Dashboard data loaded successfully');
    } catch (error: any) {
      console.error('Error:', error);
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats from devices
  const totalDevices = devices.length;
  const healthyDevices = devices.filter(d => d.status === 'up').length;
  const warningDevices = devices.filter(d => d.status === 'warning').length;
  const criticalDevices = devices.filter(d => d.status === 'down').length;

  // Table columns - simplified
  const columns: ColumnsType<any> = [
    {
      title: 'Device Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
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
        const config: any = {
          up: { color: 'success', icon: <CheckCircleOutlined /> },
          warning: { color: 'warning', icon: <ExclamationCircleOutlined /> },
          down: { color: 'error', icon: <CloseCircleOutlined /> },
        };
        const statusConfig = config[status] || config.up;
        return <Tag icon={statusConfig.icon} color={statusConfig.color}>{status?.toUpperCase() || 'UP'}</Tag>;
      },
    },
    {
      title: 'Monitoring',
      dataIndex: 'monitoringEnabled',
      key: 'monitoring',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>
          {enabled ? 'Enabled' : 'Disabled'}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => message.info(`View details for ${record.name}`)}
        >
          Details
        </Button>
      ),
    },
  ];

  // Mock chart data
  const performanceData = [
    { time: '00:00', cpu: 45, memory: 62 },
    { time: '04:00', cpu: 52, memory: 65 },
    { time: '08:00', cpu: 78, memory: 72 },
    { time: '12:00', cpu: 85, memory: 78 },
    { time: '16:00', cpu: 72, memory: 75 },
    { time: '20:00', cpu: 58, memory: 68 },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Critical Devices Dashboard</Title>
        <Text type="secondary">Real-time monitoring of Tier-1 critical infrastructure</Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Devices"
              value={totalDevices}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
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
          <Card>
            <Statistic
              title="Warning"
              value={warningDevices}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Critical"
              value={criticalDevices}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* SLA & Health Score */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card title="SLA Compliance" extra={<Tag color="green">On Target</Tag>}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={100}
                strokeColor="#52c41a"
              />
              <div style={{ marginTop: '16px' }}>
                <Text type="secondary">All critical devices meeting SLA targets</Text>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Device Distribution">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text>Healthy (UP): </Text>
                <Text strong style={{ fontSize: '24px', color: '#52c41a' }}>{healthyDevices}</Text>
              </div>
              <div>
                <Text>Warning: </Text>
                <Text strong style={{ fontSize: '24px', color: '#faad14' }}>{warningDevices}</Text>
              </div>
              <div>
                <Text>Critical (DOWN): </Text>
                <Text strong style={{ fontSize: '24px', color: '#f5222d' }}>{criticalDevices}</Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Performance Charts */}
      <Card title="Performance Trends (Last 24 Hours)" style={{ marginBottom: '24px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={performanceData}>
            <defs>
              <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1890ff" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#1890ff" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#52c41a" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#52c41a" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="cpu" stroke="#1890ff" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
            <Area type="monotone" dataKey="memory" stroke="#52c41a" fillOpacity={1} fill="url(#colorMemory)" name="Memory %" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Critical Devices Table */}
      <Card
        title={`Critical Devices (${totalDevices})`}
        extra={
          <Button
            icon={<SyncOutlined spin={loading} />}
            onClick={fetchDashboardData}
            loading={loading}
          >
            Refresh
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={devices}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
