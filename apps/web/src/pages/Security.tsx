import { useState, useEffect, useCallback, useRef } from 'react';
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
  Modal,
  Descriptions,
  Typography,
  Badge,
  Tooltip,
  Spin,
  message,
  Form,
  Input,
  Popconfirm,
  Timeline,
  Upload,
} from 'antd';
import {
  SafetyCertificateOutlined,
  BugOutlined,
  AlertOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  EyeOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  UploadOutlined,
  StopOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { securityAPI } from '../services/api';
import type {
  SslCertificate,
  SslSummary,
  IocEntry,
  IocSummary,
  SignatureAlert,
  SignatureSummary,
  PacketDrilldown,
  DdosEvent,
  DdosSummary,
  DdosReport,
  SecurityOverview,
} from '../types';

const { Text, Title } = Typography;
const { TextArea } = Input;

const REFRESH_INTERVAL = 30000;

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#f5222d',
  high: '#fa541c',
  medium: '#faad14',
  low: '#1890ff',
  info: '#8c8c8c',
};

const STATUS_COLORS: Record<string, string> = {
  valid: 'green',
  expired: 'red',
  expiring_soon: 'orange',
  self_signed: 'gold',
  invalid: 'red',
  revoked: 'volcano',
  active: 'red',
  matched: 'orange',
  false_positive: 'default',
  mitigated: 'blue',
  resolved: 'green',
  open: 'blue',
  acknowledged: 'cyan',
  dismissed: 'default',
  escalated: 'volcano',
};

const PIE_COLORS = ['#52c41a', '#f5222d', '#fa8c16', '#fadb14', '#ff4d4f', '#722ed1'];

