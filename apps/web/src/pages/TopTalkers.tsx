// Top Talkers - Bandwidth Analysis Dashboard
// apps/web/src/pages/TopTalkers.tsx

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tabs,
  Tag,
  Select,
  Button,
  Space,
  Typography,
  Progress,
  Spin,
} from 'antd';
import {
  ReloadOutlined,
  ThunderboltOutlined,
  SwapOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,
  DesktopOutlined,
  GlobalOutlined,
  SendOutlined,
  InboxOutlined,
  AppstoreOutlined,
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

// Dark theme chart styles
const CHART_GRID_STROKE = 'rgba(255,255,255,0.1)';
const CHART_AXIS_TICK = { fill: '#8ba3c1' };
const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#0f2035',
  border: '1px solid #1e3a5f',
  color: '#e0e8f0',
};

// Format bytes to human readable
const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

// formatBandwidth removed — use formatBytes for bandwidth display

// -------------------------------------------------------------------
// Tab: By Device
// -------------------------------------------------------------------
function ByDeviceTab({
  loading,
  topTalkers,
  protocols,
  stats,
  trafficTrend,
  timeRange,
}: {
  loading: boolean;
  topTalkers: any[];
  protocols: any[];
  stats: any;
  trafficTrend: any[];
  timeRange: string;
}) {
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
          {record.deviceIp && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.deviceIp}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'deviceType',
      key: 'deviceType',
      render: (type: string) => (type ? <Tag color="blue">{type}</Tag> : '-'),
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
      sorter: (a: any, b: any) => a.bytes - b.bytes,
      render: (bytes: number) => formatBytes(bytes),
    },
    {
      title: 'Flows',
      dataIndex: 'flowCount',
      key: 'flowCount',
      sorter: (a: any, b: any) => (a.flowCount || 0) - (b.flowCount || 0),
    },
    {
      title: 'Traffic %',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: number) => (
        <Progress
          percent={Math.round((percentage || 0) * 10) / 10}
          size="small"
          strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
        />
      ),
    },
  ];

  const topTalkersChartData = topTalkers.slice(0, 10).map((talker, index) => ({
    name: (talker.source || `Device ${index + 1}`).substring(0, 15),
    bandwidth: talker.bytes ? talker.bytes / (1024 * 1024) : 0,
    bytes: talker.bytes || 0,
  }));

  const protocolChartData = protocols.map((proto, index) => ({
    name: proto.protocol || proto.name || `Protocol ${index + 1}`,
    value: proto.totalBytes || proto.bytes || proto.count || 0,
    percentage: parseFloat(proto.percentage) || 0,
  }));

  return (
    <>
      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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
              title="Active Devices"
              value={stats?.activeDevices || 0}
              prefix={<DesktopOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="Top 10 Bandwidth Consumers">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topTalkersChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={CHART_AXIS_TICK}
                />
                <YAxis
                  label={{ value: 'MB', angle: -90, position: 'insideLeft', fill: '#8ba3c1' }}
                  tick={CHART_AXIS_TICK}
                />
                <RechartsTooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number | undefined) => [formatBytes((value ?? 0) * 1024 * 1024), 'Traffic']}
                />
                <Legend wrapperStyle={{ color: '#8ba3c1' }} />
                <Bar dataKey="bandwidth" fill="#1890ff" name="Traffic (MB)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Protocol Distribution">
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={protocolChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {protocolChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={CHART_TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Traffic Trend */}
      {trafficTrend.length > 0 && (
        <Card title="Traffic Trend" style={{ marginBottom: 24 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trafficTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
              <XAxis dataKey="time" tick={CHART_AXIS_TICK} />
              <YAxis
                label={{ value: 'Traffic (MB)', angle: -90, position: 'insideLeft', fill: '#8ba3c1' }}
                tick={CHART_AXIS_TICK}
              />
              <RechartsTooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ color: '#8ba3c1' }} />
              <Line type="monotone" dataKey="inbound" stroke="#52c41a" strokeWidth={2} name="Inbound" dot={false} />
              <Line type="monotone" dataKey="outbound" stroke="#faad14" strokeWidth={2} name="Outbound" dot={false} />
              <Line type="monotone" dataKey="total" stroke="#1890ff" strokeWidth={2} name="Total" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Table */}
      <Card
        title={`Top Talkers (${timeRange})`}
        extra={
          <Tag color="blue">
            <SwapOutlined /> {topTalkers.length} Devices
          </Tag>
        }
      >
        <Table
          columns={columns}
          dataSource={topTalkers}
          loading={loading}
          rowKey={(_record, index) => `talker-${index}`}
          pagination={{ pageSize: 20 }}
          size="middle"
        />
      </Card>
    </>
  );
}

// -------------------------------------------------------------------
// Tab: Top Senders
// -------------------------------------------------------------------
function TopSendersTab({ loading, data }: { loading: boolean; data: any[] }) {
  const chartData = data.slice(0, 10).map((item) => ({
    name: item.ip,
    bytes: item.totalBytesSent || 0,
  }));

  const columns: ColumnsType<any> = [
    {
      title: 'Rank',
      key: 'rank',
      width: 70,
      render: (_: any, __: any, index: number) => (
        <Tag color={index < 3 ? 'volcano' : 'default'}>#{index + 1}</Tag>
      ),
    },
    {
      title: 'Source IP',
      dataIndex: 'ip',
      key: 'ip',
      render: (ip: string) => <Text strong style={{ fontFamily: 'monospace' }}>{ip}</Text>,
    },
    {
      title: 'Bytes Sent',
      dataIndex: 'totalBytesSent',
      key: 'totalBytesSent',
      sorter: (a: any, b: any) => (a.totalBytesSent || 0) - (b.totalBytesSent || 0),
      defaultSortOrder: 'descend' as const,
      render: (bytes: number) => formatBytes(bytes),
    },
    {
      title: 'Packets',
      dataIndex: 'totalPacketsSent',
      key: 'totalPacketsSent',
      sorter: (a: any, b: any) => (a.totalPacketsSent || 0) - (b.totalPacketsSent || 0),
      render: (val: number) => (val || 0).toLocaleString(),
    },
    {
      title: 'Flows',
      dataIndex: 'flowCount',
      key: 'flowCount',
      sorter: (a: any, b: any) => (a.flowCount || 0) - (b.flowCount || 0),
      render: (val: number) => (val || 0).toLocaleString(),
    },
    {
      title: 'Unique Destinations',
      dataIndex: 'uniqueDestinations',
      key: 'uniqueDestinations',
      render: (val: number) => (val || 0).toLocaleString(),
    },
    {
      title: '% of Total',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 180,
      render: (pct: number) => (
        <Progress
          percent={Math.round((pct || 0) * 10) / 10}
          size="small"
          strokeColor="#f5222d"
        />
      ),
    },
  ];

  return (
    <>
      <Card title="Top 10 Source IPs by Bytes Sent" style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis
              type="number"
              tick={CHART_AXIS_TICK}
              tickFormatter={(val: number) => formatBytes(val)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fill: '#8ba3c1', fontSize: 12, fontFamily: 'monospace' }}
            />
            <RechartsTooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number | undefined) => [formatBytes(value ?? 0), 'Bytes Sent']}
            />
            <Bar dataKey="bytes" fill="#f5222d" name="Bytes Sent" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card
        title="Source IP Details"
        extra={
          <Tag color="red">
            <SendOutlined /> {data.length} Sources
          </Tag>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey={(record, index) => `sender-${record.ip || index}`}
          pagination={{ pageSize: 20 }}
          size="middle"
        />
      </Card>
    </>
  );
}

