import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Row,
  Col,
  Card,
  Select,
  Radio,
  Spin,
  Alert,
  Tag,
  Table,
  Typography,
  Space,
  Statistic,
  Checkbox,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { assetsAPI, metricsAPI } from '../services/api';
import type { Asset, Metric } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;

// ---------------------------------------------------------------------------
// Metric configuration
// ---------------------------------------------------------------------------

type MetricKey = 'cpu' | 'memory' | 'network' | 'uptime' | 'traffic_in' | 'traffic_out';

interface MetricConfig {
  key: MetricKey;
  apiName: string;
  label: string;
  unit: string;
  color: string;
}

const METRIC_CONFIGS: MetricConfig[] = [
  { key: 'cpu', apiName: 'cpu_usage', label: 'CPU Usage', unit: '%', color: '#1890ff' },
  { key: 'memory', apiName: 'memory_usage', label: 'Memory Usage', unit: '%', color: '#52c41a' },
  { key: 'network', apiName: 'network_latency', label: 'Network Latency', unit: 'ms', color: '#faad14' },
  { key: 'uptime', apiName: 'uptime', label: 'Uptime', unit: '%', color: '#722ed1' },
  { key: 'traffic_in', apiName: 'traffic_in', label: 'Traffic In', unit: 'Mbps', color: '#13c2c2' },
  { key: 'traffic_out', apiName: 'traffic_out', label: 'Traffic Out', unit: 'Mbps', color: '#eb2f96' },
];

const METRIC_MAP = Object.fromEntries(METRIC_CONFIGS.map((c) => [c.key, c])) as Record<MetricKey, MetricConfig>;

// ---------------------------------------------------------------------------
// Time ranges
// ---------------------------------------------------------------------------

interface TimeRange {
  label: string;
  value: string;
  hours: number;
}

const TIME_RANGES: TimeRange[] = [
  { label: '1h', value: '1h', hours: 1 },
  { label: '6h', value: '6h', hours: 6 },
  { label: '12h', value: '12h', hours: 12 },
  { label: '24h', value: '24h', hours: 24 },
  { label: '7d', value: '7d', hours: 168 },
];

// ---------------------------------------------------------------------------
// Dark-theme Recharts helpers
// ---------------------------------------------------------------------------