const MITIGATION_STRATEGIES = [
  'BGP Blackhole',
  'Rate Limiting',
  'Traffic Scrubbing',
  'GeoIP Blocking',
  'ACL Filtering',
  'CDN Absorption',
  'Upstream Filtering',
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Security() {
  const [activeTab, setActiveTab] = useState('ssl');
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const data = await securityAPI.getOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load security overview', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadOverview().finally(() => setLoading(false));
  }, [loadOverview]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      loadOverview();
    }, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadOverview]);

  if (loading && !overview) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="SSL Security Score"
              value={overview?.ssl.averageScore ?? 0}
              suffix="/ 100"
              valueStyle={{
                color:
                  (overview?.ssl.averageScore ?? 0) >= 80
                    ? '#3f8600'
                    : (overview?.ssl.averageScore ?? 0) >= 50
                    ? '#faad14'
                    : '#cf1322',
              }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="IOC Matches"
              value={overview?.ioc.totalMatches ?? 0}
              valueStyle={{ color: '#fa541c' }}
              prefix={<BugOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Signature Alerts (24h)"
              value={overview?.signatures.last24h ?? 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Active DDoS Attacks"
              value={overview?.ddos.active ?? 0}
              valueStyle={{
                color: (overview?.ddos.active ?? 0) > 0 ? '#f5222d' : '#3f8600',
              }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'ssl',
              label: (
                <span>
                  <SafetyCertificateOutlined /> SSL/TLS Analysis
                </span>
              ),
              children: <SslTab />,
            },
            {
              key: 'ioc',
              label: (
                <span>
                  <BugOutlined /> IOC Threats
                </span>
              ),
              children: <IocTab />,
            },
            {
              key: 'signatures',
              label: (
                <span>
                  <AlertOutlined /> Signature Alerts
                </span>
              ),
              children: <SignaturesTab />,
            },
            {
              key: 'ddos',
              label: (
                <span>
                  <ThunderboltOutlined /> DDoS Detection
                </span>
              ),
              children: <DdosTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
}

// ============================================================================
// TAB 1: SSL/TLS (Enhanced details modal)
// ============================================================================

function SslTab() {
  const [certs, setCerts] = useState<SslCertificate[]>([]);
  const [summary, setSummary] = useState<SslSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCert, setSelectedCert] = useState<SslCertificate | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [certRes, sum] = await Promise.all([
        securityAPI.getSslCertificates({ status: statusFilter, limit: 100 }),
        securityAPI.getSslSummary(),
      ]);
      setCerts(certRes.data);
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load SSL data', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    intervalRef.current = setInterval(load, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const pieData = summary?.statusBreakdown
    ?.filter((s) => s.count > 0)
    .map((s) => ({ name: s.status.replace('_', ' '), value: s.count })) || [];

  const columns = [
    {
      title: 'Hostname',
      dataIndex: 'hostname',
      key: 'hostname',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLORS[s] || 'default'}>{s.replace('_', ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'TLS Version',
      dataIndex: 'tlsVersion',
      key: 'tlsVersion',
      render: (v: string) => {
        const color = v.includes('1.3') ? 'green' : v.includes('1.2') ? 'blue' : 'red';
        return <Tag color={color}>{v}</Tag>;
      },
    },
    {
      title: 'Issuer',
      dataIndex: 'issuer',
      key: 'issuer',
      ellipsis: true,
    },
    {
      title: 'Expires',
      dataIndex: 'daysUntilExpiry',
      key: 'daysUntilExpiry',
      sorter: (a: SslCertificate, b: SslCertificate) => a.daysUntilExpiry - b.daysUntilExpiry,
      render: (d: number) => (
        <Text type={d <= 0 ? 'danger' : d <= 30 ? 'warning' : undefined}>
          {d <= 0 ? `Expired ${Math.abs(d)}d ago` : `${d} days`}
        </Text>
      ),
    },
    {
      title: 'Score',
      dataIndex: 'securityScore',
      key: 'securityScore',
      sorter: (a: SslCertificate, b: SslCertificate) => a.securityScore - b.securityScore,
      render: (s: number) => (
        <Text strong style={{ color: s >= 80 ? '#3f8600' : s >= 50 ? '#faad14' : '#cf1322' }}>
          {s}
        </Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: SslCertificate) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedCert(record)}>
          Details
        </Button>
      ),
    },
  ];

  // Parse cipher suite info for the details modal
  const parseCipherSuite = (suite: string) => {
    const parts: { algorithm: string; keyExchange: string; strength: string } = {
      algorithm: 'Unknown',
      keyExchange: 'Unknown',
      strength: 'Unknown',
    };
    if (suite.includes('AES_256') || suite.includes('AES256')) {
      parts.algorithm = 'AES-256';
      parts.strength = 'Strong (256-bit)';
    } else if (suite.includes('AES_128') || suite.includes('AES128')) {
      parts.algorithm = 'AES-128';
      parts.strength = 'Good (128-bit)';
    } else if (suite.includes('CHACHA20')) {
      parts.algorithm = 'ChaCha20-Poly1305';
      parts.strength = 'Strong (256-bit)';
    } else if (suite.includes('DES') || suite.includes('RC4')) {
      parts.algorithm = suite.includes('DES') ? '3DES' : 'RC4';
      parts.strength = 'Weak';
    }
    if (suite.includes('ECDHE')) parts.keyExchange = 'ECDHE';
    else if (suite.includes('DHE')) parts.keyExchange = 'DHE';
    else if (suite.startsWith('TLS_')) parts.keyExchange = 'TLS 1.3 (built-in)';
    if (suite.includes('GCM')) parts.algorithm += ' (GCM mode)';
    else if (suite.includes('SHA384')) parts.algorithm += ' (SHA384)';
    else if (suite.includes('SHA256')) parts.algorithm += ' (SHA256)';
    return parts;
  };

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="Total Certificates" value={summary?.total ?? 0} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Valid" value={summary?.valid ?? 0} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Expired" value={summary?.expired ?? 0} valueStyle={{ color: '#cf1322' }} prefix={<CloseCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Expiring Soon" value={summary?.expiringSoon ?? 0} valueStyle={{ color: '#faad14' }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card title="Certificate Status Distribution" size="small">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={16}>
          <Space style={{ marginBottom: 12 }}>
            <Select
              placeholder="Filter by status"
              allowClear
              style={{ width: 180 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: 'Valid', value: 'valid' },
                { label: 'Expired', value: 'expired' },
                { label: 'Expiring Soon', value: 'expiring_soon' },
                { label: 'Self-Signed', value: 'self_signed' },
                { label: 'Invalid', value: 'invalid' },
                { label: 'Revoked', value: 'revoked' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={load}>
              Refresh
            </Button>
          </Space>
          <Table
            dataSource={certs}
            columns={columns}
            rowKey="id"
            size="small"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Col>
      </Row>

      <Modal
        title="Certificate Details"
        open={!!selectedCert}
        onCancel={() => setSelectedCert(null)}
        footer={null}
        width={800}
      >
        {selectedCert && (() => {
          const cipher = parseCipherSuite(selectedCert.cipherSuite);
          return (
            <div>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Hostname" span={2}>{selectedCert.hostname}:{selectedCert.port}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={STATUS_COLORS[selectedCert.status]}>{selectedCert.status.replace('_', ' ').toUpperCase()}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Security Score">
                  <Text strong style={{ color: selectedCert.securityScore >= 80 ? '#3f8600' : selectedCert.securityScore >= 50 ? '#faad14' : '#cf1322' }}>
                    {selectedCert.securityScore}/100
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Serial Number" span={2}><Text code>{selectedCert.serialNumber}</Text></Descriptions.Item>
                <Descriptions.Item label="Fingerprint" span={2}><Text code style={{ fontSize: 11 }}>{selectedCert.fingerprint}</Text></Descriptions.Item>
              </Descriptions>

              <Title level={5} style={{ marginTop: 16 }}>Certificate Chain</Title>
              <Timeline style={{ marginTop: 8 }}>
                <Timeline.Item color="green">
                  <Text strong>Leaf Certificate</Text>
                  <br />
                  <Text type="secondary">Subject: </Text><Text>{selectedCert.subject}</Text>
                  <br />
                  <Text type="secondary">Issued: {new Date(selectedCert.issuedAt).toLocaleDateString()} - Expires: {new Date(selectedCert.expiresAt).toLocaleDateString()}</Text>
                </Timeline.Item>
                <Timeline.Item color={selectedCert.isSelfSigned ? 'red' : 'blue'}>
                  <Text strong>Issuing CA</Text>
                  <br />
                  <Text>{selectedCert.issuer}</Text>
                  {selectedCert.isSelfSigned && <Tag color="red" style={{ marginLeft: 8 }}>Self-Signed</Tag>}
                </Timeline.Item>
                {!selectedCert.isSelfSigned && (
                  <Timeline.Item color={selectedCert.isChainValid ? 'green' : 'red'}>
                    <Text strong>Chain Validation</Text>
                    <br />
                    <Tag color={selectedCert.isChainValid ? 'green' : 'red'}>
                      {selectedCert.isChainValid ? 'Chain Valid' : 'Chain Invalid'}
                    </Tag>
                  </Timeline.Item>
                )}
              </Timeline>

              <Title level={5}>Cipher Suite Breakdown</Title>
              <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Cipher Suite" span={2}><Text code>{selectedCert.cipherSuite}</Text></Descriptions.Item>
                <Descriptions.Item label="TLS Version">
                  <Tag color={selectedCert.tlsVersion.includes('1.3') ? 'green' : selectedCert.tlsVersion.includes('1.2') ? 'blue' : 'red'}>
                    {selectedCert.tlsVersion}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Key Length">{selectedCert.keyLength} bits</Descriptions.Item>
                <Descriptions.Item label="Key Exchange">{cipher.keyExchange}</Descriptions.Item>
                <Descriptions.Item label="Encryption">{cipher.algorithm}</Descriptions.Item>
                <Descriptions.Item label="Strength" span={2}>
                  <Tag color={cipher.strength.includes('Strong') ? 'green' : cipher.strength.includes('Good') ? 'blue' : 'red'}>
                    {cipher.strength}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>

              {selectedCert.vulnerabilities?.length > 0 && (
                <>
                  <Title level={5}>Vulnerabilities</Title>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedCert.vulnerabilities.map((v, i) => {
                      const sevLevel = v.includes('POODLE') || v.includes('BEAST') ? 'critical'
                        : v.includes('Weak key') ? 'high'
                        : v.includes('Self-signed') ? 'medium'
                        : 'low';
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Tag color={SEVERITY_COLORS[sevLevel]}>{sevLevel.toUpperCase()}</Tag>
                          <Text>{v}</Text>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

// ============================================================================
// TAB 2: IOC Threats (Add/Import/False Positive/Detail)
// ============================================================================

function IocTab() {
  const [entries, setEntries] = useState<IocEntry[]>([]);
  const [summary, setSummary] = useState<IocSummary | null>(null);
  const [recentMatches, setRecentMatches] = useState<IocEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [severityFilter, setSeverityFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState<IocEntry | null>(null);
  const [csvContent, setCsvContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addForm] = Form.useForm();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [entryRes, sum, matches] = await Promise.all([
        securityAPI.getIocEntries({ type: typeFilter, severity: severityFilter, status: statusFilter, limit: 100 }),
        securityAPI.getIocSummary(),
        securityAPI.getIocRecentMatches(10),
      ]);
      setEntries(entryRes.data);
      setSummary(sum);
      setRecentMatches(matches);
    } catch (err) {
      console.error('Failed to load IOC data', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, severityFilter, statusFilter]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    intervalRef.current = setInterval(load, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const handleAddIoc = async (values: any) => {
    setSubmitting(true);
    try {
      await securityAPI.createIocEntry(values);
      message.success('IOC entry created');
      setAddModalOpen(false);
      addForm.resetFields();
      load();
    } catch {
      message.error('Failed to create IOC entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportCsv = async () => {
    if (!csvContent.trim()) {
      message.warning('Please provide CSV content');
      return;
    }
    setSubmitting(true);
    try {
      const result = await securityAPI.importIocCsv(csvContent);
      message.success(`Imported ${result.imported} entries (${result.errors} errors)`);
      setImportModalOpen(false);
      setCsvContent('');
      load();
    } catch {
      message.error('Failed to import CSV');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkFalsePositive = async (id: string) => {
    try {
      await securityAPI.updateIocStatus(id, 'false_positive');
      message.success('Marked as false positive');
      load();
    } catch {
      message.error('Failed to update status');
    }
  };

  const columns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => <Tag>{t.replace('_', ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Indicator',
      dataIndex: 'indicator',
      key: 'indicator',
      render: (text: string, record: IocEntry) => (
        <a onClick={() => setDetailModal(record)} style={{ fontFamily: 'monospace', fontSize: 12 }}>{text}</a>
      ),
      ellipsis: true,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (s: string) => <Tag color={SEVERITY_COLORS[s]}>{s.toUpperCase()}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLORS[s]}>{s.replace('_', ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      ellipsis: true,
    },
    {
      title: 'Threat Type',
      dataIndex: 'threatType',
      key: 'threatType',
    },
    {
      title: 'Matches',
      dataIndex: 'matchCount',
      key: 'matchCount',
      sorter: (a: IocEntry, b: IocEntry) => a.matchCount - b.matchCount,
      render: (c: number) => <Text strong style={{ color: c > 0 ? '#fa541c' : undefined }}>{c}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_: any, record: IocEntry) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailModal(record)} />
          {record.status !== 'false_positive' && (
            <Popconfirm
              title="Mark as false positive?"
              description="This IOC will be marked as a false positive."
              onConfirm={() => handleMarkFalsePositive(record.id)}
              okText="Yes"
            >
              <Button size="small" danger icon={<StopOutlined />}>
                FP
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card size="small"><Statistic title="Total IOCs" value={summary?.total ?? 0} /></Card>
        </Col>
        <Col span={5}>
          <Card size="small"><Statistic title="Active" value={summary?.active ?? 0} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={5}>
          <Card size="small"><Statistic title="Matched" value={summary?.matched ?? 0} valueStyle={{ color: '#fa541c' }} /></Card>
        </Col>
        <Col span={5}>
          <Card size="small"><Statistic title="Total Matches" value={summary?.totalMatches ?? 0} valueStyle={{ color: '#f5222d' }} /></Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="False Positives" value={summary?.falsePositive ?? 0} /></Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 12 }} wrap>
        <Select placeholder="Type" allowClear style={{ width: 140 }} value={typeFilter} onChange={setTypeFilter}
          options={[
            { label: 'IP Address', value: 'ip_address' },
            { label: 'Domain', value: 'domain' },
            { label: 'URL', value: 'url' },
            { label: 'File Hash', value: 'file_hash' },
            { label: 'Email', value: 'email' },
          ]}
        />
        <Select placeholder="Severity" allowClear style={{ width: 130 }} value={severityFilter} onChange={setSeverityFilter}
          options={['critical', 'high', 'medium', 'low', 'info'].map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))}
        />
        <Select placeholder="Status" allowClear style={{ width: 140 }} value={statusFilter} onChange={setStatusFilter}
          options={[
            { label: 'Active', value: 'active' },
            { label: 'Matched', value: 'matched' },
            { label: 'Expired', value: 'expired' },
            { label: 'False Positive', value: 'false_positive' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>Add IOC</Button>
        <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>Import CSV</Button>
      </Space>

      <Table dataSource={entries} columns={columns} rowKey="id" size="small" loading={loading} pagination={{ pageSize: 10 }} />

      {recentMatches.length > 0 && (
        <Card title="Recent IOC Matches" size="small" style={{ marginTop: 16 }}>
          <Table
            dataSource={recentMatches}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: 'Indicator', dataIndex: 'indicator', key: 'indicator', render: (t: string) => <Text code style={{ fontFamily: 'monospace', fontSize: 12 }}>{t}</Text>, ellipsis: true },
              { title: 'Type', dataIndex: 'type', key: 'type', render: (t: string) => <Tag>{t.replace('_', ' ')}</Tag> },
              { title: 'Source IP', dataIndex: 'lastMatchedSourceIp', key: 'srcIp' },
              { title: 'Dest IP', dataIndex: 'lastMatchedDestIp', key: 'dstIp' },
              { title: 'Time', dataIndex: 'lastMatchedAt', key: 'time', render: (d: string) => new Date(d).toLocaleString() },
            ]}
          />
        </Card>
      )}

      {/* Add IOC Modal */}
      <Modal
        title="Add IOC Entry"
        open={addModalOpen}
        onCancel={() => { setAddModalOpen(false); addForm.resetFields(); }}
        footer={null}
        width={500}
      >
        <Form form={addForm} onFinish={handleAddIoc} layout="vertical">
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={[
              { label: 'IP Address', value: 'ip_address' },
              { label: 'Domain', value: 'domain' },
              { label: 'URL', value: 'url' },
              { label: 'File Hash', value: 'file_hash' },
              { label: 'Email', value: 'email' },
            ]} />
          </Form.Item>
          <Form.Item name="indicator" label="Indicator" rules={[{ required: true }]}>
            <Input placeholder="e.g. 192.168.1.1, evil.com, hash..." />
          </Form.Item>
          <Form.Item name="source" label="Source" rules={[{ required: true }]}>
            <Input placeholder="e.g. AlienVault OTX, Manual Entry" />
          </Form.Item>
          <Form.Item name="severity" label="Severity">
            <Select allowClear options={['critical', 'high', 'medium', 'low', 'info'].map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))} />
          </Form.Item>
          <Form.Item name="threatType" label="Threat Type">
            <Input placeholder="e.g. C2 Server, Malware Distribution" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block>Create IOC Entry</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        title="Import IOC from CSV"
        open={importModalOpen}
        onCancel={() => { setImportModalOpen(false); setCsvContent(''); }}
        onOk={handleImportCsv}
        okText="Import"
        confirmLoading={submitting}
        width={600}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Format: type,indicator,source,severity,threatType,description (one per line). Header row is optional.
        </Text>
        <Upload.Dragger
          accept=".csv,.txt"
          beforeUpload={(file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              setCsvContent(e.target?.result as string || '');
            };
            reader.readAsText(file);
            return false;
          }}
          showUploadList={false}
          style={{ marginBottom: 12 }}
        >
          <p><UploadOutlined style={{ fontSize: 24 }} /></p>
          <p>Click or drag a CSV file here</p>
        </Upload.Dragger>
        <TextArea
          rows={8}
          value={csvContent}
          onChange={(e) => setCsvContent(e.target.value)}
          placeholder="type,indicator,source,severity,threatType,description&#10;ip_address,192.168.1.100,Manual,high,C2 Server,Known C2 endpoint"
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>

      {/* IOC Detail Modal */}
      <Modal
        title="IOC Details"
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={600}
      >
        {detailModal && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Type"><Tag>{detailModal.type.replace('_', ' ').toUpperCase()}</Tag></Descriptions.Item>
            <Descriptions.Item label="Status"><Tag color={STATUS_COLORS[detailModal.status]}>{detailModal.status.replace('_', ' ').toUpperCase()}</Tag></Descriptions.Item>
            <Descriptions.Item label="Indicator" span={2}><Text code style={{ fontFamily: 'monospace' }}>{detailModal.indicator}</Text></Descriptions.Item>
            <Descriptions.Item label="Severity"><Tag color={SEVERITY_COLORS[detailModal.severity]}>{detailModal.severity.toUpperCase()}</Tag></Descriptions.Item>
            <Descriptions.Item label="Source">{detailModal.source}</Descriptions.Item>
            <Descriptions.Item label="Threat Type" span={2}>{detailModal.threatType || '-'}</Descriptions.Item>
            <Descriptions.Item label="Description" span={2}>{detailModal.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="Match Count"><Text strong style={{ color: detailModal.matchCount > 0 ? '#fa541c' : undefined }}>{detailModal.matchCount}</Text></Descriptions.Item>
            <Descriptions.Item label="Last Matched">{detailModal.lastMatchedAt ? new Date(detailModal.lastMatchedAt).toLocaleString() : '-'}</Descriptions.Item>
            <Descriptions.Item label="Last Match Source IP">{detailModal.lastMatchedSourceIp || '-'}</Descriptions.Item>
            <Descriptions.Item label="Last Match Dest IP">{detailModal.lastMatchedDestIp || '-'}</Descriptions.Item>
            <Descriptions.Item label="Expires At">{detailModal.expiresAt ? new Date(detailModal.expiresAt).toLocaleString() : '-'}</Descriptions.Item>
            <Descriptions.Item label="Created At">{new Date(detailModal.createdAt).toLocaleString()}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

// ============================================================================
// TAB 3: Signature Alerts (Status/Actions/Bulk)
// ============================================================================

function SignaturesTab() {
  const [alerts, setAlerts] = useState<SignatureAlert[]>([]);
  const [summary, setSummary] = useState<SignatureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<string | undefined>();
  const [sevFilter, setSevFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [packetModal, setPacketModal] = useState<PacketDrilldown | null>(null);
  const [packetLoading, setPacketLoading] = useState(false);
  const [escalateModal, setEscalateModal] = useState<string | null>(null);
  const [escalateNotes, setEscalateNotes] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkEscalateOpen, setBulkEscalateOpen] = useState(false);
  const [bulkEscalateNotes, setBulkEscalateNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [alertRes, sum] = await Promise.all([
        securityAPI.getSignatureAlerts({ category: catFilter, severity: sevFilter, status: statusFilter, limit: 100 }),
        securityAPI.getSignatureSummary(),
      ]);
      setAlerts(alertRes.data);
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load signature data', err);
    } finally {
      setLoading(false);
    }
  }, [catFilter, sevFilter, statusFilter]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    intervalRef.current = setInterval(load, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const openPacket = async (id: string) => {
    setPacketLoading(true);
    try {
      const data = await securityAPI.getPacketDrilldown(id);
      if (data) {
        setPacketModal(data);
      } else {
        message.warning('No packet data available');
      }
    } catch {
      message.error('Failed to load packet data');
    } finally {
      setPacketLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    setActionLoading(true);
    try {
      await securityAPI.acknowledgeSignatureAlert(id, 'admin');
      message.success('Alert acknowledged');
      load();
    } catch {
      message.error('Failed to acknowledge');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async (id: string) => {
    setActionLoading(true);
    try {
      await securityAPI.dismissSignatureAlert(id, 'admin');
      message.success('Alert dismissed');
      load();
    } catch {
      message.error('Failed to dismiss');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!escalateModal) return;
    setActionLoading(true);
    try {
      await securityAPI.escalateSignatureAlert(escalateModal, 'admin', escalateNotes);
      message.success('Alert escalated');
      setEscalateModal(null);
      setEscalateNotes('');
      load();
    } catch {
      message.error('Failed to escalate');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAction = async (action: 'acknowledge' | 'dismiss' | 'escalate') => {
    if (selectedRowKeys.length === 0) {
      message.warning('Select alerts first');
      return;
    }
    if (action === 'escalate') {
      setBulkEscalateOpen(true);
      return;
    }
    setActionLoading(true);
    try {
      const result = await securityAPI.bulkSignatureAction(selectedRowKeys, action, 'admin');
      message.success(`${result.updated} alerts ${action}d`);
      setSelectedRowKeys([]);
      load();
    } catch {
      message.error(`Failed to bulk ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkEscalate = async () => {
    setActionLoading(true);
    try {
      const result = await securityAPI.bulkSignatureAction(selectedRowKeys, 'escalate', 'admin', bulkEscalateNotes);
      message.success(`${result.updated} alerts escalated`);
      setSelectedRowKeys([]);
      setBulkEscalateOpen(false);
      setBulkEscalateNotes('');
      load();
    } catch {
      message.error('Failed to bulk escalate');
    } finally {
      setActionLoading(false);
    }
  };

  const catChartData = summary?.byCategory?.map((c) => ({
    name: c.category.replace('_', ' '),
    count: parseInt(c.count),
  })) || [];

  const columns = [
    {
      title: 'Signature',
      key: 'sig',
      render: (_: any, r: SignatureAlert) => (
        <div>
          <Text strong style={{ fontSize: 12 }}>{r.signatureName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.signatureId}</Text>
        </div>
      ),
      ellipsis: true,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (s: string) => <Tag color={SEVERITY_COLORS[s]}>{s.toUpperCase()}</Tag>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (c: string) => <Tag>{c.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string) => <Tag color={STATUS_COLORS[s] || 'blue'}>{(s || 'open').toUpperCase()}</Tag>,
    },
    {
      title: 'Source',
      key: 'source',
      width: 155,
      render: (_: any, r: SignatureAlert) => <Text code style={{ fontSize: 11 }}>{r.sourceIp}:{r.sourcePort}</Text>,
    },
    {
      title: 'Destination',
      key: 'dest',
      width: 155,
      render: (_: any, r: SignatureAlert) => <Text code style={{ fontSize: 11 }}>{r.destinationIp}:{r.destinationPort}</Text>,
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 150,
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: any, r: SignatureAlert) => {
        const st = r.status || 'open';
        return (
          <Space size="small" wrap>
            <Button size="small" icon={<EyeOutlined />} loading={packetLoading} onClick={() => openPacket(r.id)}>
              Packet
            </Button>
            {st === 'open' && (
              <>
                <Button size="small" type="primary" ghost onClick={() => handleAcknowledge(r.id)} loading={actionLoading}>
                  Ack
                </Button>
                <Button size="small" onClick={() => handleDismiss(r.id)} loading={actionLoading}>
                  Dismiss
                </Button>
                <Button size="small" danger onClick={() => setEscalateModal(r.id)}>
                  Escalate
                </Button>
              </>
            )}
            {st === 'acknowledged' && (
              <>
                <Button size="small" onClick={() => handleDismiss(r.id)} loading={actionLoading}>
                  Dismiss
                </Button>
                <Button size="small" danger onClick={() => setEscalateModal(r.id)}>
                  Escalate
                </Button>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
  };

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="Total Alerts" value={summary?.total ?? 0} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="Last 24 Hours" value={summary?.last24h ?? 0} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Critical (Last Hour)" value={summary?.criticalLastHour ?? 0} valueStyle={{ color: '#f5222d' }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card title="Alerts by Category" size="small">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={catChartData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                <Bar dataKey="count" fill="#1890ff" />
                <RTooltip />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 12 }} wrap>
        <Select placeholder="Category" allowClear style={{ width: 160 }} value={catFilter} onChange={setCatFilter}
          options={['malware', 'exploit', 'reconnaissance', 'policy_violation', 'protocol_anomaly', 'suspicious'].map((c) => ({
            label: c.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            value: c,
          }))}
        />
        <Select placeholder="Severity" allowClear style={{ width: 130 }} value={sevFilter} onChange={setSevFilter}
          options={['critical', 'high', 'medium', 'low', 'info'].map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))}
        />
        <Select placeholder="Status" allowClear style={{ width: 140 }} value={statusFilter} onChange={setStatusFilter}
          options={[
            { label: 'Open', value: 'open' },
            { label: 'Acknowledged', value: 'acknowledged' },
            { label: 'Dismissed', value: 'dismissed' },
            { label: 'Escalated', value: 'escalated' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
      </Space>

      {selectedRowKeys.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#e6f7ff', borderRadius: 4 }}>
          <Space>
            <Text>{selectedRowKeys.length} alert(s) selected</Text>
            <Button size="small" type="primary" ghost onClick={() => handleBulkAction('acknowledge')} loading={actionLoading}>
              Bulk Acknowledge
            </Button>
            <Button size="small" onClick={() => handleBulkAction('dismiss')} loading={actionLoading}>
              Bulk Dismiss
            </Button>
            <Button size="small" danger onClick={() => handleBulkAction('escalate')}>
              Bulk Escalate
            </Button>
            <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear Selection</Button>
          </Space>
        </div>
      )}

      <Table
        dataSource={alerts}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1400 }}
        rowSelection={rowSelection}
      />

      {/* Packet Drilldown Modal */}
      <Modal
        title="Packet Drilldown"
        open={!!packetModal}
        onCancel={() => setPacketModal(null)}
        footer={null}
        width={800}
      >
        {packetModal && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Signature ID">{packetModal.signatureId}</Descriptions.Item>
              <Descriptions.Item label="Packet Length">{packetModal.packetLength} bytes</Descriptions.Item>
              <Descriptions.Item label="Signature Name" span={2}>{packetModal.signatureName}</Descriptions.Item>
            </Descriptions>
            <div
              style={{
                background: '#1e1e1e',
                color: '#d4d4d4',
                padding: 16,
                borderRadius: 6,
                fontFamily: '"Cascadia Code", "Fira Code", "Consolas", monospace',
                fontSize: 12,
                lineHeight: 1.6,
                overflowX: 'auto',
                maxHeight: 400,
                whiteSpace: 'pre',
              }}
            >
              {packetModal.hexDump}
            </div>
          </div>
        )}
      </Modal>

      {/* Escalate Single Alert Modal */}
      <Modal
        title="Escalate Alert"
        open={!!escalateModal}
        onCancel={() => { setEscalateModal(null); setEscalateNotes(''); }}
        onOk={handleEscalate}
        okText="Escalate"
        confirmLoading={actionLoading}
        okButtonProps={{ danger: true }}
      >
        <Text type="secondary">Provide escalation notes (optional):</Text>
        <TextArea
          rows={4}
          value={escalateNotes}
          onChange={(e) => setEscalateNotes(e.target.value)}
          placeholder="Describe why this alert is being escalated..."
          style={{ marginTop: 8 }}
        />
      </Modal>

      {/* Bulk Escalate Modal */}
      <Modal
        title={`Bulk Escalate ${selectedRowKeys.length} Alert(s)`}
        open={bulkEscalateOpen}
        onCancel={() => { setBulkEscalateOpen(false); setBulkEscalateNotes(''); }}
        onOk={handleBulkEscalate}
        okText="Escalate All"
        confirmLoading={actionLoading}
        okButtonProps={{ danger: true }}
      >
        <Text type="secondary">Provide escalation notes for all selected alerts (optional):</Text>
        <TextArea
          rows={4}
          value={bulkEscalateNotes}
          onChange={(e) => setBulkEscalateNotes(e.target.value)}
          placeholder="Describe the reason for bulk escalation..."
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
}

// ============================================================================
// TAB 4: DDoS Detection (Mitigate/Resolve controls)
// ============================================================================

function DdosTab() {
  const [events, setEvents] = useState<DdosEvent[]>([]);
  const [activeAttacks, setActiveAttacks] = useState<DdosEvent[]>([]);
  const [summary, setSummary] = useState<DdosSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportModal, setReportModal] = useState<DdosReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [mitigateModal, setMitigateModal] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<string | null>(null);
  const [mitigateStrategy, setMitigateStrategy] = useState<string>('BGP Blackhole');
  const [mitigateNotes, setMitigateNotes] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [evRes, active, sum] = await Promise.all([
        securityAPI.getDdosEvents({ limit: 50 }),
        securityAPI.getDdosActiveAttacks(),
        securityAPI.getDdosSummary(),
      ]);
      setEvents(evRes.data);
      setActiveAttacks(active);
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load DDoS data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    intervalRef.current = setInterval(load, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const openReport = async (id: string) => {
    setReportLoading(true);
    try {
      const data = await securityAPI.getDdosReport(id);
      if (data) {
        setReportModal(data);
      } else {
        message.warning('Report not available');
      }
    } catch {
      message.error('Failed to load report');
    } finally {
      setReportLoading(false);
    }
  };

  const handleMitigate = async () => {
    if (!mitigateModal) return;
    setActionLoading(true);
    try {
      await securityAPI.mitigateDdosEvent(mitigateModal, {
        strategy: mitigateStrategy,
        initiatedBy: 'admin',
        notes: mitigateNotes || undefined,
      });
      message.success('Mitigation initiated');
      setMitigateModal(null);
      setMitigateNotes('');
      load();
    } catch {
      message.error('Failed to initiate mitigation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    setActionLoading(true);
    try {
      await securityAPI.resolveDdosEvent(resolveModal, {
        resolvedBy: 'admin',
        notes: resolveNotes || undefined,
      });
      message.success('Event resolved');
      setResolveModal(null);
      setResolveNotes('');
      load();
    } catch {
      message.error('Failed to resolve');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const eventColumns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const color = STATUS_COLORS[s] || 'default';
        return <Badge status={s === 'active' ? 'processing' : s === 'mitigated' ? 'warning' : 'success'} text={<Tag color={color}>{s.toUpperCase()}</Tag>} />;
      },
    },
    {
      title: 'Attack Type',
      dataIndex: 'attackType',
      key: 'attackType',
      width: 120,
      render: (t: string) => <Tag color="volcano">{t.toUpperCase()}</Tag>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (s: string) => <Tag color={SEVERITY_COLORS[s]}>{s.toUpperCase()}</Tag>,
    },
    {
      title: 'Target',
      key: 'target',
      render: (_: any, r: DdosEvent) => (
        <div>
          <Text code style={{ fontSize: 11 }}>{r.targetIp}:{r.targetPort}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.targetAssetName}</Text>
        </div>
      ),
    },
    {
      title: 'Peak BW',
      dataIndex: 'peakBandwidthGbps',
      key: 'peak',
      width: 100,
      sorter: (a: DdosEvent, b: DdosEvent) => a.peakBandwidthGbps - b.peakBandwidthGbps,
      render: (v: number) => <Text strong>{v.toFixed(2)} Gbps</Text>,
    },
    {
      title: 'Duration',
      dataIndex: 'durationSeconds',
      key: 'duration',
      width: 90,
      render: (s: number) => formatDuration(s),
    },
    {
      title: 'Sources',
      key: 'sources',
      width: 80,
      render: (_: any, r: DdosEvent) => r.sourceIps?.length || 0,
    },
    {
      title: 'Detected',
      dataIndex: 'detectedAt',
      key: 'detectedAt',
      width: 150,
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: any, r: DdosEvent) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} loading={reportLoading} onClick={() => openReport(r.id)}>
            Report
          </Button>
          {r.status === 'active' && (
            <Button size="small" type="primary" danger onClick={() => setMitigateModal(r.id)}>
              Mitigate
            </Button>
          )}
          {r.status === 'mitigated' && (
            <Button size="small" type="primary" onClick={() => setResolveModal(r.id)}>
              Resolve
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Active attack banner */}
      {activeAttacks.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(90deg, #ff4d4f 0%, #cf1322 100%)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 6,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animation: 'pulse 2s infinite',
          }}
        >
          <ThunderboltOutlined style={{ fontSize: 24 }} />
          <div>
            <Text strong style={{ color: '#fff', fontSize: 16 }}>
              {activeAttacks.length} Active DDoS Attack{activeAttacks.length > 1 ? 's' : ''} Detected
            </Text>
            <br />
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
              Targets: {activeAttacks.map((a) => `${a.targetIp} (${a.peakBandwidthGbps.toFixed(1)} Gbps)`).join(', ')}
            </Text>
          </div>
        </div>
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card size="small"><Statistic title="Total Events" value={summary?.total ?? 0} /></Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="Active" value={summary?.active ?? 0} valueStyle={{ color: (summary?.active ?? 0) > 0 ? '#f5222d' : '#3f8600' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small"><Statistic title="Mitigated" value={summary?.mitigated ?? 0} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={5}>
          <Card size="small"><Statistic title="Peak Bandwidth" value={summary?.peakBandwidthGbps?.toFixed(2) ?? 0} suffix="Gbps" /></Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="Avg Duration" value={formatDuration(summary?.averageDurationSeconds ?? 0)} /></Card>
        </Col>
      </Row>

      {activeAttacks.length > 0 && (
        <Card title="Active Attacks" size="small" style={{ marginBottom: 16, borderColor: '#ff4d4f' }}>
          <Table
            dataSource={activeAttacks}
            columns={eventColumns.filter((c) => c.key !== 'status')}
            rowKey="id"
            size="small"
            pagination={false}
            rowClassName={() => 'active-attack-row'}
          />
        </Card>
      )}

      <Card
        title="All DDoS Events"
        size="small"
        extra={<Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>}
      >
        <Table
          dataSource={events}
          columns={eventColumns}
          rowKey="id"
          size="small"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1300 }}
        />
      </Card>

      {/* Report Modal */}
      <Modal
        title="DDoS Attack Report"
        open={!!reportModal}
        onCancel={() => setReportModal(null)}
        footer={null}
        width={900}
      >
        {reportModal && (
          <div>
            <Title level={5}>Target Details</Title>
            <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Target IP"><Text code>{reportModal.analysis.targetDetails.ip}</Text></Descriptions.Item>
              <Descriptions.Item label="Port">{reportModal.analysis.targetDetails.port}</Descriptions.Item>
              <Descriptions.Item label="Asset Name">{reportModal.analysis.targetDetails.assetName}</Descriptions.Item>
              <Descriptions.Item label="Router Interface">{reportModal.analysis.targetDetails.routerInterface}</Descriptions.Item>
              <Descriptions.Item label="Customer">{reportModal.analysis.targetDetails.customerName}</Descriptions.Item>
              <Descriptions.Item label="ASN">{reportModal.analysis.targetDetails.asn}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>Attack Profile</Title>
            <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Type"><Tag color="volcano">{reportModal.analysis.attackProfile.type.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Peak Bandwidth"><Text strong>{reportModal.analysis.attackProfile.peakBandwidthGbps.toFixed(2)} Gbps</Text></Descriptions.Item>
              <Descriptions.Item label="Peak PPS">{reportModal.analysis.attackProfile.peakPps.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Total Traffic">{reportModal.analysis.attackProfile.totalGB} GB</Descriptions.Item>
              <Descriptions.Item label="Total Packets">{reportModal.analysis.attackProfile.totalPackets.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Duration">{reportModal.analysis.attackProfile.durationMinutes} min</Descriptions.Item>
              <Descriptions.Item label="Attack Vectors" span={3}>
                {reportModal.analysis.attackProfile.vectors?.map((v, i) => (
                  <Tag color="red" key={i}>{v}</Tag>
                ))}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>Source Analysis</Title>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Total Source IPs">{reportModal.analysis.sourceAnalysis.totalSources}</Descriptions.Item>
              <Descriptions.Item label="Source IPs (sample)">
                <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                  {reportModal.analysis.sourceAnalysis.sourceIps.slice(0, 20).map((ip, i) => (
                    <Tag key={i} style={{ margin: 2 }}><Text code style={{ fontSize: 11 }}>{ip}</Text></Tag>
                  ))}
                  {reportModal.analysis.sourceAnalysis.totalSources > 20 && (
                    <Text type="secondary"> ... and {reportModal.analysis.sourceAnalysis.totalSources - 20} more</Text>
                  )}
                </div>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>Impact</Title>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Severity"><Tag color={SEVERITY_COLORS[reportModal.analysis.impact.severity]}>{reportModal.analysis.impact.severity.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLORS[reportModal.analysis.impact.status]}>{reportModal.analysis.impact.status.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Detected At">{new Date(reportModal.analysis.impact.detectedAt).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Mitigated At">{reportModal.analysis.impact.mitigatedAt ? new Date(reportModal.analysis.impact.mitigatedAt).toLocaleString() : 'Pending'}</Descriptions.Item>
              {reportModal.analysis.impact.timeToMitigate !== null && (
                <Descriptions.Item label="Time to Mitigate" span={2}>
                  {formatDuration(reportModal.analysis.impact.timeToMitigate)}
                </Descriptions.Item>
              )}
            </Descriptions>

            {reportModal.analysis.mitigation && (reportModal.analysis.mitigation.strategy || reportModal.analysis.mitigation.resolvedBy) && (
              <>
                <Title level={5}>Mitigation Details</Title>
                <Descriptions bordered size="small" column={2}>
                  {reportModal.analysis.mitigation.strategy && (
                    <Descriptions.Item label="Strategy"><Tag color="blue">{reportModal.analysis.mitigation.strategy}</Tag></Descriptions.Item>
                  )}
                  {reportModal.analysis.mitigation.initiatedBy && (
                    <Descriptions.Item label="Initiated By">{reportModal.analysis.mitigation.initiatedBy}</Descriptions.Item>
                  )}
                  {reportModal.analysis.mitigation.notes && (
                    <Descriptions.Item label="Mitigation Notes" span={2}>{reportModal.analysis.mitigation.notes}</Descriptions.Item>
                  )}
                  {reportModal.analysis.mitigation.resolvedBy && (
                    <Descriptions.Item label="Resolved By">{reportModal.analysis.mitigation.resolvedBy}</Descriptions.Item>
                  )}
                  {reportModal.analysis.mitigation.resolutionNotes && (
                    <Descriptions.Item label="Resolution Notes" span={2}>{reportModal.analysis.mitigation.resolutionNotes}</Descriptions.Item>
                  )}
                </Descriptions>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Mitigate Modal */}
      <Modal
        title="Initiate DDoS Mitigation"
        open={!!mitigateModal}
        onCancel={() => { setMitigateModal(null); setMitigateNotes(''); }}
        onOk={handleMitigate}
        okText="Start Mitigation"
        confirmLoading={actionLoading}
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text strong>Mitigation Strategy</Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            value={mitigateStrategy}
            onChange={setMitigateStrategy}
            options={MITIGATION_STRATEGIES.map((s) => ({ label: s, value: s }))}
          />
        </div>
        <div>
          <Text strong>Notes (optional)</Text>
          <TextArea
            rows={3}
            value={mitigateNotes}
            onChange={(e) => setMitigateNotes(e.target.value)}
            placeholder="Additional mitigation notes..."
            style={{ marginTop: 4 }}
          />
        </div>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        title="Resolve DDoS Event"
        open={!!resolveModal}
        onCancel={() => { setResolveModal(null); setResolveNotes(''); }}
        onOk={handleResolve}
        okText="Resolve"
        confirmLoading={actionLoading}
      >
        <Text strong>Resolution Notes (optional)</Text>
        <TextArea
          rows={4}
          value={resolveNotes}
          onChange={(e) => setResolveNotes(e.target.value)}
          placeholder="Describe resolution steps taken..."
          style={{ marginTop: 4 }}
        />
      </Modal>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