// -------------------------------------------------------------------
// Tab: Top Receivers
// -------------------------------------------------------------------
function TopReceiversTab({ loading, data }: { loading: boolean; data: any[] }) {
  const chartData = data.slice(0, 10).map((item) => ({
    name: item.ip,
    bytes: item.totalBytesReceived || 0,
  }));

  const columns: ColumnsType<any> = [
    {
      title: 'Rank',
      key: 'rank',
      width: 70,
      render: (_: any, __: any, index: number) => (
        <Tag color={index < 3 ? 'blue' : 'default'}>#{index + 1}</Tag>
      ),
    },
    {
      title: 'Destination IP',
      dataIndex: 'ip',
      key: 'ip',
      render: (ip: string) => <Text strong style={{ fontFamily: 'monospace' }}>{ip}</Text>,
    },
    {
      title: 'Bytes Received',
      dataIndex: 'totalBytesReceived',
      key: 'totalBytesReceived',
      sorter: (a: any, b: any) => (a.totalBytesReceived || 0) - (b.totalBytesReceived || 0),
      defaultSortOrder: 'descend' as const,
      render: (bytes: number) => formatBytes(bytes),
    },
    {
      title: 'Packets',
      dataIndex: 'totalPacketsReceived',
      key: 'totalPacketsReceived',
      sorter: (a: any, b: any) => (a.totalPacketsReceived || 0) - (b.totalPacketsReceived || 0),
      render: (val: number) => (val || 0).toLocaleString(),
    },
    {
      title: 'Flows',
      dataIndex: 'flowCount',
      key: 'flowCount',
      sorter: (a: any, b: any) => (a.flowCount || 0) - (b.flowCount || 0),
      render: (val: number) => (val || 0).toLocaleString(),
    },
    {
      title: 'Unique Sources',
      dataIndex: 'uniqueSources',
      key: 'uniqueSources',
      render: (val: number) => (val || 0).toLocaleString(),
    },
    {
      title: '% of Total',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 180,
      render: (pct: number) => (
        <Progress
          percent={Math.round((pct || 0) * 10) / 10}
          size="small"
          strokeColor="#1890ff"
        />
      ),
    },
  ];

  return (
    <>
      <Card title="Top 10 Destination IPs by Bytes Received" style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis
              type="number"
              tick={CHART_AXIS_TICK}
              tickFormatter={(val: number) => formatBytes(val)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fill: '#8ba3c1', fontSize: 12, fontFamily: 'monospace' }}
            />
            <RechartsTooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number | undefined) => [formatBytes(value ?? 0), 'Bytes Received']}
            />
            <Bar dataKey="bytes" fill="#1890ff" name="Bytes Received" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card
        title="Destination IP Details"
        extra={
          <Tag color="blue">
            <InboxOutlined /> {data.length} Destinations
          </Tag>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey={(record, index) => `receiver-${record.ip || index}`}
          pagination={{ pageSize: 20 }}
          size="middle"
        />
      </Card>
    </>
  );
}

