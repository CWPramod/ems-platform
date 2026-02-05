// Masters Page — Device, Customer & Threshold Management
// 3-tab comprehensive masters page using Canaris dark blue theme
// apps/web/src/pages/Masters.tsx

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Row,
  Col,
  Statistic,
  Typography,
  Badge,
  Input,
  Popconfirm,
  Switch,
  message,
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  DesktopOutlined,
  TeamOutlined,
  DashboardOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { RadarChartOutlined } from '@ant-design/icons';
import axios from 'axios';
import NetworkScanDrawer from '../components/NetworkScanDrawer';
import DeviceFormModal from '../components/DeviceFormModal';
import BulkUploadDrawer from '../components/BulkUploadDrawer';
import CustomerFormModal from '../components/CustomerFormModal';

const { Title, Text } = Typography;

// ---------------------------------------------------------------------------
// API helper — authenticated axios instance pointing at NestJS backend
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3100';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Device {
  id: string;
  name: string;
  type: string;
  ip: string;
  location: string;
  region?: string;
  vendor: string;
  model?: string;
  tags: string[];
  tier: number;
  owner: string;
  department?: string;
  status: string;
  monitoringEnabled: boolean;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface DeviceStats {
  total: number;
  monitoring: number;
  critical: number;
  byStatus: { status: string; count: string }[];
}

interface Customer {
  id: number;
  customerCode: string;
  customerName: string;
  customerType: string;
  parentCustomerId: number | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string;
  isActive: boolean;
  createdAt: string;
}

interface CustomerStats {
  total: number;
  ho: number;
  branches: number;
}

interface ThresholdRule {
  id: number;
  ruleName: string;
  kpiCode: string;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  operator: string;
  severity: string;
  isActive: boolean;
  alertEnabled: boolean;
  triggerCount: number;
  lastTriggered: string | null;
  description: string | null;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const DEVICE_TYPE_COLORS: Record<string, string> = {
  router: 'blue',
  switch: 'cyan',
  firewall: 'volcano',
  load_balancer: 'purple',
  server: 'geekblue',
  vm: 'magenta',
  container: 'lime',
  ec2: 'orange',
  rds: 'gold',
  lambda: 'green',
  application: 'pink',
  database: 'red',
  api: 'default',
};

const STATUS_COLORS: Record<string, string> = {
  online: 'success',
  warning: 'warning',
  offline: 'error',
  maintenance: 'processing',
  unknown: 'default',
};

const SEVERITY_TAG_COLORS: Record<string, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
};

const TIER_COLORS: Record<number, string> = {
  1: '#f5222d',
  2: '#fa8c16',
  3: '#1890ff',
};

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function Masters() {
  const [activeTab, setActiveTab] = useState('devices');

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>Masters</Title>
        <Text type="secondary">
          Manage devices, customers, and threshold rules
        </Text>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'devices',
              label: (
                <span>
                  <DesktopOutlined /> Devices
                </span>
              ),
              children: <DevicesTab />,
            },
            {
              key: 'customers',
              label: (
                <span>
                  <TeamOutlined /> Customers
                </span>
              ),
              children: <CustomersTab />,
            },
            {
              key: 'thresholds',
              label: (
                <span>
                  <DashboardOutlined /> Thresholds
                </span>
              ),
              children: <ThresholdsTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
}

// ============================================================================
// TAB 1 — DEVICES
// ============================================================================

