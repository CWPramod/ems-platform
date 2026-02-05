import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Spin,
  message,
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { nmsAPI, eventsAPI, assetsAPI } from '../services/api';
import type { NetworkDevice, NMSStatus, Event, Asset } from '../types';
import NetworkTopology from '../components/NetworkTopology';
import DeviceMetrics from '../components/DeviceMetrics';
import NetworkEvents from '../components/NetworkEvents';
import DeviceQuickView from '../components/DeviceQuickView';

const { Title, Text } = Typography;

const Network = () => {
  const navigate = useNavigate();
  const [nmsStatus, setNmsStatus] = useState<NMSStatus | null>(null);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // DeviceQuickView state
  const [quickViewDeviceId, setQuickViewDeviceId] = useState<string | null>(null);
  const [quickViewVisible, setQuickViewVisible] = useState(false);

  // Network device types
  const NETWORK_DEVICE_TYPES = ['router', 'switch', 'firewall', 'load_balancer', 'access_point', 'network_device'];

  useEffect(() => {
    loadNetworkData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadNetworkData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNetworkData = async () => {
    try {
      setLoading(true);

      // Fetch each data source independently so one failure doesn't block others
      let allAssets: Asset[] = [];
      let nmsStatusData: NMSStatus | null = null;
      let eventsData: Event[] = [];

      // 1. Fetch assets (always available from main API)
      try {
        const assetsRes = await assetsAPI.getAll();
        allAssets = assetsRes.data || [];
      } catch (err) {
        console.warn('Failed to load assets:', err);
      }

      // 2. Try NMS status (may not be running - service was migrated)
      try {
        const statusRes = await nmsAPI.getStatus();
        nmsStatusData = statusRes;
      } catch {
        // NMS service not available - this is OK, we'll use asset status directly
        console.info('NMS service not available, using asset status directly');
      }

      // 3. Fetch events
      try {
        const eventsRes = await eventsAPI.getAll({ source: 'nms' });
        eventsData = eventsRes.data || [];
      } catch {
        console.warn('Failed to load events');
      }

      // Filter for network devices (include all statuses, not just online)
      const networkAssets = allAssets.filter((asset: Asset) =>
        NETWORK_DEVICE_TYPES.includes(asset.type)
      );

      // Create device status map from NMS if available
      const deviceStatusMap = new Map();
      if (nmsStatusData?.devices) {
        nmsStatusData.devices.forEach((device: any) => {
          deviceStatusMap.set(device.assetId, {
            isReachable: device.isReachable,
            lastPollTime: device.lastPollTime,
            consecutiveFailures: device.consecutiveFailures,
          });
        });
      }

      // Merge asset data with NMS status (or use asset status as fallback)
      const enrichedDevices: NetworkDevice[] = networkAssets.map((asset: Asset) => {
        const nmsDeviceStatus = deviceStatusMap.get(asset.id);

        // Determine status: use NMS if available, otherwise map from asset status
        let deviceStatus: string;
        if (nmsDeviceStatus) {
          deviceStatus = nmsDeviceStatus.isReachable ? 'reachable' : 'unreachable';
        } else {
          // Map asset status to network device status
          deviceStatus = asset.status === 'online' ? 'reachable'
            : asset.status === 'degraded' ? 'degraded'
            : 'unreachable';
        }

        return {
          id: asset.id,
          name: asset.name,
          type: asset.type,
          ipAddress: asset.ip || asset.ipAddress || '',
          status: deviceStatus,
          vendor: asset.vendor || '',
          model: asset.model || '',
          location: asset.location,
          tier: (asset as any).tier,
          uptime: deviceStatus === 'reachable' ? 99.9 : deviceStatus === 'degraded' ? 85.0 : 0,
          lastSeen: nmsDeviceStatus?.lastPollTime,
          metadata: asset.metadata,
        };
      });

      setNmsStatus(nmsStatusData);
      setDevices(enrichedDevices);
      setEvents(eventsData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load network data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscovery = async () => {
    try {
      await nmsAPI.triggerDiscovery();
      message.success('Device discovery triggered. Refreshing in 2 seconds...');
      // Reload data after a short delay
      setTimeout(loadNetworkData, 2000);
    } catch (error) {
      console.error('Failed to trigger discovery:', error);
      message.error('Failed to trigger device discovery');
    }
  };

  const handleRefresh = () => {
    message.info('Refreshing network data...');
    loadNetworkData();
  };

  const handleOpenQuickView = (deviceId: string) => {
    setQuickViewDeviceId(deviceId);
    setQuickViewVisible(true);
  };

  // Calculate stats
  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'reachable').length,
    offline: devices.filter(d => d.status === 'unreachable').length,
    degraded: devices.filter(d => d.status === 'degraded').length,
    avgUptime: devices.length > 0
      ? devices.reduce((sum, d) => sum + (d.uptime || 0), 0) / devices.length
      : 0,
  };

  const recentEvents = events.slice(0, 10);

  // Device type icon helper
  const getDeviceTypeIcon = (type: string) => {
    switch (type) {
      case 'router': return '🔀';
      case 'switch': return '🔌';
      case 'firewall': return '🛡️';
      case 'load_balancer': return '⚖️';
      default: return '🌐';
    }
  };

  // Status tag helper
  const getStatusTag = (status: string) => {
    if (status === 'reachable') {
      return <Tag icon={<CheckCircleOutlined />} color="success">Reachable</Tag>;
    }
    if (status === 'degraded') {
      return <Tag icon={<ExclamationCircleOutlined />} color="warning">Degraded</Tag>;
    }
    if (status === 'unreachable') {
      return <Tag icon={<CloseCircleOutlined />} color="error">Unreachable</Tag>;
    }
    return <Tag color="default">{status || 'Unknown'}</Tag>;
  };

  // Table columns
  const columns: ColumnsType<NetworkDevice> = [
    {
      title: 'Device',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: NetworkDevice) => (
        <Space>
          <span style={{ fontSize: 20 }}>{getDeviceTypeIcon(record.type)}</span>
          <div>
            <a
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/device/${record.id}`);
              }}
              style={{ fontWeight: 500 }}
            >
              {name}
            </a>
            {record.vendor && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.vendor} {record.model}
                </Text>
              </div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Text style={{ textTransform: 'capitalize' }}>
          {type.replace('_', ' ')}
        </Text>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (ip: string) => <Text code>{ip}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
      filters: [
        { text: 'Reachable', value: 'reachable' },
        { text: 'Degraded', value: 'degraded' },
        { text: 'Unreachable', value: 'unreachable' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (location: string) => location || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: NetworkDevice) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenQuickView(record.id);
          }}
        >
          View Details
        </Button>
      ),
    },
  ];

  if (loading && !nmsStatus) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '120px 0' }}>
        <Spin size="large" tip="Loading network data..." />
      </div>
    );
  }

  return (
    <div>
      {/* Header Actions */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            <Button
              type="default"
              icon={<SearchOutlined />}
              onClick={handleDiscovery}
              style={{ borderColor: '#52c41a', color: '#52c41a' }}
            >
              Discover Devices
            </Button>
          </Space>
        </Col>
        <Col>
          <Text type="secondary">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </Text>
        </Col>
      </Row>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={4} xl={4}>
          <Card>
            <Statistic
              title="Total Devices"
              value={stats.total}
              prefix={<GlobalOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5}>
          <Card>
            <Statistic
              title="Online"
              value={stats.online}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5}>
          <Card>
            <Statistic
              title="Offline"
              value={stats.offline}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5}>
          <Card>
            <Statistic
              title="Degraded"
              value={stats.degraded}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5}>
          <Card>
            <Statistic
              title="Avg Uptime"
              value={stats.avgUptime.toFixed(1)}
              suffix="%"
              prefix={<FieldTimeOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Network Topology */}
      <Card
        title={<Title level={5} style={{ margin: 0 }}>Network Topology</Title>}
        style={{ marginBottom: 24 }}
      >
        <NetworkTopology
          devices={devices}
          onDeviceSelect={setSelectedDevice}
        />
      </Card>

      {/* Two Column Layout */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Device List */}
        <Col xs={24} lg={12}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>Network Devices</Title>}
          >
            <Table<NetworkDevice>
              columns={columns}
              dataSource={devices}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              onRow={(record) => ({
                onClick: () => setSelectedDevice(record),
                style: { cursor: 'pointer' },
              })}
              locale={{
                emptyText: (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <SearchOutlined style={{ fontSize: 32, color: '#bfbfbf', display: 'block', marginBottom: 8 }} />
                    <Text type="secondary">No network devices found</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Click "Discover Devices" to scan for devices
                    </Text>
                  </div>
                ),
              }}
            />
          </Card>
        </Col>

        {/* Events Timeline */}
        <Col xs={24} lg={12}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>Recent Events</Title>}
          >
            <NetworkEvents events={recentEvents} />
          </Card>
        </Col>
      </Row>

      {/* Device Metrics (if device selected) */}
      {selectedDevice && (
        <Card
          title={
            <Space>
              <Title level={5} style={{ margin: 0 }}>
                Device Metrics: {selectedDevice.name}
              </Title>
            </Space>
          }
          extra={
            <Button type="text" onClick={() => setSelectedDevice(null)}>
              Close
            </Button>
          }
          style={{ marginBottom: 24 }}
        >
          <DeviceMetrics device={selectedDevice} />
        </Card>
      )}

      {/* DeviceQuickView Drawer */}
      <DeviceQuickView
        deviceId={quickViewDeviceId}
        visible={quickViewVisible}
        onClose={() => {
          setQuickViewVisible(false);
          setQuickViewDeviceId(null);
        }}
      />
    </div>
  );
};

export default Network;
