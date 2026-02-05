// Network Topology Page - Interactive Network Visualization
// apps/web/src/pages/NetworkTopology.tsx

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  Spin,
  Progress,
  message,
  Segmented,
  Tooltip,
} from 'antd';
import {
  ReloadOutlined,
  ExpandOutlined,
  CompressOutlined,
  AimOutlined,
  CloudServerOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  DesktopOutlined,
  ApiOutlined,
  AppstoreOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Node, Edge, NodeProps } from 'reactflow';
import dagre from 'dagre';
import { useNavigate } from 'react-router-dom';
import DeviceQuickView from '../components/DeviceQuickView';
import { apiService } from '../services/apiService';

const { Title, Text } = Typography;
const { Option } = Select;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LayoutMode = 'hierarchical' | 'left-right' | 'circular';

interface DeviceNodeData {
  id: string;
  name: string;
  type: string;
  ip: string;
  status: string;
  tier: number;
  location: string;
  bandwidth?: number; // percentage 0-100
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_BORDER_COLORS: Record<string, string> = {
  router: '#1890ff',
  switch: '#52c41a',
  firewall: '#fa8c16',
  server: '#722ed1',
  load_balancer: '#eb2f96',
  application: '#13c2c2',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  router: <CloudServerOutlined />,
  switch: <ApartmentOutlined />,
  firewall: <SafetyCertificateOutlined />,
  server: <DesktopOutlined />,
  load_balancer: <ApiOutlined />,
  application: <AppstoreOutlined />,
};

const TIER_LABEL: Record<number, string> = {
  1: 'Core',
  2: 'Distribution',
  3: 'Access',
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;

// ---------------------------------------------------------------------------
// Helpers: status
// ---------------------------------------------------------------------------

const isUp = (status: string) =>
  status === 'up' || status === 'online' || status === 'active';

const isDown = (status: string) =>
  status === 'down' || status === 'offline';

const isWarning = (status: string) => status === 'warning' || status === 'degraded';

// ---------------------------------------------------------------------------
// Helpers: tier mapping for dagre rank
// ---------------------------------------------------------------------------

const deviceTier = (type: string): number => {
  if (type === 'router' || type === 'core_switch') return 1;
  if (type === 'firewall' || type === 'load_balancer') return 2;
  return 3; // switch, server, application, others
};

// ---------------------------------------------------------------------------
// Dagre layout helper
// ---------------------------------------------------------------------------

function applyDagreLayout(
  nodes: Node<DeviceNodeData>[],
  edges: Edge[],
  direction: 'TB' | 'LR',
): Node<DeviceNodeData>[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranksep: 120,
    nodesep: 80,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Circular layout helper
// ---------------------------------------------------------------------------

function applyCircularLayout(nodes: Node<DeviceNodeData>[]): Node<DeviceNodeData>[] {
  const centerX = 500;
  const centerY = 400;
  const radius = Math.max(250, nodes.length * 20);

  return nodes.map((node, index) => {
    const angle = (index / nodes.length) * 2 * Math.PI;
    return {
      ...node,
      position: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Location group bounding box helper
// ---------------------------------------------------------------------------

interface LocationGroup {
  location: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function computeLocationGroups(nodes: Node<DeviceNodeData>[]): LocationGroup[] {
  const byLocation: Record<string, Node<DeviceNodeData>[]> = {};
  nodes.forEach((n) => {
    const loc = n.data?.location || 'Unknown';
    if (!byLocation[loc]) byLocation[loc] = [];
    byLocation[loc].push(n);
  });

  const groups: LocationGroup[] = [];
  const padding = 30;

  Object.entries(byLocation).forEach(([location, locNodes]) => {
    if (locNodes.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    locNodes.forEach((n) => {
      const x = n.position.x;
      const y = n.position.y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + NODE_WIDTH > maxX) maxX = x + NODE_WIDTH;
      if (y + NODE_HEIGHT > maxY) maxY = y + NODE_HEIGHT;
    });
    groups.push({
      location,
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding,
    });
  });

  return groups;
}

// ---------------------------------------------------------------------------
// Location color map
// ---------------------------------------------------------------------------

const LOCATION_COLORS: Record<string, string> = {
  'Data Center 1': '#1890ff',
  'Data Center 2': '#52c41a',
  'Cloud - US-East': '#fa8c16',
  'Cloud - US-West': '#eb2f96',
  Unknown: '#4a5568',
};

function locationColor(location: string): string {
  return LOCATION_COLORS[location] || '#4a5568';
}

// ---------------------------------------------------------------------------
// CustomNode component
// ---------------------------------------------------------------------------

function EnhancedNode({ data }: NodeProps<DeviceNodeData>) {
  const borderColor = isDown(data.status)
    ? '#ff4d4f'
    : TYPE_BORDER_COLORS[data.type] || '#4a5568';

  const glowStyle = isDown(data.status)
    ? { boxShadow: '0 0 12px 3px rgba(255, 77, 79, 0.5)' }
    : {};

  const statusDotColor = isUp(data.status)
    ? '#52c41a'
    : isWarning(data.status)
      ? '#fadb14'
      : '#ff4d4f';

  const tierTag = TIER_LABEL[data.tier] || `T${data.tier}`;
  const icon = TYPE_ICONS[data.type] || <CloudServerOutlined />;
  const bandwidth = typeof data.bandwidth === 'number' ? data.bandwidth : 0;

  return (
    <div
      style={{
        background: '#0f2035',
        border: `2px solid ${borderColor}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 180,
        color: '#e6e6e6',
        fontFamily: 'inherit',
        ...glowStyle,
      }}
    >
      {/* Header row: icon + name + status dot */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 18, color: borderColor }}>{icon}</span>
        <span
          style={{
            flex: 1,
            fontWeight: 600,
            fontSize: 13,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {data.name}
        </span>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: statusDotColor,
            flexShrink: 0,
            boxShadow: `0 0 6px ${statusDotColor}`,
          }}
        />
      </div>

      {/* IP + Tier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#8899aa',
          }}
        >
          {data.ip || '--'}
        </Text>
        <Tag
          color={data.tier === 1 ? 'red' : data.tier === 2 ? 'orange' : 'blue'}
          style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }}
        >
          {tierTag}
        </Tag>
      </div>

      {/* Bandwidth mini-bar */}
      <Progress
        percent={bandwidth}
        size="small"
        strokeColor={bandwidth > 80 ? '#ff4d4f' : bandwidth > 50 ? '#faad14' : '#52c41a'}
        trailColor="#1a3352"
        format={(pct) => (
          <span style={{ color: '#8899aa', fontSize: 10 }}>{pct}%</span>
        )}
        style={{ marginBottom: 0 }}
      />
    </div>
  );
}

const nodeTypes = {
  custom: EnhancedNode,
};

// ---------------------------------------------------------------------------
// Edge helpers
// ---------------------------------------------------------------------------

function buildEdge(link: any, index: number): Edge {
  const active = link.status === 'up' || link.status === 'active';
  const down = link.status === 'down' || link.status === 'offline';
  const strokeColor = active ? '#52c41a' : down ? '#ff4d4f' : '#4a5568';

  // thickness based on source tier if available
  const tierWidth = link.sourceTier === 1 ? 5 : link.sourceTier === 2 ? 4 : link.tier === 1 ? 5 : 3;

  return {
    id: `edge-${index}`,
    source: link.source,
    target: link.target,
    type: 'default',
    animated: active,
    style: {
      stroke: strokeColor,
      strokeWidth: tierWidth,
    },
  };
}

// ---------------------------------------------------------------------------
// LocationOverlay - dashed boundary boxes rendered via a Panel
// ---------------------------------------------------------------------------

function LocationOverlay({ groups }: { groups: LocationGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <>
      {groups.map((g) => {
        const color = locationColor(g.location);
        return (
          <div
            key={g.location}
            style={{
              position: 'absolute',
              left: g.x,
              top: g.y,
              width: g.width,
              height: g.height,
              border: `2px dashed ${color}55`,
              borderRadius: 12,
              background: `${color}08`,
              pointerEvents: 'none',
              zIndex: -1,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: -10,
                left: 12,
                background: '#0a1628',
                padding: '0 8px',
                fontSize: 11,
                color: `${color}cc`,
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            >
              {g.location}
            </span>
          </div>
        );
      })}
    </>
  );
}

// ===========================================================================
// Main Component
// ===========================================================================

export default function NetworkTopology() {
  const navigate = useNavigate();

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState<DeviceNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('hierarchical');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // DeviceQuickView state
  const [quickViewDeviceId, setQuickViewDeviceId] = useState<string | null>(null);
  const [quickViewVisible, setQuickViewVisible] = useState(false);

  // Location groups for overlay
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);

  // Raw topology data kept between layout switches
  const rawDataRef = useRef<{ deviceNodes: any[]; deviceLinks: any[] }>({
    deviceNodes: [],
    deviceLinks: [],
  });

  // -------------------------------------------------------------------
  // Layout application
  // -------------------------------------------------------------------

  const applyLayout = useCallback(
    (
      deviceNodes: any[],
      deviceLinks: any[],
      mode: LayoutMode,
    ) => {
      // Build ReactFlow nodes
      const flowNodes: Node<DeviceNodeData>[] = (deviceNodes || []).map((device: any) => ({
        id: device.id,
        type: 'custom',
        position: { x: 0, y: 0 }, // will be set by layout
        data: {
          id: device.id,
          name: device.name,
          type: device.type,
          ip: device.ip,
          status: device.status,
          tier: device.tier ?? deviceTier(device.type),
          location: device.location || 'Unknown',
          bandwidth: typeof device.bandwidth === 'number'
            ? device.bandwidth
            : Math.round(Math.random() * 80 + 10), // simulate if not provided
        },
      }));

      // Build ReactFlow edges
      const flowEdges: Edge[] = (deviceLinks || []).map((link: any, index: number) =>
        buildEdge(link, index),
      );

      // Apply chosen layout
      let laid: Node<DeviceNodeData>[];
      if (mode === 'circular') {
        laid = applyCircularLayout(flowNodes);
      } else {
        const direction = mode === 'left-right' ? 'LR' : 'TB';
        laid = applyDagreLayout(flowNodes, flowEdges, direction);
      }

      setNodes(laid);
      setEdges(flowEdges);
      setLocationGroups(computeLocationGroups(laid));
    },
    [setNodes, setEdges],
  );

  // -------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------

  const fetchTopologyData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (tierFilter) filters.tier = tierFilter;
      if (locationFilter) filters.location = locationFilter;

      const topologyResponse = await apiService.getNetworkTopology(filters);

      if (topologyResponse.success) {
        const { nodes: deviceNodes, links: deviceLinks } = topologyResponse.data;
        rawDataRef.current = { deviceNodes: deviceNodes || [], deviceLinks: deviceLinks || [] };
        applyLayout(deviceNodes || [], deviceLinks || [], layoutMode);
      }

      // Fetch stats
      const statsResponse = await apiService.getTopologyStats();
      const topologySummary = topologyResponse.data?.summary || {};
      if (statsResponse.success) {
        setStats({
          ...statsResponse.data,
          totalDevices: statsResponse.data.devices,
          totalConnections: statsResponse.data.connections,
          byType: topologySummary.byType || {},
        });
      } else if (topologySummary) {
        setStats(topologySummary);
      }
    } catch (error: any) {
      message.error('Failed to load network topology');
    } finally {
      setLoading(false);
    }
  }, [tierFilter, locationFilter, layoutMode, applyLayout]);

  useEffect(() => {
    fetchTopologyData();
  }, [fetchTopologyData]);

  // Re-layout when mode changes (without re-fetching)
  const handleLayoutChange = useCallback(
    (mode: LayoutMode) => {
      setLayoutMode(mode);
      const { deviceNodes, deviceLinks } = rawDataRef.current;
      if (deviceNodes.length) {
        applyLayout(deviceNodes, deviceLinks, mode);
      }
    },
    [applyLayout],
  );

  // -------------------------------------------------------------------
  // Interactivity handlers
  // -------------------------------------------------------------------

  const handleNodeClick = useCallback((_: any, node: Node<DeviceNodeData>) => {
    setQuickViewDeviceId(node.data.id ?? node.id);
    setQuickViewVisible(true);
  }, []);

  const handleNodeDoubleClick = useCallback(
    (_: any, node: Node<DeviceNodeData>) => {
      navigate(`/device/${node.data.id ?? node.id}`);
    },
    [navigate],
  );

  const handleRefresh = () => {
    fetchTopologyData();
  };

  const handleResetFilters = () => {
    setTierFilter(null);
    setLocationFilter(null);
  };

  // -------------------------------------------------------------------
  // Fullscreen
  // -------------------------------------------------------------------

  const toggleFullscreen = useCallback(() => {
    if (!graphContainerRef.current) return;
    if (!document.fullscreenElement) {
      graphContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // -------------------------------------------------------------------
  // Minimap node color
  // -------------------------------------------------------------------

  const minimapNodeColor = useCallback((node: Node) => {
    const d = node.data as DeviceNodeData | undefined;
    if (!d) return '#4a5568';
    if (isDown(d.status)) return '#ff4d4f';
    return TYPE_BORDER_COLORS[d.type] || '#4a5568';
  }, []);

  // -------------------------------------------------------------------
  // Layout options for segmented control
  // -------------------------------------------------------------------

  const layoutOptions = useMemo(
    () => [
      { label: 'Hierarchical', value: 'hierarchical' as LayoutMode },
      { label: 'Left-Right', value: 'left-right' as LayoutMode },
      { label: 'Circular', value: 'circular' as LayoutMode },
    ],
    [],
  );

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 4 }}>
          Network Topology
        </Title>
        <Text type="secondary">Interactive visualization of network infrastructure</Text>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Devices"
                value={stats.totalDevices || 0}
                prefix={<CloudServerOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Active Connections"
                value={stats.totalConnections || 0}
                prefix={<NodeIndexOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Routers"
                value={stats.devicesByType?.router || stats.byType?.router || 0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Switches"
                value={stats.devicesByType?.switch || stats.byType?.switch || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters and Controls */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Filter by Tier"
            style={{ width: 150 }}
            allowClear
            value={tierFilter}
            onChange={setTierFilter}
          >
            <Option value={1}>Tier 1 - Core</Option>
            <Option value={2}>Tier 2 - Distribution</Option>
            <Option value={3}>Tier 3 - Access</Option>
          </Select>

          <Select
            placeholder="Filter by Location"
            style={{ width: 200 }}
            allowClear
            value={locationFilter}
            onChange={setLocationFilter}
          >
            <Option value="Data Center 1">Data Center 1</Option>
            <Option value="Data Center 2">Data Center 2</Option>
            <Option value="Cloud - US-East">Cloud - US-East</Option>
          </Select>

          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            Refresh
          </Button>

          <Button icon={<AimOutlined />} onClick={handleResetFilters}>
            Reset Filters
          </Button>
        </Space>

        {/* Layout switcher + legend row */}
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Space wrap>
            <Tag color="blue" style={{ borderColor: '#1890ff' }}>
              <CloudServerOutlined /> Router
            </Tag>
            <Tag color="green" style={{ borderColor: '#52c41a' }}>
              <ApartmentOutlined /> Switch
            </Tag>
            <Tag color="orange" style={{ borderColor: '#fa8c16' }}>
              <SafetyCertificateOutlined /> Firewall
            </Tag>
            <Tag color="purple" style={{ borderColor: '#722ed1' }}>
              <DesktopOutlined /> Server
            </Tag>
            <Tag color="magenta" style={{ borderColor: '#eb2f96' }}>
              <ApiOutlined /> Load Balancer
            </Tag>
            <Tag color="cyan" style={{ borderColor: '#13c2c2' }}>
              <AppstoreOutlined /> Application
            </Tag>
          </Space>

          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Layout:
            </Text>
            <Segmented
              options={layoutOptions}
              value={layoutMode}
              onChange={(val) => handleLayoutChange(val as LayoutMode)}
              size="small"
            />
          </Space>
        </div>
      </Card>

      {/* Topology Graph */}
      <div ref={graphContainerRef} style={{ position: 'relative' }}>
        <Card
          title="Network Diagram"
          extra={
            <Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Click node for details | Double-click to navigate
              </Text>
              <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                <Button
                  icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
                  size="small"
                  onClick={toggleFullscreen}
                />
              </Tooltip>
            </Space>
          }
          style={{ height: isFullscreen ? '100vh' : 700 }}
          styles={{
            body: {
              height: isFullscreen ? 'calc(100vh - 57px)' : 600,
              padding: 0,
            },
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <Spin size="large" tip="Loading topology..." />
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                attributionPosition="bottom-left"
                proOptions={{ hideAttribution: true }}
                style={{ background: '#0a1628' }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1}
                  color="#1a3352"
                />
                <Controls
                  style={{
                    background: '#0f2035',
                    border: '1px solid #1e3a5f',
                    borderRadius: 8,
                  }}
                />
                <MiniMap
                  nodeColor={minimapNodeColor}
                  maskColor="rgba(10, 22, 40, 0.85)"
                  style={{
                    background: '#0a1628',
                    border: '1px solid #1e3a5f',
                    borderRadius: 8,
                  }}
                />
                {/* Location group boundaries rendered in the flow viewport */}
                <Panel position="top-left" style={{ margin: 0, padding: 0, pointerEvents: 'none' }}>
                  <LocationOverlay groups={locationGroups} />
                </Panel>
              </ReactFlow>
            </div>
          )}
        </Card>
      </div>

      {/* Legend */}
      <Card title="Legend" style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={4}>
              <Text strong>Status Indicators</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#52c41a',
                    display: 'inline-block',
                  }}
                />
                <Text>Device Up / Online</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#fadb14',
                    display: 'inline-block',
                  }}
                />
                <Text>Warning / Degraded</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#ff4d4f',
                    display: 'inline-block',
                    boxShadow: '0 0 6px #ff4d4f',
                  }}
                />
                <Text>Device Down / Offline (glow)</Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={4}>
              <Text strong>Connection Types</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 3, background: '#52c41a', borderRadius: 2 }} />
                <Text>Active Link</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 3, background: '#ff4d4f', borderRadius: 2 }} />
                <Text>Down Link</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 2, background: '#4a5568', borderRadius: 2 }} />
                <Text>Inactive Link</Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={4}>
              <Text strong>Tier Hierarchy</Text>
              <div>
                <Tag color="red">Core</Tag> Routers, Core Switches
              </div>
              <div>
                <Tag color="orange">Distribution</Tag> Firewalls, Load Balancers
              </div>
              <div>
                <Tag color="blue">Access</Tag> Switches, Servers, Apps
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Device Quick View Drawer */}
      <DeviceQuickView
        visible={quickViewVisible}
        deviceId={quickViewDeviceId}
        onClose={() => {
          setQuickViewVisible(false);
          setQuickViewDeviceId(null);
        }}
      />
    </div>
  );
}