function DevicesTab() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [tierFilter, setTierFilter] = useState<number | undefined>();
  const [locationFilter, setLocationFilter] = useState('');

  // Modals
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [scanDrawerOpen, setScanDrawerOpen] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      if (tierFilter) params.tier = String(tierFilter);
      if (locationFilter) params.location = locationFilter;

      const [devRes, statsRes] = await Promise.all([
        api.get('/api/v1/masters/devices', { params }),
        api.get('/api/v1/masters/devices/stats/overview'),
      ]);

      if (devRes.data?.success) {
        setDevices(devRes.data.data || []);
      }
      if (statsRes.data?.success) {
        setStats(statsRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load devices', err);
      message.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, tierFilter, locationFilter]);

  useEffect(() => {
    setLoading(true);
    loadDevices();
  }, [loadDevices]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/v1/masters/devices/${id}`);
      message.success('Device deleted');
      loadDevices();
    } catch {
      message.error('Failed to delete device');
    }
  };

  const handleToggleMonitoring = async (id: string, enabled: boolean) => {
    try {
      await api.post(`/api/v1/masters/devices/${id}/toggle-monitoring`, {
        enabled,
      });
      message.success(`Monitoring ${enabled ? 'enabled' : 'disabled'}`);
      loadDevices();
    } catch {
      message.error('Failed to toggle monitoring');
    }
  };

  // Build "By Type" summary string from devices data
  const buildTypeBreakdown = (): string => {
    if (!devices.length) return '--';
    const counts: Record<string, number> = {};
    devices.forEach((d) => {
      counts[d.type] = (counts[d.type] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted
      .slice(0, 3)
      .map(([t, c]) => `${t.replace('_', ' ')}: ${c}`)
      .join(', ');
  };

  const columns: ColumnsType<Device> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Tag color={DEVICE_TYPE_COLORS[type] || 'default'}>
          {type.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Model',
      key: 'model',
      width: 140,
      render: (_: any, record: Device) => (
        <span>
          {record.vendor}
          {record.model ? ` / ${record.model}` : ''}
        </span>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (ip: string) => <Text code>{ip}</Text>,
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      width: 80,
      sorter: (a, b) => a.tier - b.tier,
      render: (tier: number) => (
        <Badge
          count={`T${tier}`}
          style={{ backgroundColor: TIER_COLORS[tier] || '#8c8c8c' }}
        />
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      ellipsis: true,
      width: 140,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || 'default'}>
          {(status || 'unknown').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Monitoring',
      dataIndex: 'monitoringEnabled',
      key: 'monitoring',
      width: 100,
      render: (enabled: boolean, record: Device) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={(checked) => handleToggleMonitoring(record.id, checked)}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_: any, record: Device) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              message.info(`Edit device: ${record.name}`);
            }}
          />
          <Popconfirm
            title="Delete this device?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Total Devices"
              value={stats?.total ?? 0}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#1e88e5' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Monitoring Enabled"
              value={stats?.monitoring ?? 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#4caf50' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Critical (Tier 1)"
              value={stats?.critical ?? 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#f44336' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <div>
              <Text type="secondary" style={{ fontSize: 14 }}>
                By Type
              </Text>
              <div
                style={{
                  fontSize: 13,
                  marginTop: 8,
                  lineHeight: 1.6,
                  minHeight: 40,
                }}
              >
                {buildTypeBreakdown()}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Search devices..."
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => {
              setLoading(true);
              loadDevices();
            }}
          />

          <Select
            placeholder="Type"
            allowClear
            style={{ width: 160 }}
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { label: 'Router', value: 'router' },
              { label: 'Switch', value: 'switch' },
              { label: 'Firewall', value: 'firewall' },
              { label: 'Load Balancer', value: 'load_balancer' },
              { label: 'Server', value: 'server' },
              { label: 'VM', value: 'vm' },
              { label: 'Container', value: 'container' },
            ]}
          />

          <Select
            placeholder="Tier"
            allowClear
            style={{ width: 110 }}
            value={tierFilter}
            onChange={setTierFilter}
            options={[
              { label: 'Tier 1', value: 1 },
              { label: 'Tier 2', value: 2 },
              { label: 'Tier 3', value: 3 },
            ]}
          />

          <Input
            placeholder="Location"
            allowClear
            style={{ width: 160 }}
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            onPressEnter={() => {
              setLoading(true);
              loadDevices();
            }}
          />

          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setLoading(true);
              loadDevices();
            }}
          >
            Refresh
          </Button>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setDeviceModalOpen(true)}
          >
            Add Device
          </Button>

          <Button
            icon={<UploadOutlined />}
            onClick={() => setBulkDrawerOpen(true)}
          >
            Bulk Upload
          </Button>

          <Button
            icon={<RadarChartOutlined />}
            onClick={() => setScanDrawerOpen(true)}
          >
            Scan Network
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Table
        dataSource={devices}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} devices` }}
        scroll={{ x: 1200 }}
        onRow={(record) => ({
          onClick: () => {
            message.info(`Device: ${record.name} (${record.ip})`);
          },
          style: { cursor: 'pointer' },
        })}
      />

      {deviceModalOpen && (
        <DeviceFormModal
          visible={deviceModalOpen}
          onClose={() => setDeviceModalOpen(false)}
          onSuccess={() => {
            setDeviceModalOpen(false);
            loadDevices();
          }}
        />
      )}

      {bulkDrawerOpen && (
        <BulkUploadDrawer
          visible={bulkDrawerOpen}
          onClose={() => setBulkDrawerOpen(false)}
          onSuccess={() => {
            setBulkDrawerOpen(false);
            loadDevices();
          }}
        />
      )}

      {/* Network Scan Drawer */}
      <NetworkScanDrawer
        visible={scanDrawerOpen}
        onClose={() => setScanDrawerOpen(false)}
        onImportComplete={() => {
          setScanDrawerOpen(false);
          loadDevices();
        }}
      />
    </div>
  );
}

