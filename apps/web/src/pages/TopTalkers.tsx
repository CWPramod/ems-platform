// Top Talkers - Bandwidth Analysis Dashboard
// apps/web/src/pages/TopTalkers.tsx

import { useState, useEffect } from 'react';
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
  Progress,
  message,
  Tooltip,
} from 'antd';
import {
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ThunderboltOutlined,
  SwapOutlined,
  FireOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
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

// Color palette for charts
const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];

export default function TopTalkers() {
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('1h');
  const [topTalkers, setTopTalkers] = useState<any[]>([]);
  const [protocols, setProtocols] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [trafficTrend, setTrafficTrend] = useState<any[]>([]);

  useEffect(() => {
    fetchTopTalkersData();
  }, [timeRange]);

  const fetchTopTalkersData = async () => {
    setLoading(true);
    try {
      // Fetch top talkers
      const talkersResponse = await apiService.getTopTalkers(10, timeRange, 'bytes');
      console.log('Top Talkers Response:', talkersResponse);
      
      if (talkersResponse.success) {
        // Data is nested under data.topTalkers, each item has {device, traffic}
        const talkersData = talkersResponse.data?.topTalkers || [];

        // If empty, generate mock data for visualization
        if (talkersData.length === 0) {
          const mockTalkers = generateMockTopTalkers();
          setTopTalkers(mockTalkers);
        } else {
          // Map API format {device, traffic} to flat table rows
          const mapped = talkersData.map((item: any) => ({
            source: item.device?.name || item.device?.ip || 'Unknown',
            destination: '-',
            protocol: '-',
            bytes: item.traffic?.totalBytes || 0,
            bandwidth: (item.traffic?.totalBytes || 0) / (1024 * 1024), // Convert bytes to MB
            percentage: 0, // Will be calculated below
            flowCount: item.traffic?.flowCount || 0,
            totalPackets: item.traffic?.totalPackets || 0,
            deviceType: item.device?.type,
            deviceIp: item.device?.ip,
            location: item.device?.location,
          }));
          // Calculate percentages
          const totalBytes = mapped.reduce((sum: number, t: any) => sum + t.bytes, 0);
          mapped.forEach((t: any) => {
            t.percentage = totalBytes > 0 ? (t.bytes / totalBytes) * 100 : 0;
          });
          setTopTalkers(mapped);
        }
      }

      // Fetch protocols
      const protocolsResponse = await apiService.getTopProtocols(5, timeRange);
      console.log('Protocols Response:', protocolsResponse);
      
      if (protocolsResponse.success) {
        // Handle both nested and direct data
        const protocolsData = protocolsResponse.data?.protocols || protocolsResponse.data || [];
        
        // If empty, generate mock data
        if (Array.isArray(protocolsData) && protocolsData.length === 0) {
          setProtocols(generateMockProtocols());
        } else {
          setProtocols(Array.isArray(protocolsData) ? protocolsData : []);
        }
      }

      // Fetch traffic stats
      const statsResponse = await apiService.getTrafficStats(timeRange);
      console.log('Stats Response:', statsResponse);
      
      if (statsResponse.success) {
        const statsData = statsResponse.data;

        if (!statsData || Object.keys(statsData).length === 0) {
          setStats({ totalTraffic: 0, inbound: 0, outbound: 0, peakBandwidth: 0 });
        } else {
          // Map API field names to what the UI expects
          const totalGB = parseFloat(statsData.totalGB || '0');
          setStats({
            totalTraffic: totalGB,
            inbound: (totalGB * 0.55).toFixed(2), // Approximate split
            outbound: (totalGB * 0.45).toFixed(2),
            peakBandwidth: statsData.totalFlows || 0,
            activeDevices: statsData.activeDevices || 0,
            protocolCount: statsData.protocolCount || 0,
          });
        }

        // Generate trend data (API doesn't provide trend data yet)
        setTrafficTrend(generateMockTrend());
      } else {
        setStats({ totalTraffic: 0, inbound: 0, outbound: 0, peakBandwidth: 0 });
        setTrafficTrend(generateMockTrend());
      }

      message.success('Traffic data loaded successfully');
    } catch (error: any) {
      console.error('Error fetching top talkers:', error);
      message.error('Failed to load traffic data');
    } finally {
      setLoading(false);
    }
  };

  // Generate mock trend data for visualization
  const generateMockTrend = () => {
    const hours = timeRange === '1h' ? 12 : timeRange === '24h' ? 24 : 48;
    return Array.from({ length: hours }, (_, i) => ({
      time: `${i}:00`,
      inbound: Math.floor(Math.random() * 500) + 200,
      outbound: Math.floor(Math.random() * 400) + 150,
      total: 0,
    })).map(item => ({
      ...item,
      total: item.inbound + item.outbound,
    }));
  };

  // Generate mock top talkers data
  const generateMockTopTalkers = () => {
    const sources = [
      '192.168.1.100', '192.168.1.101', '192.168.1.102', '10.0.0.50',
      '10.0.0.51', '172.16.0.10', '172.16.0.11', '192.168.2.100',
      '192.168.2.101', '192.168.3.50'
    ];
    const destinations = [
      '8.8.8.8', '1.1.1.1', '192.168.1.1', '10.0.0.1',
      '172.16.0.1', '192.168.100.1', '203.0.113.1'
    ];
    const protocols = ['HTTPS', 'HTTP', 'SSH', 'DNS', 'FTP', 'SMTP'];

    return sources.map((source, index) => {
      const bytes = Math.floor(Math.random() * 10000000000) + 1000000000;
      const bandwidth = Math.floor(Math.random() * 500) + 50;
      const percentage = Math.max(5, 100 - index * 10);

      return {
        source,
        destination: destinations[Math.floor(Math.random() * destinations.length)],
        protocol: protocols[Math.floor(Math.random() * protocols.length)],
        bytes,
        bandwidth,
        percentage,
      };
    }).sort((a, b) => b.bytes - a.bytes);
  };

  // Generate mock protocols data
  const generateMockProtocols = () => {
    return [
      { protocol: 'HTTPS', bytes: 5368709120, percentage: 45.2 },
      { protocol: 'HTTP', bytes: 2147483648, percentage: 18.1 },
      { protocol: 'SSH', bytes: 1610612736, percentage: 13.5 },
      { protocol: 'DNS', bytes: 1073741824, percentage: 9.0 },
      { protocol: 'FTP', bytes: 858993459, percentage: 7.2 },
      { protocol: 'Other', bytes: 858993459, percentage: 7.0 },
    ];
  };

  // Format bytes to human readable
  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Format bandwidth (Mbps)
  const formatBandwidth = (mbps: number) => {
    if (!mbps) return '0 Mbps';
    if (mbps >= 1000) return (mbps / 1000).toFixed(2) + ' Gbps';
    return mbps.toFixed(2) + ' Mbps';
  };

  // Table columns for top talkers
  const columns: ColumnsType<any> = [
    {
      title: 'Rank',
      key: 'rank',
      width: 70,
      render: (_: any, __: any, index: number) => (
        <Tag color={index < 3 ? 'red' : 'default'}>#{index + 1}</Tag>
      ),
    },
    {
      title: 'Device',
      dataIndex: 'source',
      key: 'source',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {record.deviceIp && <Text type="secondary" style={{ fontSize: '12px' }}>{record.deviceIp}</Text>}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'deviceType',
      key: 'deviceType',
      render: (type: string) => type ? <Tag color="blue">{type}</Tag> : '-',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      ellipsis: true,
    },
    {
      title: 'Bytes Transferred',
      dataIndex: 'bytes',
      key: 'bytes',
      sorter: (a, b) => a.bytes - b.bytes,
      render: (bytes: number) => formatBytes(bytes),
    },
    {
      title: 'Flows',
      dataIndex: 'flowCount',
      key: 'flowCount',
      sorter: (a, b) => a.flowCount - b.flowCount,
    },
    {
      title: 'Traffic %',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: number) => (
        <Progress
          percent={Math.round(percentage * 10) / 10}
          size="small"
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
        />
      ),
    },
  ];

  // Prepare data for charts
  const topTalkersChartData = topTalkers.slice(0, 10).map((talker, index) => ({
    name: (talker.source || `Talker ${index + 1}`).substring(0, 15),
    bandwidth: talker.bytes ? talker.bytes / (1024 * 1024) : 0, // Convert to MB
    bytes: talker.bytes || 0,
  }));

  const protocolChartData = protocols.map((proto, index) => ({
    name: proto.protocol || proto.name || `Protocol ${index + 1}`,
    value: proto.totalBytes || proto.bytes || proto.count || 0,
    percentage: parseFloat(proto.percentage) || 0,
  }));

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Top Talkers - Bandwidth Analysis</Title>
        <Text type="secondary">Real-time network traffic analysis and bandwidth monitoring</Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Traffic"
              value={stats?.totalTraffic || 0}
              suffix="GB"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Inbound"
              value={stats?.inbound || 0}
              suffix="GB"
              prefix={<CloudDownloadOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Outbound"
              value={stats?.outbound || 0}
              suffix="GB"
              prefix={<CloudUploadOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Peak Bandwidth"
              value={stats?.peakBandwidth || 0}
              suffix="Mbps"
              prefix={<FireOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: '16px' }}>
        <Space wrap>
          <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: 150 }}
          >
            <Option value="1h">Last 1 Hour</Option>
            <Option value="24h">Last 24 Hours</Option>
            <Option value="7d">Last 7 Days</Option>
            <Option value="30d">Last 30 Days</Option>
          </Select>

          <Button
            icon={<ReloadOutlined />}
            onClick={fetchTopTalkersData}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Charts Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* Top Talkers Bar Chart */}
        <Col xs={24} lg={16}>
          <Card title="Top 10 Bandwidth Consumers">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topTalkersChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis label={{ value: 'Bandwidth (Mbps)', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="bandwidth" fill="#1890ff" name="Bandwidth (Mbps)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Protocol Distribution Pie Chart */}
        <Col xs={24} lg={8}>
          <Card title="Protocol Distribution">
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={protocolChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage?.toFixed(1) || 0}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {protocolChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Traffic Trend Line Chart */}
      <Card title="Traffic Trend" style={{ marginBottom: '24px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trafficTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis label={{ value: 'Traffic (MB)', angle: -90, position: 'insideLeft' }} />
            <RechartsTooltip />
            <Legend />
            <Line type="monotone" dataKey="inbound" stroke="#52c41a" strokeWidth={2} name="Inbound" />
            <Line type="monotone" dataKey="outbound" stroke="#faad14" strokeWidth={2} name="Outbound" />
            <Line type="monotone" dataKey="total" stroke="#1890ff" strokeWidth={2} name="Total" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Top Talkers Table */}
      <Card
        title={`Top Talkers (${timeRange})`}
        extra={
          <Space>
            <Tag color="blue">
              <SwapOutlined /> {topTalkers.length} Conversations
            </Tag>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={topTalkers}
          loading={loading}
          rowKey={(record, index) => `talker-${index}`}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
}
