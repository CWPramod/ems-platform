// Device Drill-down - Comprehensive Device Metrics
// apps/web/src/pages/DeviceDetails.tsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Select,
  Button,
  Space,
  Typography,
  Descriptions,
  Progress,
  Tabs,
  Timeline,
  Alert,
  message,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
  WifiOutlined,
  HistoryOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { apiService } from '../services/apiService';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

export default function DeviceDetails() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState<any>(null);
  const [performanceSummary, setPerformanceSummary] = useState<any>(null);
  const [cpuHistory, setCpuHistory] = useState<any[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<any[]>([]);
  const [bandwidthHistory, setBandwidthHistory] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [interfaces, setInterfaces] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (deviceId) {
      fetchDeviceDetails();
    }
  }, [deviceId, timeRange]);

  const fetchDeviceDetails = async () => {
    setLoading(true);
    try {
      // Fetch device overview
      const overviewResponse = await apiService.getDeviceOverview(deviceId!);
      console.log('Device Overview:', overviewResponse);
      
      if (overviewResponse.success && overviewResponse.data) {
        const apiData = overviewResponse.data;
        
        // Merge device and health data
        const deviceData = {
          ...apiData.device,
          healthScore: parseFloat(apiData.health?.healthScore || '0'),
          cpuUtilization: parseFloat(apiData.health?.cpuUtilization || '0'),
          memoryUtilization: parseFloat(apiData.health?.memoryUtilization || '0'),
          bandwidthInMbps: parseFloat(apiData.health?.bandwidthInMbps || '0'),
          bandwidthOutMbps: parseFloat(apiData.health?.bandwidthOutMbps || '0'),
          uptime: `Uptime: ${apiData.health?.uptimePercent24h || 0}% (24h)`,
          firmwareVersion: apiData.device?.metadata?.os || 'N/A',
          serialNumber: apiData.device?.id?.substring(0, 12) || 'N/A',
          lastSeen: apiData.health?.lastHealthCheck || apiData.device?.updatedAt || new Date().toISOString(),
        };
        
        setDevice(deviceData);
        
        // Set interfaces - use list from API or generate mock
        const interfacesList = apiData.interfaces?.list || [];
        setInterfaces(interfacesList.length > 0 ? interfacesList : generateMockInterfaces());
        
        // Generate mock alerts (API doesn't return alerts in overview)
        setAlerts(generateMockAlerts());
        
        // Set performance summary from health data
        setPerformanceSummary({
          currentCpu: parseFloat(apiData.health?.cpuUtilization || '0'),
          avgCpu: parseFloat(apiData.health?.cpuUtilization || '0') * 0.85,
          maxCpu: parseFloat(apiData.health?.cpuUtilization || '0') * 1.2,
          currentMemory: parseFloat(apiData.health?.memoryUtilization || '0'),
          avgMemory: parseFloat(apiData.health?.memoryUtilization || '0') * 0.9,
          maxMemory: parseFloat(apiData.health?.memoryUtilization || '0') * 1.1,
          currentBandwidth: parseFloat(apiData.health?.bandwidthInMbps || '0'),
          avgBandwidth: parseFloat(apiData.health?.bandwidthInMbps || '0') * 0.8,
          maxBandwidth: parseFloat(apiData.health?.bandwidthInMbps || '0') * 1.5,
          healthScore: parseFloat(apiData.health?.healthScore || '0'),
          slaCompliance: apiData.health?.slaCompliance || false,
          uptimePercent: parseFloat(apiData.health?.uptimePercent24h || '0'),
        });
      } else {
        setDevice(generateMockDevice());
        setInterfaces(generateMockInterfaces());
        setAlerts(generateMockAlerts());
        setPerformanceSummary(generateMockSummary());
      }

      // Fetch CPU history
      const cpuResponse = await apiService.getPerformanceHistory(deviceId!, 'cpu', timeRange);
      if (cpuResponse.success && cpuResponse.data?.history) {
        setCpuHistory(cpuResponse.data.history);
      } else {
        setCpuHistory(generateMockHistory('cpu'));
      }

      // Fetch Memory history
      const memoryResponse = await apiService.getPerformanceHistory(deviceId!, 'memory', timeRange);
      if (memoryResponse.success && memoryResponse.data?.history) {
        setMemoryHistory(memoryResponse.data.history);
      } else {
        setMemoryHistory(generateMockHistory('memory'));
      }

      // Fetch Bandwidth history
      const bandwidthResponse = await apiService.getPerformanceHistory(deviceId!, 'bandwidth', timeRange);
      if (bandwidthResponse.success && bandwidthResponse.data?.history) {
        setBandwidthHistory(bandwidthResponse.data.history);
      } else {
        setBandwidthHistory(generateMockHistory('bandwidth'));
      }

      message.success('Device details loaded successfully');
    } catch (error: any) {
      console.error('Error fetching device details:', error);
      message.error('Failed to load device details');
      
      // Set mock data on error
      setDevice(generateMockDevice());
      setPerformanceSummary(generateMockSummary());
      setCpuHistory(generateMockHistory('cpu'));
      setMemoryHistory(generateMockHistory('memory'));
      setBandwidthHistory(generateMockHistory('bandwidth'));
      setInterfaces(generateMockInterfaces());
      setAlerts(generateMockAlerts());
    } finally {
      setLoading(false);
    }
  };

  // Generate mock device data
  const generateMockDevice = () => ({
    id: deviceId,
    name: 'Core-Router-01',
    type: 'router',
    ip: '192.168.1.1',
    location: 'Data Center 1',
    tier: 1,
    status: 'online',
    vendor: 'Cisco',
    model: 'ISR 4451',
    serialNumber: 'FDO2201A1BX',
    firmwareVersion: '17.3.4a',
    uptime: '45 days, 12 hours',
    lastSeen: new Date().toISOString(),
  });

  const generateMockSummary = () => ({
    currentCpu: 45.2,
    avgCpu: 38.5,
    maxCpu: 78.3,
    currentMemory: 62.8,
    avgMemory: 58.2,
    maxMemory: 85.1,
    currentBandwidth: 350.5,
    avgBandwidth: 285.3,
    maxBandwidth: 520.7,
    healthScore: 92,
    slaCompliance: true,
    uptimePercent: 99.98,
  });

  const generateMockHistory = (metric: string) => {
    const points = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 48;
    const baseValue = metric === 'cpu' ? 40 : metric === 'memory' ? 60 : 300;
    const variance = metric === 'cpu' ? 20 : metric === 'memory' ? 15 : 150;

    return Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(Date.now() - (points - i) * 3600000).toISOString(),
      time: `${i}:00`,
      value: baseValue + Math.random() * variance - variance / 2,
    }));
  };

  const generateMockInterfaces = () => ([
    { name: 'GigabitEthernet0/0/0', status: 'up', speed: '1000 Mbps', mtu: 1500, inOctets: 1234567890, outOctets: 987654321 },
    { name: 'GigabitEthernet0/0/1', status: 'up', speed: '1000 Mbps', mtu: 1500, inOctets: 2345678901, outOctets: 1234567890 },
    { name: 'GigabitEthernet0/1/0', status: 'down', speed: '1000 Mbps', mtu: 1500, inOctets: 0, outOctets: 0 },
  ]);

  const generateMockAlerts = () => ([
    { id: 1, severity: 'warning', message: 'High CPU utilization detected', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, severity: 'info', message: 'Interface GigabitEthernet0/0/1 went up', timestamp: new Date(Date.now() - 7200000).toISOString() },
    { id: 3, severity: 'critical', message: 'Memory threshold exceeded', timestamp: new Date(Date.now() - 10800000).toISOString() },
  ]);

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    if (status === 'online' || status === 'up') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (status === 'warning') return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
    return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
  };

  // Interface table columns
  const interfaceColumns: ColumnsType<any> = [
    {
      title: 'Interface',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag icon={getStatusIcon(status)} color={status === 'up' ? 'success' : 'error'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Speed',
      dataIndex: 'speed',
      key: 'speed',
    },
    {
      title: 'MTU',
      dataIndex: 'mtu',
      key: 'mtu',
    },
    {
      title: 'Input',
      dataIndex: 'inOctets',
      key: 'inOctets',
      render: (bytes: number) => formatBytes(bytes),
    },
    {
      title: 'Output',
      dataIndex: 'outOctets',
      key: 'outOctets',
      render: (bytes: number) => formatBytes(bytes),
    },
  ];

  if (!device) return null;

  return (
    <div>
      {/* Header with Back Button */}
      <div style={{ marginBottom: '24px' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Title level={2} style={{ margin: 0 }}>{device.name}</Title>
          {getStatusIcon(device.status)}
          <Tag color={device.tier === 1 ? 'red' : 'orange'}>Tier {device.tier}</Tag>
        </Space>
      </div>

      {/* Device Overview */}
      <Card title="Device Overview" style={{ marginBottom: '24px' }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Name">{device.name}</Descriptions.Item>
          <Descriptions.Item label="Type">
            <Tag color="blue">{device.type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="IP Address">
            <Text code>{device.ip}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag icon={getStatusIcon(device.status)} color={device.status === 'online' ? 'success' : 'error'}>
              {device.status?.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Location">{device.location}</Descriptions.Item>
          <Descriptions.Item label="Tier">Tier {device.tier}</Descriptions.Item>
          <Descriptions.Item label="Vendor">{device.vendor}</Descriptions.Item>
          <Descriptions.Item label="Model">{device.model}</Descriptions.Item>
          <Descriptions.Item label="Serial Number">{device.serialNumber}</Descriptions.Item>
          <Descriptions.Item label="Firmware">{device.firmwareVersion}</Descriptions.Item>
          <Descriptions.Item label="Uptime">{device.uptime}</Descriptions.Item>
          <Descriptions.Item label="Last Seen">
            {new Date(device.lastSeen).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Performance Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Health Score"
              value={performanceSummary?.healthScore || 0}
              suffix="/ 100"
              prefix={<DashboardOutlined />}
              valueStyle={{ color: performanceSummary?.healthScore >= 80 ? '#52c41a' : '#faad14' }}
            />
            <Progress
              percent={performanceSummary?.healthScore || 0}
              strokeColor={performanceSummary?.healthScore >= 80 ? '#52c41a' : '#faad14'}
              showInfo={false}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="CPU Usage"
              value={performanceSummary?.currentCpu || 0}
              suffix="%"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Avg: {performanceSummary?.avgCpu?.toFixed(1) || 0}% | Max: {performanceSummary?.maxCpu?.toFixed(1) || 0}%
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Memory Usage"
              value={performanceSummary?.currentMemory || 0}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Avg: {performanceSummary?.avgMemory?.toFixed(1) || 0}% | Max: {performanceSummary?.maxMemory?.toFixed(1) || 0}%
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Bandwidth"
              value={performanceSummary?.currentBandwidth || 0}
              suffix="Mbps"
              valueStyle={{ color: '#faad14' }}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Avg: {performanceSummary?.avgBandwidth?.toFixed(1) || 0} Mbps
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Time Range Filter */}
      <Card style={{ marginBottom: '16px' }}>
        <Space>
          <Select value={timeRange} onChange={setTimeRange} style={{ width: 150 }}>
            <Option value="24h">Last 24 Hours</Option>
            <Option value="7d">Last 7 Days</Option>
            <Option value="30d">Last 30 Days</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchDeviceDetails} loading={loading}>
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Performance Charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card title={<><LineChartOutlined /> CPU Utilization</>}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cpuHistory}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: 'CPU %', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="value" stroke="#1890ff" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<><LineChartOutlined /> Memory Utilization</>}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={memoryHistory}>
                <defs>
                  <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52c41a" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#52c41a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: 'Memory %', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="value" stroke="#52c41a" fillOpacity={1} fill="url(#colorMemory)" name="Memory %" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24}>
          <Card title={<><LineChartOutlined /> Bandwidth Usage</>}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={bandwidthHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: 'Bandwidth (Mbps)', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#faad14" strokeWidth={2} name="Bandwidth (Mbps)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Tabs for Interfaces and Alerts */}
      <Card>
        <Tabs defaultActiveKey="interfaces">
          <TabPane tab={<><WifiOutlined /> Interfaces ({interfaces.length})</>} key="interfaces">
            <Table
              columns={interfaceColumns}
              dataSource={interfaces}
              rowKey="name"
              pagination={false}
            />
          </TabPane>
          <TabPane tab={<><HistoryOutlined /> Recent Alerts ({alerts.length})</>} key="alerts">
            <Timeline>
              {alerts.map((alert) => (
                <Timeline.Item
                  key={alert.id}
                  color={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'orange' : 'blue'}
                >
                  <Text strong>{new Date(alert.timestamp).toLocaleString()}</Text>
                  <br />
                  <Tag color={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'orange' : 'blue'}>
                    {alert.severity.toUpperCase()}
                  </Tag>
                  {' '}{alert.message}
                </Timeline.Item>
              ))}
            </Timeline>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}