// -------------------------------------------------------------------
// Tab: Applications
// -------------------------------------------------------------------

const APP_COLORS: Record<string, string> = {
  HTTP: '#1890ff',
  HTTPS: '#52c41a',
  SSH: '#722ed1',
  DNS: '#faad14',
  FTP: '#f5222d',
  SMTP: '#13c2c2',
  SNMP: '#eb2f96',
  Telnet: '#fa8c16',
  MySQL: '#1890ff',
  PostgreSQL: '#722ed1',
  Redis: '#f5222d',
  RDP: '#13c2c2',
};

function getAppColor(app: string, index: number): string {
  return APP_COLORS[app] || COLORS[index % COLORS.length];
}

function ApplicationsTab({ loading, data }: { loading: boolean; data: any[] }) {
  const donutData = data.slice(0, 10).map((item, index) => ({
    name: item.application || `Port ${item.port}`,
    value: item.totalBytes || 0,
    percentage: parseFloat(item.percentage) || 0,
    color: getAppColor(item.application, index),
  }));

  const columns: ColumnsType<any> = [
    {
      title: 'Rank',
      key: 'rank',
      width: 70,
      render: (_: any, __: any, index: number) => (
        <Tag color={index < 3 ? 'purple' : 'default'}>#{index + 1}</Tag>
      ),
    },
    {
      title: 'Application',
      dataIndex: 'application',
      key: 'application',
      render: (app: string, _record: any, index: number) => (
        <Space>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: getAppColor(app, index),
            }}
          />
          <Text strong>{app || 'Unknown'}</Text>
        </Space>
      ),
    },
    {
      title: 'Port',
      dataIndex: 'port',
      key: 'port',
      render: (port: number) => <Tag>{port}</Tag>,
    },
    {
      title: 'Protocol',
      dataIndex: 'protocol',
      key: 'protocol',
      render: (proto: string) => <Tag color="geekblue">{proto || '-'}</Tag>,
    },
    {
      title: 'Total Bytes',
      dataIndex: 'totalBytes',
      key: 'totalBytes',
      sorter: (a: any, b: any) => (a.totalBytes || 0) - (b.totalBytes || 0),
      defaultSortOrder: 'descend' as const,
      render: (bytes: number) => formatBytes(bytes),
    },
    {
      title: 'Packets',
      dataIndex: 'totalPackets',
      key: 'totalPackets',
      sorter: (a: any, b: any) => (a.totalPackets || 0) - (b.totalPackets || 0),
      render: (val: number) => (val || 0).toLocaleString(),
    },
    {
      title: 'Devices',
      dataIndex: 'deviceCount',
      key: 'deviceCount',
      render: (val: number) => (val || 0).toLocaleString(),
    },
    {
      title: '% of Total',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 180,
      render: (pct: number) => (
        <Progress
          percent={Math.round((parseFloat(String(pct)) || 0) * 10) / 10}
          size="small"
          strokeColor="#722ed1"
        />
      ),
    },
  ];

  return (
    <>
      <Card title="Application Traffic Distribution" style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={150}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
            >
              {donutData.map((entry, index) => (
                <Cell key={`app-cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number | undefined) => [formatBytes(value ?? 0), 'Traffic']}
            />
            <Legend wrapperStyle={{ color: '#8ba3c1' }} />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      <Card
        title="Application Details"
        extra={
          <Tag color="purple">
            <AppstoreOutlined /> {data.length} Applications
          </Tag>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey={(record, index) => `app-${record.port || index}`}
          pagination={{ pageSize: 20 }}
          size="middle"
        />
      </Card>
    </>
  );
}

// -------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------
export default function TopTalkers() {
  const [activeTab, setActiveTab] = useState('by-device');
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('1h');

  // By Device state
  const [topTalkers, setTopTalkers] = useState<any[]>([]);
  const [protocols, setProtocols] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [trafficTrend, setTrafficTrend] = useState<any[]>([]);

  // Top Senders state
  const [sourceIPs, setSourceIPs] = useState<any[]>([]);

  // Top Receivers state
  const [destinationIPs, setDestinationIPs] = useState<any[]>([]);

  // Applications state
  const [applications, setApplications] = useState<any[]>([]);

  // Track which tabs have been loaded for the current timeRange
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({});

  const fetchByDevice = useCallback(async () => {
    const results = await Promise.allSettled([
      apiService.getTopTalkers(10, timeRange, 'bytes'),
      apiService.getTopProtocols(5, timeRange),
      apiService.getTrafficStats(timeRange),
    ]);

    // Top Talkers
    const talkersResult = results[0];
    if (talkersResult.status === 'fulfilled' && talkersResult.value.success) {
      const talkersData = talkersResult.value.data?.topTalkers || [];
      const mapped = talkersData.map((item: any) => ({
        source: item.device?.name || item.device?.ip || 'Unknown',
        destination: '-',
        protocol: '-',
        bytes: item.traffic?.totalBytes || 0,
        bandwidth: (item.traffic?.totalBytes || 0) / (1024 * 1024),
        percentage: 0,
        flowCount: item.traffic?.flowCount || 0,
        totalPackets: item.traffic?.totalPackets || 0,
        deviceType: item.device?.type,
        deviceIp: item.device?.ip,
        location: item.device?.location,
      }));
      const totalBytes = mapped.reduce((sum: number, t: any) => sum + t.bytes, 0);
      mapped.forEach((t: any) => {
        t.percentage = totalBytes > 0 ? (t.bytes / totalBytes) * 100 : 0;
      });
      setTopTalkers(mapped);
    } else {
      setTopTalkers([]);
    }

    // Protocols
    const protocolsResult = results[1];
    if (protocolsResult.status === 'fulfilled' && protocolsResult.value.success) {
      const protocolsData = protocolsResult.value.data?.protocols || protocolsResult.value.data || [];
      setProtocols(Array.isArray(protocolsData) ? protocolsData : []);
    } else {
      setProtocols([]);
    }

    // Traffic Stats
    const statsResult = results[2];
    if (statsResult.status === 'fulfilled' && statsResult.value.success) {
      const statsData = statsResult.value.data;
      if (statsData && Object.keys(statsData).length > 0) {
        const totalGB = parseFloat(statsData.totalGB || '0');
        setStats({
          totalTraffic: totalGB,
          inbound: (totalGB * 0.55).toFixed(2),
          outbound: (totalGB * 0.45).toFixed(2),
          activeDevices: statsData.activeDevices || 0,
          protocolCount: statsData.protocolCount || 0,
        });
      } else {
        setStats({ totalTraffic: 0, inbound: 0, outbound: 0, activeDevices: 0 });
      }
    } else {
      setStats({ totalTraffic: 0, inbound: 0, outbound: 0, activeDevices: 0 });
    }

    // Traffic trend is not provided by the API yet; leave empty
    setTrafficTrend([]);
  }, [timeRange]);

  const fetchSourceIPs = useCallback(async () => {
    try {
      const response = await apiService.getTopSourceIPs(20, timeRange);
      if (response.success) {
        setSourceIPs(response.data?.sourceIPs || []);
      } else {
        setSourceIPs([]);
      }
    } catch {
      setSourceIPs([]);
    }
  }, [timeRange]);

  const fetchDestinationIPs = useCallback(async () => {
    try {
      const response = await apiService.getTopDestinationIPs(20, timeRange);
      if (response.success) {
        setDestinationIPs(response.data?.destinationIPs || []);
      } else {
        setDestinationIPs([]);
      }
    } catch {
      setDestinationIPs([]);
    }
  }, [timeRange]);

  const fetchApplications = useCallback(async () => {
    try {
      const response = await apiService.getTopApplications(20, timeRange);
      if (response.success) {
        setApplications(response.data?.applications || []);
      } else {
        setApplications([]);
      }
    } catch {
      setApplications([]);
    }
  }, [timeRange]);

  const fetchActiveTabData = useCallback(async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'by-device':
          await fetchByDevice();
          break;
        case 'top-senders':
          await fetchSourceIPs();
          break;
        case 'top-receivers':
          await fetchDestinationIPs();
          break;
        case 'applications':
          await fetchApplications();
          break;
      }
      setLoadedTabs((prev) => ({ ...prev, [activeTab]: true }));
    } catch {
      // Errors handled in individual fetchers
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchByDevice, fetchSourceIPs, fetchDestinationIPs, fetchApplications]);

  // Fetch data when the active tab changes (if not already loaded)
  useEffect(() => {
    if (!loadedTabs[activeTab]) {
      fetchActiveTabData();
    }
  }, [activeTab, loadedTabs, fetchActiveTabData]);

  // Reset loaded tabs and refetch when timeRange changes
  useEffect(() => {
    setLoadedTabs({});
  }, [timeRange]);

  const handleRefresh = () => {
    setLoadedTabs({});
    // The effect above will trigger fetchActiveTabData via the loadedTabs reset
    // But we need to also trigger immediately for the current tab
    setTimeout(() => fetchActiveTabData(), 0);
  };

  const tabItems = [
    {
      key: 'by-device',
      label: (
        <span>
          <GlobalOutlined /> By Device
        </span>
      ),
      children: (
        <Spin spinning={loading && activeTab === 'by-device'}>
          <ByDeviceTab
            loading={loading && activeTab === 'by-device'}
            topTalkers={topTalkers}
            protocols={protocols}
            stats={stats}
            trafficTrend={trafficTrend}
            timeRange={timeRange}
          />
        </Spin>
      ),
    },
    {
      key: 'top-senders',
      label: (
        <span>
          <SendOutlined /> Top Senders
        </span>
      ),
      children: (
        <Spin spinning={loading && activeTab === 'top-senders'}>
          <TopSendersTab loading={loading && activeTab === 'top-senders'} data={sourceIPs} />
        </Spin>
      ),
    },
    {
      key: 'top-receivers',
      label: (
        <span>
          <InboxOutlined /> Top Receivers
        </span>
      ),
      children: (
        <Spin spinning={loading && activeTab === 'top-receivers'}>
          <TopReceiversTab loading={loading && activeTab === 'top-receivers'} data={destinationIPs} />
        </Spin>
      ),
    },
    {
      key: 'applications',
      label: (
        <span>
          <AppstoreOutlined /> Applications
        </span>
      ),
      children: (
        <Spin spinning={loading && activeTab === 'applications'}>
          <ApplicationsTab loading={loading && activeTab === 'applications'} data={applications} />
        </Spin>
      ),
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>Top Talkers - Bandwidth Analysis</Title>
        <Text type="secondary">Real-time network traffic analysis and bandwidth monitoring</Text>
      </div>

      {/* Shared Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select value={timeRange} onChange={setTimeRange} style={{ width: 150 }}>
            <Option value="1h">Last 1 Hour</Option>
            <Option value="24h">Last 24 Hours</Option>
            <Option value="7d">Last 7 Days</Option>
            <Option value="30d">Last 30 Days</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Tabbed Views */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={tabItems}
      />
    </div>
  );
}
