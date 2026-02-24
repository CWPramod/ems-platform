// ITSM SLA Dashboard
// apps/web/src/pages/itsm/SlaDashboard.tsx

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Tooltip,
  Badge,
  message,
  Tabs,
  Form,
  Input,
  InputNumber,
  Select,
  Modal,
  Switch,
} from 'antd';
import {
  DashboardOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  FireOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { itsmSlaAPI } from '../../services/api';
import type {
  ITSMSlaDashboard,
  ITSMSlaPolicy,
  ITSMTicket,
  ITSMBreachRateBySeverity,
  ITSMComplianceTrend,
} from '../../types';

const { Title, Text } = Typography;

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Format a duration expressed in minutes into a human-readable string.
 * Examples: 75 → "1h 15m", 45 → "45m", 0 → "0m"
 */
function formatMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return '—';
  const totalMins = Math.round(mins);
  if (totalMins >= 60) {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${totalMins}m`;
}

/**
 * Calculate time remaining until a due date and return a formatted string.
 * Returns a React-renderable element (string or JSX).
 * If the date has passed, returns the string "OVERDUE".
 */
function formatTimeRemaining(dueDate: string | undefined | null): {
  text: string;
  overdue: boolean;
} {
  if (!dueDate) return { text: '—', overdue: false };
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const diffMs = due - now;

  if (diffMs <= 0) {
    const overdueMins = Math.round(Math.abs(diffMs) / 60000);
    return { text: `OVERDUE (${formatMinutes(overdueMins)} ago)`, overdue: true };
  }

  const diffMins = Math.round(diffMs / 60000);
  return { text: formatMinutes(diffMins), overdue: false };
}

/**
 * Format an ISO date string to a short, readable format.
 */
function formatDate(isoDate: string | undefined | null): string {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Severity / Priority color helpers
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#f5222d',
  high: '#fa541c',
  medium: '#faad14',
  low: '#1890ff',
};


function getSeverityTagColor(severity: string): string {
  return SEVERITY_COLORS[severity] ?? '#8c8c8c';
}

function getPriorityTagColor(priority: string): string {
  const map: Record<string, string> = {
    P1: 'red',
    P2: 'orange',
    P3: 'blue',
    P4: 'default',
  };
  return map[priority] ?? 'default';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SlaDashboard: React.FC = () => {
  const [dashboardStats, setDashboardStats] = useState<ITSMSlaDashboard | null>(null);
  const [breachedTickets, setBreachedTickets] = useState<ITSMTicket[]>([]);
  const [atRiskTickets, setAtRiskTickets] = useState<ITSMTicket[]>([]);
  const [breachRate, setBreachRate] = useState<ITSMBreachRateBySeverity[]>([]);
  const [complianceTrend, setComplianceTrend] = useState<ITSMComplianceTrend[]>([]);
  const [loading, setLoading] = useState(false);

  // Policy management state
  const [policies, setPolicies] = useState<ITSMSlaPolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const [policySubmitLoading, setPolicySubmitLoading] = useState(false);
  const [policyForm] = Form.useForm();

  const loadPolicies = useCallback(async () => {
    try {
      setPoliciesLoading(true);
      const data = await itsmSlaAPI.getPolicies();
      setPolicies(Array.isArray(data) ? data : []);
    } catch {
      message.error('Failed to load SLA policies');
    } finally {
      setPoliciesLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboard, breaches, atRisk, breachRateData, trendData] = await Promise.all([
        itsmSlaAPI.getDashboard(),
        itsmSlaAPI.getBreaches(),
        itsmSlaAPI.getAtRisk(),
        itsmSlaAPI.getBreachRate(),
        itsmSlaAPI.getComplianceTrend(30),
      ]);
      setDashboardStats(dashboard);
      setBreachedTickets(Array.isArray(breaches) ? breaches : []);
      setAtRiskTickets(Array.isArray(atRisk) ? atRisk : []);
      setBreachRate(Array.isArray(breachRateData) ? breachRateData : []);
      setComplianceTrend(Array.isArray(trendData) ? trendData : []);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load SLA data';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Derived values for KPI card color coding
  // ---------------------------------------------------------------------------

  const complianceColor =
    dashboardStats == null
      ? undefined
      : dashboardStats.compliancePercent >= 95
      ? '#52c41a'
      : dashboardStats.compliancePercent >= 80
      ? '#faad14'
      : '#f5222d';

  const breachValueColor =
    dashboardStats && dashboardStats.breachedTickets > 0 ? '#f5222d' : '#52c41a';

  // ---------------------------------------------------------------------------
  // At-Risk Tickets columns
  // ---------------------------------------------------------------------------

  const atRiskColumns: ColumnsType<ITSMTicket> = [
    {
      title: 'Ticket #',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      width: 160,
      render: (val: string) => (
        <Text code style={{ fontSize: 12 }}>
          {val}
        </Text>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (val: string) => (
        <Tag color={getSeverityTagColor(val)} style={{ textTransform: 'capitalize' }}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (val: string) => <Tag color={getPriorityTagColor(val)}>{val}</Tag>,
    },
    {
      title: 'SLA Due',
      dataIndex: 'slaDueAt',
      key: 'slaDueAt',
      width: 180,
      render: (val: string) => (
        <Tooltip title={val}>
          <Text type="warning">{formatDate(val)}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Time Remaining',
      dataIndex: 'slaDueAt',
      key: 'timeRemaining',
      width: 160,
      render: (val: string) => {
        const { text, overdue } = formatTimeRemaining(val);
        return overdue ? (
          <Text strong style={{ color: '#f5222d' }}>
            {text}
          </Text>
        ) : (
          <Text strong style={{ color: '#faad14' }}>
            {text}
          </Text>
        );
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // Active Breaches columns
  // ---------------------------------------------------------------------------

  const breachColumns: ColumnsType<ITSMTicket> = [
    {
      title: 'Ticket #',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      width: 160,
      render: (val: string) => (
        <Text code style={{ fontSize: 12 }}>
          {val}
        </Text>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (val: string) => (
        <Tag color={getSeverityTagColor(val)} style={{ textTransform: 'capitalize' }}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (val: string) => <Tag color={getPriorityTagColor(val)}>{val}</Tag>,
    },
    {
      title: 'SLA Due',
      dataIndex: 'slaDueAt',
      key: 'slaDueAt',
      width: 180,
      render: (val: string) => (
        <Tooltip title={val}>
          <Text type="danger">{formatDate(val)}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (val: string) => {
        const statusColors: Record<string, string> = {
          open: 'red',
          acknowledged: 'orange',
          in_progress: 'blue',
          pending: 'purple',
          resolved: 'green',
          closed: 'default',
        };
        return (
          <Tag color={statusColors[val] ?? 'default'} style={{ textTransform: 'capitalize' }}>
            {val.replace('_', ' ')}
          </Tag>
        );
      },
    },
    {
      title: 'Breached Since',
      dataIndex: 'slaDueAt',
      key: 'breachedSince',
      width: 180,
      render: (val: string) => {
        if (!val) return <Text type="danger">—</Text>;
        const diffMs = Date.now() - new Date(val).getTime();
        if (diffMs <= 0) return <Text type="danger">Just breached</Text>;
        const diffMins = Math.round(diffMs / 60000);
        return (
          <Text strong type="danger">
            {formatMinutes(diffMins)} ago
          </Text>
        );
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // Breach Rate BarChart data
  // ---------------------------------------------------------------------------

  const breachRateChartData = breachRate.map((row) => ({
    severity: row.severity.charAt(0).toUpperCase() + row.severity.slice(1),
    breachRate: Number((row.breachRate ?? 0).toFixed(1)),
    breached: row.breached,
    total: row.total,
    fill: SEVERITY_COLORS[row.severity] ?? '#8c8c8c',
  }));

  // ---------------------------------------------------------------------------
  // Compliance Trend AreaChart data
  // ---------------------------------------------------------------------------

  const complianceTrendChartData = complianceTrend.map((row) => ({
    date: new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    compliance: Number(row.compliancePercent.toFixed(1)),
    breached: row.breached,
    total: row.total,
  }));

  // ---------------------------------------------------------------------------
  // Policy table columns
  // ---------------------------------------------------------------------------

  const policyColumns: ColumnsType<ITSMSlaPolicy> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 110,
      render: (val: string) => (
        <Tag color={SEVERITY_COLORS[val] ?? '#8c8c8c'} style={{ textTransform: 'capitalize' }}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Response',
      dataIndex: 'responseTimeMinutes',
      key: 'responseTime',
      width: 100,
      render: (val: number) => formatMinutes(val),
    },
    {
      title: 'Resolution',
      dataIndex: 'resolutionTimeMinutes',
      key: 'resolutionTime',
      width: 100,
      render: (val: number) => formatMinutes(val),
    },
    {
      title: 'Escalation L1',
      dataIndex: 'escalationLevel1Minutes',
      key: 'l1',
      width: 110,
      render: (val: number) => formatMinutes(val),
    },
    {
      title: 'Escalation L2',
      dataIndex: 'escalationLevel2Minutes',
      key: 'l2',
      width: 110,
      render: (val: number) => formatMinutes(val),
    },
    {
      title: 'Default',
      dataIndex: 'isDefault',
      key: 'isDefault',
      width: 80,
      render: (val: boolean) => val ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>,
    },
  ];

  const handleCreatePolicy = async () => {
    try {
      const values = await policyForm.validateFields();
      setPolicySubmitLoading(true);
      await itsmSlaAPI.createPolicy({
        name: values.name,
        severity: values.severity,
        responseTimeMinutes: values.responseTimeMinutes,
        resolutionTimeMinutes: values.resolutionTimeMinutes,
        escalationLevel1Minutes: values.escalationLevel1Minutes,
        escalationLevel2Minutes: values.escalationLevel2Minutes,
        isDefault: values.isDefault ?? false,
      });
      message.success('SLA policy created');
      setPolicyModalVisible(false);
      policyForm.resetFields();
      await loadPolicies();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Failed to create SLA policy');
    } finally {
      setPolicySubmitLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Space align="center">
          <DashboardOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={3} style={{ margin: 0 }}>
            SLA Dashboard
          </Title>
        </Space>
        <Button
          icon={<SyncOutlined spin={loading} />}
          onClick={loadData}
          loading={loading}
          type="default"
        >
          Refresh
        </Button>
      </div>

      {/* Top-level Tabs: Dashboard | Policies */}
      <Tabs
        defaultActiveKey="dashboard"
        type="card"
        onChange={(key) => {
          if (key === 'policies') loadPolicies();
        }}
        items={[
          {
            key: 'dashboard',
            label: <span><DashboardOutlined /> Dashboard</span>,
            children: (
              <>
                {/* KPI Cards Row */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false} style={{ borderRadius: 8, height: '100%' }}
                      styles={{ body: { padding: '20px 24px' } }}>
                      <Statistic
                        title={
                          <Space>
                            <ClockCircleOutlined style={{ color: '#1890ff' }} />
                            <span>MTTR</span>
                            <Tooltip title="Mean Time To Resolution">
                              <ExclamationCircleOutlined style={{ color: '#8c8c8c', fontSize: 12, cursor: 'help' }} />
                            </Tooltip>
                          </Space>
                        }
                        value={formatMinutes(dashboardStats?.mttrMinutes)}
                        valueStyle={{ fontSize: 22, color: '#1890ff' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false} style={{ borderRadius: 8, height: '100%' }}
                      styles={{ body: { padding: '20px 24px' } }}>
                      <Statistic
                        title={
                          <Space>
                            <ClockCircleOutlined style={{ color: '#722ed1' }} />
                            <span>MTTA</span>
                            <Tooltip title="Mean Time To Acknowledge">
                              <ExclamationCircleOutlined style={{ color: '#8c8c8c', fontSize: 12, cursor: 'help' }} />
                            </Tooltip>
                          </Space>
                        }
                        value={formatMinutes(dashboardStats?.mttaMinutes)}
                        valueStyle={{ fontSize: 22, color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false} style={{ borderRadius: 8, height: '100%' }}
                      styles={{ body: { padding: '20px 24px' } }}>
                      <Statistic
                        title={
                          <Space>
                            <CheckCircleOutlined style={{ color: complianceColor ?? '#52c41a' }} />
                            <span>SLA Compliance</span>
                          </Space>
                        }
                        value={dashboardStats != null ? `${dashboardStats.compliancePercent.toFixed(1)}%` : '—'}
                        valueStyle={{ fontSize: 22, color: complianceColor ?? '#8c8c8c' }}
                        suffix={
                          dashboardStats != null && dashboardStats.compliancePercent >= 95 ? (
                            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                          ) : dashboardStats != null && dashboardStats.compliancePercent < 80 ? (
                            <WarningOutlined style={{ color: '#f5222d', fontSize: 16 }} />
                          ) : null
                        }
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false}
                      style={{
                        borderRadius: 8, height: '100%',
                        borderLeft: dashboardStats && dashboardStats.breachedTickets > 0
                          ? '3px solid #f5222d' : '3px solid #52c41a',
                      }}
                      styles={{ body: { padding: '20px 24px' } }}>
                      <Statistic
                        title={
                          <Space>
                            <FireOutlined style={{ color: dashboardStats && dashboardStats.breachedTickets > 0 ? '#f5222d' : '#52c41a' }} />
                            <span>Total Breaches</span>
                          </Space>
                        }
                        value={dashboardStats?.breachedTickets ?? '—'}
                        valueStyle={{ fontSize: 22, color: breachValueColor }}
                        suffix={
                          dashboardStats && dashboardStats.breachedTickets > 0 ? (
                            <Badge count={dashboardStats.breachedTickets} overflowCount={999} style={{ backgroundColor: '#f5222d' }} />
                          ) : null
                        }
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false} style={{ borderRadius: 8, height: '100%' }}
                      styles={{ body: { padding: '20px 24px' } }}>
                      <Statistic
                        title={<Space><DashboardOutlined style={{ color: '#8c8c8c' }} /><span>Total Tickets</span></Space>}
                        value={dashboardStats?.totalTickets ?? '—'}
                        valueStyle={{ fontSize: 22 }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Charts Row: Breach Rate BarChart + Compliance Trend AreaChart */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} lg={12}>
                    <Card
                      title={<Space><WarningOutlined style={{ color: '#fa541c' }} /><span>Breach Rate by Severity</span></Space>}
                      bordered={false} style={{ borderRadius: 8, height: '100%' }} loading={loading}
                    >
                      {breachRateChartData.length === 0 ? (
                        <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '24px 0' }}>No data available</Text>
                      ) : (
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={breachRateChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                              stroke="#8ba3c1" fontSize={12} />
                            <YAxis type="category" dataKey="severity" width={80}
                              stroke="#8ba3c1" fontSize={12} />
                            <RechartsTooltip
                              contentStyle={{ background: '#1a2332', border: '1px solid #2a3a4e', borderRadius: 6 }}
                              labelStyle={{ color: '#e0e0e0' }}
                              formatter={(value: number, _name: string, props: { payload: { breached: number; total: number } }) => [
                                `${value}% (${props.payload.breached}/${props.payload.total})`, 'Breach Rate',
                              ]}
                            />
                            <Bar dataKey="breachRate" radius={[0, 4, 4, 0]} barSize={28}>
                              {breachRateChartData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card
                      title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} /><span>Compliance Trend (Last 30 Days)</span></Space>}
                      bordered={false} style={{ borderRadius: 8, height: '100%' }} loading={loading}
                    >
                      {complianceTrendChartData.length === 0 ? (
                        <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '24px 0' }}>No trend data available</Text>
                      ) : (
                        <ResponsiveContainer width="100%" height={260}>
                          <AreaChart data={complianceTrendChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                            <defs>
                              <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#52c41a" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#52c41a" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="date" stroke="#8ba3c1" fontSize={11} />
                            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                              stroke="#8ba3c1" fontSize={12} />
                            <RechartsTooltip
                              contentStyle={{ background: '#1a2332', border: '1px solid #2a3a4e', borderRadius: 6 }}
                              labelStyle={{ color: '#e0e0e0' }}
                              formatter={(value: number) => [`${value}%`, 'Compliance']}
                            />
                            <Area type="monotone" dataKey="compliance" stroke="#52c41a" strokeWidth={2}
                              fill="url(#colorCompliance)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </Card>
                  </Col>
                </Row>

                {/* At-Risk and Active Breaches */}
                <Tabs
                  defaultActiveKey="at-risk"
                  type="card"
                  style={{ background: 'transparent' }}
                  items={[
                    {
                      key: 'at-risk',
                      label: (
                        <Space>
                          <WarningOutlined style={{ color: '#faad14' }} />
                          <span>At-Risk Tickets
                            {atRiskTickets.length > 0 && (
                              <Badge count={atRiskTickets.length} overflowCount={99} style={{ marginLeft: 8, backgroundColor: '#faad14' }} />
                            )}
                          </span>
                        </Space>
                      ),
                      children: (
                        <Card bordered={false} style={{ borderRadius: '0 8px 8px 8px' }}
                          title={<Space><ClockCircleOutlined style={{ color: '#faad14' }} /><Text strong>At-Risk Tickets (SLA approaching)</Text></Space>}
                          loading={loading}>
                          <Table<ITSMTicket>
                            dataSource={atRiskTickets} columns={atRiskColumns} rowKey="id" size="middle"
                            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `${t} tickets` }}
                            locale={{ emptyText: 'No at-risk tickets — all SLAs are healthy.' }}
                            scroll={{ x: 900 }}
                            rowClassName={(row) => { const { overdue } = formatTimeRemaining(row.slaDueAt); return overdue ? 'ant-table-row-danger' : ''; }}
                          />
                        </Card>
                      ),
                    },
                    {
                      key: 'breaches',
                      label: (
                        <Space>
                          <FireOutlined style={{ color: '#f5222d' }} />
                          <span>Active Breaches
                            {breachedTickets.length > 0 && (
                              <Badge count={breachedTickets.length} overflowCount={99} style={{ marginLeft: 8, backgroundColor: '#f5222d' }} />
                            )}
                          </span>
                        </Space>
                      ),
                      children: (
                        <Card bordered={false}
                          style={{ borderRadius: '0 8px 8px 8px', borderTop: '3px solid #f5222d' }}
                          title={<Space><FireOutlined style={{ color: '#f5222d' }} /><Text strong style={{ color: '#f5222d' }}>Active Breaches</Text></Space>}
                          loading={loading}>
                          <Table<ITSMTicket>
                            dataSource={breachedTickets} columns={breachColumns} rowKey="id" size="middle"
                            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `${t} breaches` }}
                            locale={{ emptyText: 'No active SLA breaches.' }}
                            scroll={{ x: 1000 }}
                            rowClassName={() => 'ant-table-row-breach'}
                          />
                        </Card>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'policies',
            label: <span><SettingOutlined /> Policies</span>,
            children: (
              <Card bordered={false} style={{ borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>SLA Policies</Title>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { policyForm.resetFields(); setPolicyModalVisible(true); }}>
                    Create Policy
                  </Button>
                </div>
                <Table<ITSMSlaPolicy>
                  dataSource={policies}
                  columns={policyColumns}
                  rowKey="id"
                  loading={policiesLoading}
                  size="middle"
                  pagination={false}
                  locale={{ emptyText: 'No SLA policies configured.' }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Create Policy Modal */}
      <Modal
        title="Create SLA Policy"
        open={policyModalVisible}
        onOk={handleCreatePolicy}
        onCancel={() => { setPolicyModalVisible(false); policyForm.resetFields(); }}
        confirmLoading={policySubmitLoading}
        okText="Create"
        width={600}
        destroyOnClose
      >
        <Form form={policyForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Policy Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Critical Default" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="severity" label="Severity" rules={[{ required: true, message: 'Severity is required' }]}>
                <Select placeholder="Select severity">
                  <Select.Option value="critical">Critical</Select.Option>
                  <Select.Option value="high">High</Select.Option>
                  <Select.Option value="medium">Medium</Select.Option>
                  <Select.Option value="low">Low</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isDefault" label="Default Policy" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="responseTimeMinutes" label="Response Time (minutes)" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 15" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="resolutionTimeMinutes" label="Resolution Time (minutes)" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 60" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="escalationLevel1Minutes" label="Escalation L1 (minutes)" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 30" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="escalationLevel2Minutes" label="Escalation L2 (minutes)" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 45" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <style>{`
        .ant-table-row-danger td {
          background-color: rgba(255, 77, 79, 0.06) !important;
        }
        .ant-table-row-breach td {
          background-color: rgba(245, 34, 45, 0.06) !important;
        }
      `}</style>
    </div>
  );
};

export default SlaDashboard;
