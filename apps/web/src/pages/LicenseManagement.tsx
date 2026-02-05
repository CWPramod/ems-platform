import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
  Descriptions,
  Alert,
  Progress,
  Statistic,
  Row,
  Col,
  Timeline,
  message,
  Divider,
} from 'antd';
import {
  SafetyCertificateOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

const API_BASE = 'http://localhost:3100';

interface LicenseStatus {
  status: string;
  tier: string | null;
  valid: boolean;
  message: string;
  daysRemaining: number | null;
  deviceCount: number;
  maxDevices: number;
  deviceLimitReached: boolean;
  enabledFeatures: string[];
  warnings: string[];
  organization: string | null;
  type: string | null;
  expiresAt: string | null;
  activatedAt: string | null;
}

interface License {
  id: string;
  licenseKey: string;
  type: string;
  tier: string;
  status: string;
  organizationName: string;
  maxDeviceCount: number;
  startsAt: string;
  expiresAt: string;
  activatedAt: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  details: string;
  performedBy: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  active: 'green',
  grace_period: 'orange',
  expired: 'red',
  suspended: 'volcano',
  revoked: 'default',
  no_license: 'red',
};

const tierLabels: Record<string, string> = {
  nms_only: 'NMS Only',
  ems_full: 'EMS Full',
};

const typeLabels: Record<string, string> = {
  trial: 'Trial',
  subscription: 'Subscription',
  perpetual: 'Perpetual',
};

export default function LicenseManagement() {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activateModal, setActivateModal] = useState(false);
  const [generateModal, setGenerateModal] = useState(false);
  const [auditModal, setAuditModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [activateForm] = Form.useForm();
  const [generateForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, licensesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/licenses/status`),
        axios.get(`${API_BASE}/api/v1/licenses`),
      ]);
      setLicenseStatus(statusRes.data.data);
      setLicenses(licensesRes.data.data || []);
    } catch (error) {
      console.error('Failed to load license data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (values: { licenseKey: string; organizationName?: string }) => {
    try {
      await axios.post(`${API_BASE}/api/v1/licenses/activate`, values);
      message.success('License activated successfully.');
      setActivateModal(false);
      activateForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to activate license.');
    }
  };

  const handleGenerate = async (values: {
    type: string;
    tier: string;
    maxDevices: number;
    durationDays: number;
  }) => {
    try {
      const res = await axios.post(`${API_BASE}/api/v1/licenses/generate-key`, values);
      setGeneratedKey(res.data.data.licenseKey);
      message.success('License key generated.');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to generate key.');
    }
  };

  const handleRevoke = async (id: string) => {
    Modal.confirm({
      title: 'Revoke License',
      content: 'Are you sure you want to revoke this license? This cannot be undone.',
      okText: 'Revoke',
      okType: 'danger',
      onOk: async () => {
        try {
          await axios.post(`${API_BASE}/api/v1/licenses/${id}/revoke`);
          message.success('License revoked.');
          loadData();
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Failed to revoke license.');
        }
      },
    });
  };

  const showAuditLog = async (licenseId: string) => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/licenses/${licenseId}/audit-log`);
      setAuditLogs(res.data.data || []);
      setAuditModal(true);
    } catch (error) {
      message.error('Failed to load audit log.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard.');
  };

  const columns = [
    {
      title: 'License Key',
      dataIndex: 'licenseKey',
      key: 'licenseKey',
      render: (key: string) => (
        <Text code style={{ fontSize: '11px' }}>
          {key.length > 40 ? `${key.substring(0, 40)}...` : key}
        </Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag>{typeLabels[type] || type}</Tag>,
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      render: (tier: string) => (
        <Tag color={tier === 'ems_full' ? 'blue' : 'default'}>
          {tierLabels[tier] || tier}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Devices',
      dataIndex: 'maxDeviceCount',
      key: 'maxDeviceCount',
      render: (max: number) => `Up to ${max}`,
    },
    {
      title: 'Expires',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (d: string) => d ? new Date(d).toLocaleDateString() : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: License) => (
        <Space>
          <Button size="small" onClick={() => showAuditLog(record.id)}>
            Audit Log
          </Button>
          {(record.status === 'active' || record.status === 'grace_period') && (
            <Button size="small" danger onClick={() => handleRevoke(record.id)}>
              Revoke
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <SafetyCertificateOutlined /> License Management
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Refresh
          </Button>
          <Button type="primary" icon={<KeyOutlined />} onClick={() => setActivateModal(true)}>
            Activate License
          </Button>
          <Button onClick={() => { setGenerateModal(true); setGeneratedKey(null); generateForm.resetFields(); }}>
            Generate Key
          </Button>
        </Space>
      </div>

      {/* License Status Banner */}
      {licenseStatus && (
        <>
          {licenseStatus.warnings.length > 0 && (
            <Alert
              type={licenseStatus.status === 'grace_period' ? 'warning' : licenseStatus.valid ? 'info' : 'error'}
              message={licenseStatus.warnings.join(' ')}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="License Status"
                  value={licenseStatus.status === 'no_license' ? 'No License' : licenseStatus.status.replace('_', ' ').toUpperCase()}
                  valueStyle={{
                    color: licenseStatus.valid ? '#3f8600' : '#cf1322',
                    fontSize: '18px',
                  }}
                  prefix={licenseStatus.valid ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="License Tier"
                  value={tierLabels[licenseStatus.tier || ''] || 'None'}
                  valueStyle={{ fontSize: '18px' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Days Remaining"
                  value={licenseStatus.daysRemaining ?? 0}
                  valueStyle={{
                    color: (licenseStatus.daysRemaining ?? 0) <= 7 ? '#cf1322' : '#3f8600',
                    fontSize: '18px',
                  }}
                  prefix={(licenseStatus.daysRemaining ?? 0) <= 7 ? <WarningOutlined /> : undefined}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">Device Usage</Text>
                </div>
                <Progress
                  percent={licenseStatus.maxDevices > 0
                    ? Math.round((licenseStatus.deviceCount / licenseStatus.maxDevices) * 100)
                    : 0}
                  format={() => `${licenseStatus.deviceCount} / ${licenseStatus.maxDevices}`}
                  status={licenseStatus.deviceLimitReached ? 'exception' : 'active'}
                />
              </Card>
            </Col>
          </Row>

          {/* Current License Details */}
          {licenseStatus.valid && (
            <Card title="Active License Details" style={{ marginBottom: 24 }}>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Organization">
                  {licenseStatus.organization || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  <Tag>{typeLabels[licenseStatus.type || ''] || licenseStatus.type}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Tier">
                  <Tag color={licenseStatus.tier === 'ems_full' ? 'blue' : 'default'}>
                    {tierLabels[licenseStatus.tier || ''] || licenseStatus.tier}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Activated">
                  {licenseStatus.activatedAt ? new Date(licenseStatus.activatedAt).toLocaleString() : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Expires">
                  {licenseStatus.expiresAt ? new Date(licenseStatus.expiresAt).toLocaleString() : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Enabled Features">
                  {licenseStatus.enabledFeatures.map((f) => (
                    <Tag key={f} color="blue" style={{ marginBottom: 4 }}>
                      {f}
                    </Tag>
                  ))}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </>
      )}

      {/* License History Table */}
      <Card title="License History">
        <Table
          dataSource={licenses}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Activate License Modal */}
      <Modal
        title="Activate License Key"
        open={activateModal}
        onCancel={() => setActivateModal(false)}
        footer={null}
      >
        <Form form={activateForm} onFinish={handleActivate} layout="vertical">
          <Form.Item
            name="licenseKey"
            label="License Key"
            rules={[{ required: true, message: 'Please enter a license key' }]}
          >
            <Input.TextArea rows={3} placeholder="CANARIS-SUB-EMS-20260101-..." />
          </Form.Item>
          <Form.Item name="organizationName" label="Organization Name">
            <Input placeholder="Your organization name" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Activate
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Generate Key Modal */}
      <Modal
        title="Generate License Key"
        open={generateModal}
        onCancel={() => setGenerateModal(false)}
        footer={null}
        width={500}
      >
        <Form form={generateForm} onFinish={handleGenerate} layout="vertical">
          <Form.Item
            name="type"
            label="License Type"
            rules={[{ required: true }]}
            initialValue="subscription"
          >
            <Select
              options={[
                { value: 'trial', label: 'Trial' },
                { value: 'subscription', label: 'Subscription' },
                { value: 'perpetual', label: 'Perpetual' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="tier"
            label="License Tier"
            rules={[{ required: true }]}
            initialValue="nms_only"
          >
            <Select
              options={[
                { value: 'nms_only', label: 'NMS Only' },
                { value: 'ems_full', label: 'EMS Full' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="maxDevices"
            label="Max Devices"
            rules={[{ required: true }]}
            initialValue={50}
          >
            <InputNumber min={1} max={10000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="durationDays"
            label="Duration (days)"
            rules={[{ required: true }]}
            initialValue={365}
          >
            <InputNumber min={1} max={3650} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Generate Key
            </Button>
          </Form.Item>
        </Form>

        {generatedKey && (
          <>
            <Divider />
            <Alert
              type="success"
              message="License Key Generated"
              description={
                <div>
                  <Text code style={{ wordBreak: 'break-all', fontSize: '11px' }}>
                    {generatedKey}
                  </Text>
                  <Button
                    icon={<CopyOutlined />}
                    size="small"
                    style={{ marginTop: 8 }}
                    onClick={() => copyToClipboard(generatedKey)}
                  >
                    Copy Key
                  </Button>
                </div>
              }
            />
          </>
        )}
      </Modal>

      {/* Audit Log Modal */}
      <Modal
        title="License Audit Log"
        open={auditModal}
        onCancel={() => setAuditModal(false)}
        footer={null}
        width={600}
      >
        <Timeline
          items={auditLogs.map((log) => ({
            color: log.action === 'revoked' || log.action.includes('expired') ? 'red' :
                   log.action === 'activated' || log.action === 'created' ? 'green' : 'blue',
            children: (
              <div>
                <Text strong>{log.action.replace(/_/g, ' ').toUpperCase()}</Text>
                <br />
                <Text type="secondary">{log.details}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {new Date(log.createdAt).toLocaleString()} by {log.performedBy}
                </Text>
              </div>
            ),
          }))}
        />
        {auditLogs.length === 0 && <Text type="secondary">No audit logs found.</Text>}
      </Modal>
    </div>
  );
}
