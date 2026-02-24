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
} from 'antd';
import {
  DashboardOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  FireOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { itsmSlaAPI } from '../../services/api';
import type {
  ITSMSlaDashboard,
  ITSMTicket,
  ITSMBreachRateBySeverity,
  ITSMComplianceTrend,
} from '../../types';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

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

const SEVERITY_BAR_BG: Record<string, string> = {
  critical: '#fff1f0',
  high: '#fff2e8',
  medium: '#fffbe6',
  low: '#e6f4ff',
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
  // Breach Rate by Severity rows
  // ---------------------------------------------------------------------------

  const renderBreachRateRows = () => {
    if (breachRate.length === 0) {
      return (
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '24px 0' }}>
          No data available
        </Text>
      );
    }

    return breachRate.map((row) => {
      const pct = row.breachRate ?? 0;
      const barColor = SEVERITY_COLORS[row.severity] ?? '#8c8c8c';
      const bgColor = SEVERITY_BAR_BG[row.severity] ?? '#fafafa';

      return (
        <div
          key={row.severity}
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: bgColor,
            borderRadius: 6,
            border: `1px solid ${barColor}22`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <Space>
              <Tag
                color={barColor}
                style={{ textTransform: 'capitalize', fontWeight: 600, minWidth: 70 }}
              >
                {row.severity}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {row.breached} / {row.total} breached
              </Text>
            </Space>
            <Text strong style={{ color: pct >= 20 ? '#f5222d' : pct >= 10 ? '#faad14' : '#52c41a' }}>
              {pct.toFixed(1)}%
            </Text>
          </div>
          {/* Progress bar */}
          <div
            style={{
              height: 8,
              background: '#e8e8e8',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(pct, 100)}%`,
                background: barColor,
                borderRadius: 4,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>
      );
    });
  };

  // ---------------------------------------------------------------------------
  // Compliance Trend table columns
  // ---------------------------------------------------------------------------

  const trendColumns: ColumnsType<ITSMComplianceTrend> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (val: string) => (
        <Text style={{ fontSize: 13 }}>
          {new Date(val).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      width: 80,
      render: (val: number) => <Text strong>{val}</Text>,
    },
    {
      title: 'Breached',
      dataIndex: 'breached',
      key: 'breached',
      align: 'right',
      width: 90,
      render: (val: number) => (
        <Text strong style={{ color: val > 0 ? '#f5222d' : '#52c41a' }}>
          {val}
        </Text>
      ),
    },
    {
      title: 'Compliance %',
      dataIndex: 'compliancePercent',
      key: 'compliancePercent',
      align: 'right',
      width: 120,
      render: (val: number) => {
        const color = val >= 95 ? '#52c41a' : val >= 80 ? '#faad14' : '#f5222d';
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <div
              style={{
                width: 40,
                height: 6,
                background: '#e8e8e8',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(val, 100)}%`,
                  background: color,
                  borderRadius: 3,
                }}
              />
            </div>
            <Text strong style={{ color, minWidth: 50, textAlign: 'right' }}>
              {val.toFixed(1)}%
            </Text>
          </div>
        );
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
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

      {/* ------------------------------------------------------------------ */}
      {/* KPI Cards Row                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* MTTR */}
        <Col xs={24} sm={12} lg={4}>
          <Card
            bordered={false}
            style={{ borderRadius: 8, height: '100%' }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <Statistic
              title={
                <Space>
                  <ClockCircleOutlined style={{ color: '#1890ff' }} />
                  <span>MTTR</span>
                  <Tooltip title="Mean Time To Resolution — average time from ticket creation to resolution">
                    <ExclamationCircleOutlined
                      style={{ color: '#8c8c8c', fontSize: 12, cursor: 'help' }}
                    />
                  </Tooltip>
                </Space>
              }
              value={formatMinutes(dashboardStats?.mttrMinutes)}
              valueStyle={{ fontSize: 22, color: '#1890ff' }}
            />
          </Card>
        </Col>

        {/* MTTA */}
        <Col xs={24} sm={12} lg={4}>
          <Card
            bordered={false}
            style={{ borderRadius: 8, height: '100%' }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <Statistic
              title={
                <Space>
                  <ClockCircleOutlined style={{ color: '#722ed1' }} />
                  <span>MTTA</span>
                  <Tooltip title="Mean Time To Acknowledge — average time from ticket creation to first acknowledgment">
                    <ExclamationCircleOutlined
                      style={{ color: '#8c8c8c', fontSize: 12, cursor: 'help' }}
                    />
                  </Tooltip>
                </Space>
              }
              value={formatMinutes(dashboardStats?.mttaMinutes)}
              valueStyle={{ fontSize: 22, color: '#722ed1' }}
            />
          </Card>
        </Col>

        {/* SLA Compliance % */}
        <Col xs={24} sm={12} lg={4}>
          <Card
            bordered={false}
            style={{ borderRadius: 8, height: '100%' }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <Statistic
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: complianceColor ?? '#52c41a' }} />
                  <span>SLA Compliance</span>
                </Space>
              }
              value={
                dashboardStats != null
                  ? `${dashboardStats.compliancePercent.toFixed(1)}%`
                  : '—'
              }
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

        {/* Total Breaches */}
        <Col xs={24} sm={12} lg={4}>
          <Card
            bordered={false}
            style={{
              borderRadius: 8,
              height: '100%',
              borderLeft:
                dashboardStats && dashboardStats.breachedTickets > 0
                  ? '3px solid #f5222d'
                  : '3px solid #52c41a',
            }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <Statistic
              title={
                <Space>
                  <FireOutlined
                    style={{
                      color:
                        dashboardStats && dashboardStats.breachedTickets > 0
                          ? '#f5222d'
                          : '#52c41a',
                    }}
                  />
                  <span>Total Breaches</span>
                </Space>
              }
              value={dashboardStats?.breachedTickets ?? '—'}
              valueStyle={{ fontSize: 22, color: breachValueColor }}
              suffix={
                dashboardStats && dashboardStats.breachedTickets > 0 ? (
                  <Badge
                    count={dashboardStats.breachedTickets}
                    overflowCount={999}
                    style={{ backgroundColor: '#f5222d' }}
                  />
                ) : null
              }
            />
          </Card>
        </Col>

        {/* Total Tickets */}
        <Col xs={24} sm={12} lg={4}>
          <Card
            bordered={false}
            style={{ borderRadius: 8, height: '100%' }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <Statistic
              title={
                <Space>
                  <DashboardOutlined style={{ color: '#8c8c8c' }} />
                  <span>Total Tickets</span>
                </Space>
              }
              value={dashboardStats?.totalTickets ?? '—'}
              valueStyle={{ fontSize: 22, color: '#262626' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ------------------------------------------------------------------ */}
      {/* Breach Rate + Compliance Trend Row                                  */}
      {/* ------------------------------------------------------------------ */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Left: Breach Rate by Severity */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#fa541c' }} />
                <span>Breach Rate by Severity</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 8, height: '100%' }}
            loading={loading}
          >
            {renderBreachRateRows()}
          </Card>
        </Col>

        {/* Right: Compliance Trend */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>Compliance Trend (Last 30 Days)</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 8, height: '100%' }}
            loading={loading}
          >
            <Table<ITSMComplianceTrend>
              dataSource={complianceTrend}
              columns={trendColumns}
              rowKey="date"
              size="small"
              pagination={{ pageSize: 7, showSizeChanger: false, size: 'small' }}
              scroll={{ y: 280 }}
              locale={{ emptyText: 'No trend data available' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ------------------------------------------------------------------ */}
      {/* At-Risk and Active Breaches — tabbed for space efficiency           */}
      {/* ------------------------------------------------------------------ */}
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
                <span>
                  At-Risk Tickets
                  {atRiskTickets.length > 0 && (
                    <Badge
                      count={atRiskTickets.length}
                      overflowCount={99}
                      style={{ marginLeft: 8, backgroundColor: '#faad14' }}
                    />
                  )}
                </span>
              </Space>
            ),
            children: (
              <Card
                bordered={false}
                style={{ borderRadius: '0 8px 8px 8px' }}
                title={
                  <Space>
                    <ClockCircleOutlined style={{ color: '#faad14' }} />
                    <Text strong>At-Risk Tickets (SLA approaching)</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Tickets nearing their SLA deadline
                    </Text>
                  </Space>
                }
                loading={loading}
              >
                <Table<ITSMTicket>
                  dataSource={atRiskTickets}
                  columns={atRiskColumns}
                  rowKey="id"
                  size="middle"
                  pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `${t} tickets` }}
                  locale={{ emptyText: 'No at-risk tickets — all SLAs are healthy.' }}
                  scroll={{ x: 900 }}
                  rowClassName={(row) => {
                    const { overdue } = formatTimeRemaining(row.slaDueAt);
                    return overdue ? 'ant-table-row-danger' : '';
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'breaches',
            label: (
              <Space>
                <FireOutlined style={{ color: '#f5222d' }} />
                <span>
                  Active Breaches
                  {breachedTickets.length > 0 && (
                    <Badge
                      count={breachedTickets.length}
                      overflowCount={99}
                      style={{ marginLeft: 8, backgroundColor: '#f5222d' }}
                    />
                  )}
                </span>
              </Space>
            ),
            children: (
              <Card
                bordered={false}
                style={{
                  borderRadius: '0 8px 8px 8px',
                  borderTop: '3px solid #f5222d',
                }}
                title={
                  <Space>
                    <FireOutlined style={{ color: '#f5222d' }} />
                    <Text strong style={{ color: '#f5222d' }}>
                      Active Breaches
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Tickets that have exceeded their SLA resolution time
                    </Text>
                  </Space>
                }
                loading={loading}
              >
                <Table<ITSMTicket>
                  dataSource={breachedTickets}
                  columns={breachColumns}
                  rowKey="id"
                  size="middle"
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

      {/* Inline style overrides for row highlighting */}
      <style>{`
        .ant-table-row-danger td {
          background-color: #fff2e8 !important;
        }
        .ant-table-row-breach td {
          background-color: #fff1f0 !important;
        }
      `}</style>
    </div>
  );
};

export default SlaDashboard;
