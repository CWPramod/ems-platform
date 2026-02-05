import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Descriptions,
  Progress,
  Tag,
  Button,
  Statistic,
  Row,
  Col,
  Card,
  Divider,
  Spin,
  Alert,
} from 'antd';
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  DashboardOutlined,
  CloudServerOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';

interface DeviceQuickViewProps {
  visible: boolean;
  deviceId: string | null;
  onClose: () => void;
}

interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  ipAddress: string;
  location: string;
  tier: number;
  status: string;
  vendor: string;
  model: string;
}

interface HealthData {
  healthScore: number;
  cpuUtilization: number;
  memoryUtilization: number;
  bandwidthInMbps: number;
  bandwidthOutMbps: number;
  packetLossPercent: number;
  latencyMs: number;
  activeAlertsCount: number;
  criticalAlertsCount: number;
  warningAlertsCount: number;
  uptimePercent24h: number;
  slaCompliance: number;
  lastHealthCheck: string;
}

const getHealthScoreColor = (score: number): string => {
  if (score >= 90) return '#52c41a';
  if (score >= 70) return '#faad14';
  if (score >= 50) return '#fa8c16';
  return '#ff4d4f';
};

const getUtilizationStatus = (
  value: number,
  warningThreshold = 70,
  criticalThreshold = 90
): 'success' | 'normal' | 'exception' | 'active' => {
  if (value >= criticalThreshold) return 'exception';
  if (value >= warningThreshold) return 'active';
  return 'success';
};

const getStatusTag = (status: string) => {
  const normalized = status?.toLowerCase();
  if (normalized === 'online' || normalized === 'up' || normalized === 'active') {
    return <Tag color="success">{status}</Tag>;
  }
  if (normalized === 'offline' || normalized === 'down') {
    return <Tag color="error">{status}</Tag>;
  }
  if (normalized === 'degraded' || normalized === 'warning') {
    return <Tag color="warning">{status}</Tag>;
  }
  return <Tag color="default">{status}</Tag>;
};

const getDeviceTypeTag = (type: string) => {
  const colorMap: Record<string, string> = {
    router: 'blue',
    switch: 'cyan',
    firewall: 'red',
    server: 'purple',
    access_point: 'green',
    load_balancer: 'orange',
  };
  const color = colorMap[type?.toLowerCase()] || 'default';
  const label = type?.replace(/_/g, ' ') || 'Unknown';
  return (
    <Tag color={color} style={{ textTransform: 'capitalize' }}>
      {label}
    </Tag>
  );
};

const formatTimestamp = (ts: string): string => {
  if (!ts) return 'N/A';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
};

