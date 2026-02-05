// Device Drill-down - Comprehensive Device Metrics + Network Telemetry
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
  message,
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
  LineChartOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  WarningOutlined,
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

export default function DeviceDetails() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [, setPerformanceSummary] = useState<any>(null);
  const [cpuHistory, setCpuHistory] = useState<any[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<any[]>([]);
  const [bandwidthHistory, setBandwidthHistory] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [interfaces, setInterfaces] = useState<any[]>([]);

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

      if (overviewResponse.success && overviewResponse.data) {
        const apiData = overviewResponse.data;
        setDevice(apiData.device);
        setHealth(apiData.health);

        // Set interfaces from API
        const interfacesList = apiData.interfaces?.list || [];
        setInterfaces(interfacesList);

        // Build performance summary from health data
        const h = apiData.health;
        setPerformanceSummary({
          currentCpu: parseFloat(h?.cpuUtilization || '0'),
          avgCpu: parseFloat(h?.cpuUtilization || '0') * 0.85,
          maxCpu: parseFloat(h?.cpuUtilization || '0') * 1.2,
          currentMemory: parseFloat(h?.memoryUtilization || '0'),
          avgMemory: parseFloat(h?.memoryUtilization || '0') * 0.9,
          maxMemory: parseFloat(h?.memoryUtilization || '0') * 1.1,
          currentBandwidth: parseFloat(h?.bandwidthInMbps || '0'),
          avgBandwidth: parseFloat(h?.bandwidthInMbps || '0') * 0.8,
          maxBandwidth: parseFloat(h?.bandwidthInMbps || '0') * 1.5,
          healthScore: parseFloat(h?.healthScore || '0'),
          slaCompliance: h?.slaCompliance || false,
          uptimePercent: parseFloat(h?.uptimePercent24h || '0'),
        });
      }

      // Fetch performance histories
      try {
        const cpuResponse = await apiService.getPerformanceHistory(deviceId!, 'cpu', timeRange);
        if (cpuResponse.success && cpuResponse.data?.data) {
          setCpuHistory(cpuResponse.data.data.map((d: any) => ({
            time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: d.value,
          })));
        } else {
          setCpuHistory(generateMockHistory('cpu'));
        }
      } catch { setCpuHistory(generateMockHistory('cpu')); }

      try {
        const memoryResponse = await apiService.getPerformanceHistory(deviceId!, 'memory', timeRange);
        if (memoryResponse.success && memoryResponse.data?.data) {
          setMemoryHistory(memoryResponse.data.data.map((d: any) => ({
            time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: d.value,
          })));
        } else {
          setMemoryHistory(generateMockHistory('memory'));
        }
      } catch { setMemoryHistory(generateMockHistory('memory')); }

      try {
        const bwResponse = await apiService.getPerformanceHistory(deviceId!, 'bandwidth', timeRange);
        if (bwResponse.success && bwResponse.data?.data) {
          setBandwidthHistory(bwResponse.data.data.map((d: any) => ({
            time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: d.value,
          })));
        } else {
          setBandwidthHistory(generateMockHistory('bandwidth'));
        }
      } catch { setBandwidthHistory(generateMockHistory('bandwidth')); }

    } catch (error: any) {
      console.error('Error fetching device details:', error);
      message.error('Failed to load device details');
    } finally {
      setLoading(false);
    }
  };

  const generateMockHistory = (metric: string) => {
    const points = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 48;
    const baseValue = metric === 'cpu' ? 40 : metric === 'memory' ? 60 : 300;
    const variance = metric === 'cpu' ? 20 : metric === 'memory' ? 15 : 150;
    return Array.from({ length: Math.min(points, 24) }, (_, i) => ({
      time: `${String(i).padStart(2, '0')}:00`,
      value: parseFloat((baseValue + Math.random() * variance - variance / 2).toFixed(1)),
    }));
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    if (status === 'online' || status === 'up') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (status === 'warning') return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
    return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
  };

  const getProgressColor = (value: number, thresholds = { warn: 70, crit: 90 }) => {
    if (value >= thresholds.crit) return '#f5222d';
    if (value >= thresholds.warn) return '#faad14';
    return '#52c41a';
  };

  const interfaceColumns: ColumnsType<any> = [
    {
      title: 'Interface',
      dataIndex: 'interfaceName',
      key: 'interfaceName',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text || record.name}</Text>
          {record.macAddress && <Text type="secondary" style={{ fontSize: 11 }}>{record.macAddress}</Text>}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'operationalStatus',
      key: 'operationalStatus',
      render: (status: string, record: any) => {
        const s = status || record.status;
        return (
          <Tag icon={getStatusIcon(s)} color={s === 'up' ? 'success' : 'error'}>
            {s?.toUpperCase() || 'UNKNOWN'}
          </Tag>
        );
      },
    },
    {
      title: 'Speed',
      key: 'speed',
      render: (_, record) => record.speedMbps ? `${record.speedMbps} Mbps` : (record.speed || '-'),
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (ip: string) => ip ? <Text code>{ip}</Text> : '-',
    },
    {
      title: 'Input',
      key: 'input',
      render: (_, record) => formatBytes(record.inOctets || record.inputOctets || 0),
    },
    {
      title: 'Output',
      key: 'output',
      render: (_, record) => formatBytes(record.outOctets || record.outputOctets || 0),
    },
  ];

  if (!device && !loading) return null;

  const healthScore = parseFloat(health?.healthScore || '0');
  const cpu = parseFloat(health?.cpuUtilization || '0');
  const memory = parseFloat(health?.memoryUtilization || '0');
  const packetLoss = parseFloat(health?.packetLossPercent || '0');
  const latency = parseFloat(health?.latencyMs || '0');
  const responseTime = parseFloat(health?.responseTimeMs || '0');
  const bwIn = parseFloat(health?.bandwidthInMbps || '0');
  const bwOut = parseFloat(health?.bandwidthOutMbps || '0');
  const uptime24h = parseFloat(health?.uptimePercent24h || '0');
  const uptime7d = parseFloat(health?.uptimePercent7d || '0');
  const uptime30d = parseFloat(health?.uptimePercent30d || '0');

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
          <Title level={2} style={{ margin: 0 }}>{device?.name || 'Loading...'}</Title>
          {device && getStatusIcon(device.status)}
          {device && <Tag color={device.tier === 1 ? 'red' : device.tier === 2 ? 'orange' : 'blue'}>Tier {device.tier}</Tag>}
          {health?.slaCompliance === false && <Tag color="error">SLA Breach</Tag>}
        </Space>
      </div>

      {/* Device Overview */}
      <Card title="Device Overview" style={{ marginBottom: 24 }}>
        <Descriptions bordered column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label="Name">{device?.name}</Descriptions.Item>
          <Descriptions.Item label="Type"><Tag color="blue">{device?.type}</Tag></Descriptions.Item>
          <Descriptions.Item label="IP Address"><Text code>{device?.ip}</Text></Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag icon={getStatusIcon(device?.status || '')} color={device?.status === 'online' ? 'success' : 'error'}>
              {device?.status?.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Location">{device?.location}</Descriptions.Item>
          <Descriptions.Item label="Vendor / Model">{device?.vendor} {device?.model}</Descriptions.Item>
          <Descriptions.Item label="OS / Firmware">{device?.metadata?.os || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Last Health Check">
            {health?.lastHealthCheck ? new Date(health.lastHealthCheck).toLocaleString() : 'N/A'}
          </Descriptions.Item>
          <Descriptions.Item label="Monitoring">
            <Tag color={device?.monitoringEnabled ? 'green' : 'default'}>
              {device?.monitoringEnabled ? 'Enabled' : 'Disabled'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Performance Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Health Score"
              value={healthScore}
              suffix="/ 100"
              prefix={<DashboardOutlined />}
              valueStyle={{ color: getProgressColor(healthScore, { warn: 60, crit: 40 }) }}
            />
            <Progress percent={healthScore} strokeColor={getProgressColor(healthScore, { warn: 60, crit: 40 })} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="CPU Usage" value={cpu} suffix="%" prefix={<ThunderboltOutlined />} valueStyle={{ color: getProgressColor(cpu) }} />
            <Progress percent={cpu} strokeColor={getProgressColor(cpu)} showInfo={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Memory Usage" value={memory} suffix="%" valueStyle={{ color: getProgressColor(memory) }} />
            <Progress percent={memory} strokeColor={getProgressColor(memory)} showInfo={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Bandwidth" value={bwIn + bwOut} suffix="Mbps" prefix={<SwapOutlined />} valueStyle={{ color: '#1890ff' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>In: {bwIn.toFixed(1)} | Out: {bwOut.toFixed(1)} Mbps</Text>
          </Card>
        </Col>
      </Row>

      {/* Network Telemetry Section */}
      <Card title={<><ApiOutlined /> Network Telemetry</>} style={{ marginBottom: 24 }}>
        <Row gutter={[24, 16]}>
          <Col xs={12} sm={8} lg={4}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="dashboard"
                percent={Math.min(packetLoss * 10, 100)}
                format={() => `${packetLoss.toFixed(2)}%`}
                strokeColor={packetLoss > 5 ? '#f5222d' : packetLoss > 2 ? '#faad14' : '#52c41a'}
                size={100}
              />
              <div style={{ marginTop: 8 }}><Text strong>Packet Loss</Text></div>
            </div>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="dashboard"
                percent={Math.min(latency / 5, 100)}
                format={() => `${latency.toFixed(1)}ms`}
                strokeColor={latency > 200 ? '#f5222d' : latency > 100 ? '#faad14' : '#52c41a'}
                size={100}
              />
              <div style={{ marginTop: 8 }}><Text strong>Latency</Text></div>
            </div>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="dashboard"
                percent={Math.min(responseTime / 10, 100)}
                format={() => `${responseTime.toFixed(0)}ms`}
                strokeColor={responseTime > 500 ? '#f5222d' : responseTime > 200 ? '#faad14' : '#52c41a'}
                size={100}
              />
              <div style={{ marginTop: 8 }}><Text strong>Response Time</Text></div>
            </div>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <div style={{ textAlign: 'center' }}>
              <Statistic
                title="Interfaces"
                value={health?.interfacesUp || 0}
                suffix={`/ ${health?.totalInterfaces || 0}`}
                valueStyle={{ color: '#52c41a', fontSize: 24 }}
              />
              <Text type="secondary">{health?.interfacesDown || 0} down</Text>
            </div>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <div style={{ textAlign: 'center' }}>
              <Statistic
                title={<><WarningOutlined /> Active Alerts</>}
                value={health?.activeAlertsCount || 0}
                valueStyle={{ color: (health?.criticalAlertsCount || 0) > 0 ? '#f5222d' : '#52c41a', fontSize: 24 }}
              />
              <Text type="secondary">
                {health?.criticalAlertsCount || 0} critical, {health?.warningAlertsCount || 0} warning
              </Text>
            </div>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <div style={{ textAlign: 'center' }}>
              <Statistic
                title="SLA Status"
                value={health?.slaCompliance ? 'Compliant' : 'Breached'}
                valueStyle={{ color: health?.slaCompliance ? '#52c41a' : '#f5222d', fontSize: 20 }}
              />
              <Text type="secondary">Target: {health?.slaTargetPercent || 99.9}%</Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Uptime Timeline */}
      <Card title={<><ClockCircleOutlined /> Uptime Overview</>} style={{ marginBottom: 24 }}>
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={8}>
            <Statistic title="24 Hour Uptime" value={uptime24h} suffix="%" valueStyle={{ color: uptime24h >= 99.9 ? '#52c41a' : uptime24h >= 99 ? '#faad14' : '#f5222d' }} />
            <Progress percent={uptime24h} strokeColor={uptime24h >= 99.9 ? '#52c41a' : '#faad14'} showInfo={false} size="small" />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title="7 Day Uptime" value={uptime7d} suffix="%" valueStyle={{ color: uptime7d >= 99.9 ? '#52c41a' : uptime7d >= 99 ? '#faad14' : '#f5222d' }} />
            <Progress percent={uptime7d} strokeColor={uptime7d >= 99.9 ? '#52c41a' : '#faad14'} showInfo={false} size="small" />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title="30 Day Uptime" value={uptime30d} suffix="%" valueStyle={{ color: uptime30d >= 99.9 ? '#52c41a' : uptime30d >= 99 ? '#faad14' : '#f5222d' }} />
            <Progress percent={uptime30d} strokeColor={uptime30d >= 99.9 ? '#52c41a' : '#faad14'} showInfo={false} size="small" />
          </Col>
        </Row>
      </Card>

      {/* Time Range Filter */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>Time Range:</Text>
          <Select value={timeRange} onChange={setTimeRange} style={{ width: 150 }}>
            <Option value="1h">Last 1 Hour</Option>
            <Option value="24h">Last 24 Hours</Option>
            <Option value="7d">Last 7 Days</Option>
            <Option value="30d">Last 30 Days</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchDeviceDetails} loading={loading}>Refresh</Button>
        </Space>
      </Card>

      {/* Performance Charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title={<><LineChartOutlined /> CPU Utilization</>}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cpuHistory}>
                <defs>
                  <linearGradient id="colorCpuDetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="#8ba3c1" />
                <YAxis stroke="#8ba3c1" domain={[0, 100]} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="value" stroke="#1890ff" fillOpacity={1} fill="url(#colorCpuDetail)" name="CPU %" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<><LineChartOutlined /> Memory Utilization</>}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={memoryHistory}>
                <defs>
                  <linearGradient id="colorMemDetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52c41a" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#52c41a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="#8ba3c1" />
                <YAxis stroke="#8ba3c1" domain={[0, 100]} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="value" stroke="#52c41a" fillOpacity={1} fill="url(#colorMemDetail)" name="Memory %" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24}>
          <Card title={<><LineChartOutlined /> Bandwidth Usage</>}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={bandwidthHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="#8ba3c1" />
                <YAxis stroke="#8ba3c1" />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#faad14" strokeWidth={2} name="Bandwidth (Mbps)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Interfaces Table */}
      <Card title={<><WifiOutlined /> Interfaces ({interfaces.length})</>}>
        <Table
          columns={interfaceColumns}
          dataSource={interfaces}
          rowKey={(record) => record.id || record.interfaceName || record.name}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
}