// ============================================================================
// TAB 2 — CUSTOMERS
// ============================================================================

function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [activeFilter, setActiveFilter] = useState<string | undefined>();

  // Modal
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (typeFilter) params.customer_type = typeFilter;
      if (activeFilter !== undefined) params.is_active = activeFilter;

      const [custRes, statsRes] = await Promise.all([
        api.get('/api/v1/masters/customers', { params }),
        api.get('/api/v1/masters/customers/stats/overview'),
      ]);

      if (custRes.data?.success) {
        setCustomers(custRes.data.data || []);
      }
      if (statsRes.data?.success) {
        setStats(statsRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load customers', err);
      message.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, activeFilter]);

  useEffect(() => {
    setLoading(true);
    loadCustomers();
  }, [loadCustomers]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/v1/masters/customers/${id}`);
      message.success('Customer deleted');
      loadCustomers();
    } catch {
      message.error('Failed to delete customer');
    }
  };

  const columns: ColumnsType<Customer> = [
    {
      title: 'Code',
      dataIndex: 'customerCode',
      key: 'code',
      width: 110,
      sorter: (a, b) => a.customerCode.localeCompare(b.customerCode),
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: 'Name',
      dataIndex: 'customerName',
      key: 'name',
      sorter: (a, b) => a.customerName.localeCompare(b.customerName),
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'customerType',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'HO' ? 'geekblue' : 'cyan'}>
          {type === 'HO' ? 'Head Office' : 'Branch'}
        </Tag>
      ),
    },
    {
      title: 'Contact',
      dataIndex: 'contactPerson',
      key: 'contact',
      ellipsis: true,
      width: 150,
      render: (v: string | null) => v || '--',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      width: 200,
      render: (v: string | null) => v || '--',
    },
    {
      title: 'City',
      dataIndex: 'city',
      key: 'city',
      width: 120,
      render: (v: string | null) => v || '--',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_: any, record: Customer) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => message.info(`Edit customer: ${record.customerName}`)}
          />
          <Popconfirm
            title="Delete this customer?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Total Customers"
              value={stats?.total ?? 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1e88e5' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Head Offices"
              value={stats?.ho ?? 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#4caf50' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Branches"
              value={stats?.branches ?? 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff9800' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Search customers..."
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => {
              setLoading(true);
              loadCustomers();
            }}
          />

          <Select
            placeholder="Type"
            allowClear
            style={{ width: 150 }}
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { label: 'Head Office', value: 'HO' },
              { label: 'Branch', value: 'Branch' },
            ]}
          />

          <Select
            placeholder="Status"
            allowClear
            style={{ width: 130 }}
            value={activeFilter}
            onChange={setActiveFilter}
            options={[
              { label: 'Active', value: 'true' },
              { label: 'Inactive', value: 'false' },
            ]}
          />

          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setLoading(true);
              loadCustomers();
            }}
          >
            Refresh
          </Button>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCustomerModalOpen(true)}
          >
            Add Customer
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Table
        dataSource={customers}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} customers` }}
        scroll={{ x: 1100 }}
      />

      {customerModalOpen && (
        <CustomerFormModal
          visible={customerModalOpen}
          onClose={() => setCustomerModalOpen(false)}
          onSuccess={() => {
            setCustomerModalOpen(false);
            loadCustomers();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// TAB 3 — THRESHOLDS (read-only view)
// ============================================================================

function ThresholdsTab() {
  const [thresholds, setThresholds] = useState<ThresholdRule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThresholds = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/masters/thresholds');
      if (res.data?.success) {
        setThresholds(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load thresholds', err);
      message.error('Failed to load threshold rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadThresholds();
  }, [loadThresholds]);

  const columns: ColumnsType<ThresholdRule> = [
    {
      title: 'Rule Name',
      dataIndex: 'ruleName',
      key: 'ruleName',
      sorter: (a, b) => a.ruleName.localeCompare(b.ruleName),
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'KPI Code',
      dataIndex: 'kpiCode',
      key: 'kpiCode',
      width: 140,
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Warning',
      dataIndex: 'warningThreshold',
      key: 'warning',
      width: 100,
      render: (v: number | null) =>
        v !== null ? (
          <Text style={{ color: '#ff9800' }}>{v}</Text>
        ) : (
          <Text type="secondary">--</Text>
        ),
    },
    {
      title: 'Critical',
      dataIndex: 'criticalThreshold',
      key: 'critical',
      width: 100,
      render: (v: number | null) =>
        v !== null ? (
          <Text style={{ color: '#f44336' }}>{v}</Text>
        ) : (
          <Text type="secondary">--</Text>
        ),
    },
    {
      title: 'Operator',
      dataIndex: 'operator',
      key: 'operator',
      width: 80,
      render: (op: string) => <Text code>{op}</Text>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (sev: string) => (
        <Tag color={SEVERITY_TAG_COLORS[sev] || 'default'}>
          {(sev || 'warning').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'active',
      width: 80,
      render: (active: boolean) => (
        <Badge
          status={active ? 'success' : 'default'}
          text={active ? 'Yes' : 'No'}
        />
      ),
    },
    {
      title: 'Alert',
      dataIndex: 'alertEnabled',
      key: 'alert',
      width: 80,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>
          {enabled ? 'ON' : 'OFF'}
        </Tag>
      ),
    },
    {
      title: 'Triggers',
      dataIndex: 'triggerCount',
      key: 'triggers',
      width: 80,
      sorter: (a, b) => a.triggerCount - b.triggerCount,
      render: (count: number) => (
        <Text strong style={{ color: count > 0 ? '#f44336' : undefined }}>
          {count}
        </Text>
      ),
    },
    {
      title: 'Last Triggered',
      dataIndex: 'lastTriggered',
      key: 'lastTriggered',
      width: 160,
      render: (d: string | null) =>
        d ? new Date(d).toLocaleString() : <Text type="secondary">Never</Text>,
    },
  ];

  return (
    <div>
      <Card
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setLoading(true);
              loadThresholds();
            }}
          >
            Refresh
          </Button>
          <Text type="secondary">
            Showing {thresholds.length} threshold rule{thresholds.length !== 1 ? 's' : ''}
          </Text>
        </Space>
      </Card>

      <Table
        dataSource={thresholds}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} rules` }}
        scroll={{ x: 1200 }}
      />
    </div>
  );
}