const DeviceQuickView: React.FC<DeviceQuickViewProps> = ({
  visible,
  deviceId,
  onClose,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);

  const fetchData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiService.getDeviceHealth(id);
      if (result?.success && result.data) {
        setDevice(result.data.device || null);
        setHealth(result.data.health || null);
      } else {
        setError('Failed to load device data.');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'An error occurred while loading device data.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && deviceId) {
      fetchData(deviceId);
    }
    if (!visible) {
      setDevice(null);
      setHealth(null);
      setError(null);
    }
  }, [visible, deviceId, fetchData]);

  const handleViewFullDetails = () => {
    onClose();
    navigate(`/device/${deviceId}`);
  };

  const drawerTitle = device ? (
    <span>
      <CloudServerOutlined style={{ marginRight: 8 }} />
      {device.name}
    </span>
  ) : (
    'Device Quick View'
  );

  return (
    <Drawer
      title={drawerTitle}
      placement="right"
      width={520}
      open={visible}
      onClose={onClose}
      extra={
        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          onClick={handleViewFullDetails}
          disabled={!deviceId}
        >
          View Full Details
        </Button>
      }
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" tip="Loading device data..." />
        </div>
      )}

      {error && !loading && (
        <Alert
          type="error"
          message="Error"
          description={error}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {!loading && !error && device && health && (
        <>
          {/* Device Information */}
          <Descriptions
            title="Device Information"
            column={2}
            size="small"
            bordered
          >
            <Descriptions.Item label="Name" span={2}>
              {device.name}
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              {getDeviceTypeTag(device.type)}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {getStatusTag(device.status)}
            </Descriptions.Item>
            <Descriptions.Item label="IP Address">
              <span style={{ fontFamily: 'monospace' }}>{device.ipAddress}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Tier">
              <Tag color="geekblue">Tier {device.tier}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Location" span={2}>
              {device.location || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Vendor">
              {device.vendor || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Model">
              {device.model || 'N/A'}
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          {/* Health Score Gauge */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <DashboardOutlined
              style={{ fontSize: 16, marginRight: 6, verticalAlign: 'middle' }}
            />
            <span style={{ fontWeight: 600, fontSize: 16 }}>Health Score</span>
            <div style={{ marginTop: 12 }}>
              <Progress
                type="circle"
                percent={Math.round(health.healthScore)}
                size={140}
                strokeColor={getHealthScoreColor(health.healthScore)}
                format={(percent) => (
                  <span style={{ fontSize: 28, fontWeight: 700 }}>
                    {percent}
                  </span>
                )}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
              Last check: {formatTimestamp(health.lastHealthCheck)}
            </div>
          </div>

          <Divider />

          {/* CPU & Memory Utilization */}
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card size="small" title="CPU Utilization">
                <Progress
                  percent={Math.round(health.cpuUtilization)}
                  status={getUtilizationStatus(health.cpuUtilization)}
                  strokeWidth={12}
                  format={(percent) => `${percent}%`}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="Memory Utilization">
                <Progress
                  percent={Math.round(health.memoryUtilization)}
                  status={getUtilizationStatus(health.memoryUtilization, 75, 90)}
                  strokeWidth={12}
                  format={(percent) => `${percent}%`}
                />
              </Card>
            </Col>
          </Row>

          <Divider />

          {/* Network Telemetry */}
          <Card
            size="small"
            title={
              <span>
                <ApiOutlined style={{ marginRight: 6 }} />
                Network Telemetry
              </span>
            }
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Bandwidth In"
                  value={health.bandwidthInMbps}
                  precision={2}
                  suffix="Mbps"
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Bandwidth Out"
                  value={health.bandwidthOutMbps}
                  precision={2}
                  suffix="Mbps"
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Packet Loss"
                  value={health.packetLossPercent}
                  precision={2}
                  suffix="%"
                  valueStyle={{
                    fontSize: 18,
                    color:
                      health.packetLossPercent > 5
                        ? '#ff4d4f'
                        : health.packetLossPercent > 1
                          ? '#faad14'
                          : '#52c41a',
                  }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Latency"
                  value={health.latencyMs}
                  precision={1}
                  suffix="ms"
                  valueStyle={{
                    fontSize: 18,
                    color:
                      health.latencyMs > 100
                        ? '#ff4d4f'
                        : health.latencyMs > 50
                          ? '#faad14'
                          : '#52c41a',
                  }}
                />
              </Col>
            </Row>
          </Card>

          {/* Alert Counts */}
          <Card size="small" title="Alerts" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Statistic
                  title="Active"
                  value={health.activeAlertsCount}
                  prefix={<WarningOutlined />}
                  valueStyle={{
                    fontSize: 22,
                    color:
                      health.activeAlertsCount > 0 ? '#faad14' : undefined,
                  }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Critical"
                  value={health.criticalAlertsCount}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{
                    fontSize: 22,
                    color:
                      health.criticalAlertsCount > 0 ? '#ff4d4f' : undefined,
                  }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Warning"
                  value={health.warningAlertsCount}
                  prefix={<WarningOutlined />}
                  valueStyle={{
                    fontSize: 22,
                    color:
                      health.warningAlertsCount > 0 ? '#fa8c16' : undefined,
                  }}
                />
              </Col>
            </Row>
          </Card>

          {/* SLA Compliance */}
          <Card size="small" title="SLA Compliance" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Compliance"
                  value={health.slaCompliance}
                  precision={1}
                  suffix="%"
                  prefix={
                    health.slaCompliance >= 99.5 ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : health.slaCompliance >= 95 ? (
                      <WarningOutlined style={{ color: '#faad14' }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                    )
                  }
                  valueStyle={{
                    fontSize: 22,
                    color:
                      health.slaCompliance >= 99.5
                        ? '#52c41a'
                        : health.slaCompliance >= 95
                          ? '#faad14'
                          : '#ff4d4f',
                  }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="24h Uptime"
                  value={health.uptimePercent24h}
                  precision={2}
                  suffix="%"
                  valueStyle={{
                    fontSize: 22,
                    color:
                      health.uptimePercent24h >= 99.9
                        ? '#52c41a'
                        : health.uptimePercent24h >= 99
                          ? '#faad14'
                          : '#ff4d4f',
                  }}
                />
              </Col>
            </Row>
          </Card>

          {/* Footer Action */}
          <Divider />
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={handleViewFullDetails}
            >
              View Full Details
            </Button>
          </div>
        </>
      )}
    </Drawer>
  );
};

export default DeviceQuickView;