const DARK_GRID_STROKE = 'rgba(255,255,255,0.1)';
const DARK_AXIS_TICK = { fill: '#8ba3c1' };
const DARK_TOOLTIP_STYLE = {
  backgroundColor: '#0f2035',
  border: '1px solid #1e3a5f',
  color: '#e0e8f0',
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function computeFromISO(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function getMetricStats(list: Metric[]) {
  if (list.length === 0) return { avg: 0, min: 0, max: 0, current: 0 };
  const values = list.map((m) => m.value);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return {
    avg: Math.round(avg * 10) / 10,
    min: Math.round(Math.min(...values) * 10) / 10,
    max: Math.round(Math.max(...values) * 10) / 10,
    current: Math.round(values[values.length - 1] * 10) / 10,
  };
}

function formatChartData(list: Metric[]) {
  return [...list]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((m) => ({
      timestamp: new Date(m.timestamp).toLocaleTimeString(),
      value: m.value,
      fullTime: new Date(m.timestamp).toLocaleString(),
    }));
}

function statusColor(status: string) {
  switch (status) {
    case 'online':
      return 'green';
    case 'offline':
      return 'red';
    case 'degraded':
      return 'orange';
    case 'maintenance':
      return 'blue';
    default:
      return 'default';
  }
}

function valueStatusTag(value: number) {
  if (value > 90) return <Tag color="red">High</Tag>;
  if (value > 70) return <Tag color="orange">Elevated</Tag>;
  return <Tag color="green">Normal</Tag>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Metrics() {
  // --- state ---------------------------------------------------------------
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [metricsData, setMetricsData] = useState<Record<MetricKey, Metric[]>>({
    cpu: [],
    memory: [],
    network: [],
    uptime: [],
    traffic_in: [],
    traffic_out: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('cpu');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [comparisonMetrics, setComparisonMetrics] = useState<MetricKey[]>(['cpu', 'memory']);

  // --- derived -------------------------------------------------------------
  const selectedAssetObj = useMemo(() => assets.find((a) => a.id === selectedAsset), [assets, selectedAsset]);
  const currentMetrics = metricsData[selectedMetric];
  const chartData = useMemo(() => formatChartData(currentMetrics), [currentMetrics]);
  const stats = useMemo(() => getMetricStats(currentMetrics), [currentMetrics]);
  const cfg = METRIC_MAP[selectedMetric];
  const selectedTimeRange = TIME_RANGES.find((t) => t.value === timeRange) ?? TIME_RANGES[3];

  // --- data fetching -------------------------------------------------------
  const loadAssets = useCallback(async () => {
    try {
      const response = await assetsAPI.getAll();
      const assetList = response.data || [];
      setAssets(assetList);
      if (assetList.length > 0) {
        setSelectedAsset(assetList[0].id);
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMetrics = useCallback(
    async (assetId: string) => {
      try {
        setLoading(true);
        const from = computeFromISO(selectedTimeRange.hours);

        const results = await Promise.all(
          METRIC_CONFIGS.map((c) =>
            metricsAPI.query({ assetId, metricName: c.apiName, from }).catch(() => [] as Metric[]),
          ),
        );

        const next: Record<MetricKey, Metric[]> = {
          cpu: [],
          memory: [],
          network: [],
          uptime: [],
          traffic_in: [],
          traffic_out: [],
        };
        METRIC_CONFIGS.forEach((c, i) => {
          next[c.key] = results[i] || [];
        });

        setMetricsData(next);
      } catch (error) {
        console.error('Failed to load metrics:', error);
      } finally {
        setLoading(false);
      }
    },
    [selectedTimeRange.hours],
  );

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (selectedAsset) {
      loadMetrics(selectedAsset);
    }
  }, [selectedAsset, loadMetrics]);

  // --- multi-metric comparison data ----------------------------------------
  const comparisonChartData = useMemo(() => {
    if (comparisonMetrics.length === 0) return [];

    // Gather all timestamps across selected metrics
    const allTimestamps = new Map<number, Record<string, number | string>>();

    comparisonMetrics.forEach((mk) => {
      const sorted = [...metricsData[mk]].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      sorted.forEach((m) => {
        const ts = new Date(m.timestamp).getTime();
        const existing = allTimestamps.get(ts) || {
          timestamp: new Date(m.timestamp).toLocaleTimeString(),
          fullTime: new Date(m.timestamp).toLocaleString(),
        };
        existing[mk] = m.value;
        allTimestamps.set(ts, existing);
      });
    });

    return Array.from(allTimestamps.entries())
      .sort(([a], [b]) => a - b)
      .map(([, row]) => row);
  }, [metricsData, comparisonMetrics]);

  // Determine if we need dual Y-axes (when units differ)
  const comparisonUnits = useMemo(() => {
    const units = [...new Set(comparisonMetrics.map((mk) => METRIC_MAP[mk].unit))];
    return units;
  }, [comparisonMetrics]);

  // --- table columns -------------------------------------------------------
  const tableColumns: ColumnsType<Metric> = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (val: number) => (
        <Text strong>
          {val}
          {cfg.unit}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'value',
      key: 'status',
      render: (val: number) => valueStatusTag(val),
    },
  ];

  // --- initial loading spinner ---------------------------------------------
  if (loading && assets.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" tip="Loading metrics..." />
      </div>
    );
  }

  // --- render --------------------------------------------------------------
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* ---- Asset Selector + Time Range ---- */}
      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={14}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Select Asset
            </Text>
            <Select
              value={selectedAsset || undefined}
              onChange={(value) => setSelectedAsset(value)}
              style={{ width: '100%' }}
              placeholder="Choose an asset"
              showSearch
              optionFilterProp="label"
              options={assets.map((a) => ({
                value: a.id,
                label: `${a.name} (${a.type}) - ${a.location || 'Unknown'}`,
              }))}
            />
            {selectedAssetObj && (
              <Space style={{ marginTop: 8 }} wrap>
                <Text type="secondary">IP: {selectedAssetObj.ipAddress || 'N/A'}</Text>
                <Text type="secondary">|</Text>
                <Text type="secondary">Type: {selectedAssetObj.type}</Text>
                <Text type="secondary">|</Text>
                <Text type="secondary">Location: {selectedAssetObj.location || 'N/A'}</Text>
                <Text type="secondary">|</Text>
                <Text type="secondary">Status:</Text>
                <Tag color={statusColor(selectedAssetObj.status)}>{selectedAssetObj.status}</Tag>
              </Space>
            )}
          </Col>
          <Col xs={24} md={10}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Time Range
            </Text>
            <Radio.Group value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
              {TIME_RANGES.map((tr) => (
                <Radio.Button key={tr.value} value={tr.value}>
                  {tr.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Col>
        </Row>
      </Card>

      {/* ---- Metric Type Selector ---- */}
      <Card>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Metric Type
        </Text>
        <Radio.Group
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value)}
          optionType="button"
          buttonStyle="solid"
        >
          {METRIC_CONFIGS.map((mc) => (
            <Radio.Button key={mc.key} value={mc.key}>
              {mc.label}
            </Radio.Button>
          ))}
        </Radio.Group>
      </Card>

      {/* ---- Stats Cards ---- */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Current"
              value={stats.current}
              suffix={cfg.unit}
              valueStyle={{ color: cfg.color }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Average"
              value={stats.avg}
              suffix={cfg.unit}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Minimum"
              value={stats.min}
              suffix={cfg.unit}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Maximum"
              value={stats.max}
              suffix={cfg.unit}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ---- Single Metric Chart ---- */}
      <Card>
        <Title level={4} style={{ marginBottom: 16 }}>
          {cfg.label} &mdash; Last {selectedTimeRange.label}
        </Title>

        {chartData.length === 0 ? (
          <Empty description="No metrics data available for this asset" />
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID_STROKE} />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 12, ...DARK_AXIS_TICK }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={DARK_AXIS_TICK}
                label={{
                  value: `${cfg.label} (${cfg.unit})`,
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#8ba3c1' },
                }}
              />
              <Tooltip
                contentStyle={DARK_TOOLTIP_STYLE}
                formatter={(value: number) => [`${value}${cfg.unit}`, cfg.label]}
                labelFormatter={(label) => {
                  const item = chartData.find((d) => d.timestamp === label);
                  return item ? item.fullTime : label;
                }}
              />
              <Legend wrapperStyle={{ color: '#8ba3c1' }} />
              <Line
                type="monotone"
                dataKey="value"
                name={cfg.label}
                stroke={cfg.color}
                strokeWidth={2}
                dot={{ fill: cfg.color, r: 3 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Anomaly Alerts */}
        {stats.max > 90 && selectedMetric === 'cpu' && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 16 }}
            message="Anomaly Detected"
            description={`CPU usage spiked to ${stats.max}% — significantly above normal range. AI analysis suggests potential performance issue.`}
          />
        )}
        {stats.max > 90 && selectedMetric === 'memory' && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
            message="High Memory Usage"
            description={`Memory usage reached ${stats.max}% — approaching capacity limits.`}
          />
        )}
      </Card>

      {/* ---- Multi-Metric Comparison Chart ---- */}
      <Card>
        <Title level={4} style={{ marginBottom: 16 }}>
          Multi-Metric Comparison
        </Title>

        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Select metrics to compare (2-3 recommended)
        </Text>
        <Checkbox.Group
          value={comparisonMetrics}
          onChange={(checked) => setComparisonMetrics(checked as MetricKey[])}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[8, 8]}>
            {METRIC_CONFIGS.map((mc) => (
              <Col key={mc.key}>
                <Checkbox value={mc.key}>
                  <span style={{ color: mc.color }}>{mc.label}</span>
                </Checkbox>
              </Col>
            ))}
          </Row>
        </Checkbox.Group>

        {comparisonMetrics.length === 0 ? (
          <Empty description="Select at least one metric to compare" />
        ) : comparisonChartData.length === 0 ? (
          <Empty description="No data available for the selected metrics" />
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={comparisonChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={DARK_GRID_STROKE} />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 12, ...DARK_AXIS_TICK }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              {/* Left Y-axis for the first unit group */}
              <YAxis
                yAxisId="left"
                tick={DARK_AXIS_TICK}
                label={{
                  value: comparisonUnits[0] || '',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#8ba3c1' },
                }}
              />
              {/* Right Y-axis when a second unit group exists */}
              {comparisonUnits.length > 1 && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={DARK_AXIS_TICK}
                  label={{
                    value: comparisonUnits[1],
                    angle: 90,
                    position: 'insideRight',
                    style: { fill: '#8ba3c1' },
                  }}
                />
              )}
              <Tooltip
                contentStyle={DARK_TOOLTIP_STYLE}
                formatter={(value: number, name: string) => {
                  const mc = METRIC_CONFIGS.find((c) => c.label === name);
                  return [`${value}${mc?.unit || ''}`, name];
                }}
                labelFormatter={(label) => {
                  const item = comparisonChartData.find((d) => d.timestamp === label);
                  return item ? String(item.fullTime) : String(label);
                }}
              />
              <Legend wrapperStyle={{ color: '#8ba3c1' }} />
              {comparisonMetrics.map((mk) => {
                const mc = METRIC_MAP[mk];
                // Assign to left axis if unit matches first group, else right
                const axisId =
                  comparisonUnits.length > 1 && mc.unit === comparisonUnits[1] ? 'right' : 'left';
                return (
                  <Line
                    key={mk}
                    yAxisId={axisId}
                    type="monotone"
                    dataKey={mk}
                    name={mc.label}
                    stroke={mc.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ---- Data Points Table ---- */}
      <Card>
        <Title level={4} style={{ marginBottom: 16 }}>
          Recent Data Points
        </Title>
        <Table<Metric>
          columns={tableColumns}
          dataSource={[...currentMetrics].reverse().slice(0, 20)}
          rowKey={(record) => record.id ?? `${record.timestamp}-${record.value}`}
          pagination={{ pageSize: 10, size: 'small' }}
          size="small"
        />
      </Card>
    </Space>
  );
}
