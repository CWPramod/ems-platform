// Network Topology Page - Interactive Network Visualization
// apps/web/src/pages/NetworkTopology.tsx

import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Select, Button, Space, Typography, Tag, message, Spin } from 'antd';
import {
  ReloadOutlined,
  ExpandOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  AimOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Node, Edge } from 'reactflow';
import { apiService } from '../services/apiService';

const { Title, Text } = Typography;
const { Option } = Select;

// Custom node colors based on device type
const getNodeStyle = (deviceType: string, status: string) => {
  const baseStyle = {
    padding: '15px',
    borderRadius: '12px',
    border: '2px solid',
    background: '#fff',
    minWidth: '150px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  };

  const typeColors: any = {
    router: { border: '#1890ff', bg: '#e6f7ff' },
    switch: { border: '#52c41a', bg: '#f6ffed' },
    firewall: { border: '#fa8c16', bg: '#fff7e6' },
    server: { border: '#722ed1', bg: '#f9f0ff' },
    load_balancer: { border: '#eb2f96', bg: '#fff0f6' },
    application: { border: '#13c2c2', bg: '#e6fffb' },
  };

  const color = typeColors[deviceType] || { border: '#d9d9d9', bg: '#fafafa' };
  
  // Handle both 'up'/'down' and 'online'/'offline' status values
  const isDown = status === 'down' || status === 'offline';

  return {
    ...baseStyle,
    borderColor: isDown ? '#ff4d4f' : color.border,
    background: isDown ? '#fff1f0' : color.bg,
    opacity: isDown ? 0.6 : 1,
  };
};

// Custom node component
const CustomNode = ({ data }: any) => {
  const getStatusIcon = (status: string) => {
    // Handle both 'up'/'online' and 'down'/'offline' status values
    if (status === 'up' || status === 'online') return '🟢';
    if (status === 'warning') return '🟡';
    return '🔴';
  };

  return (
    <div style={getNodeStyle(data.type, data.status)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>{getStatusIcon(data.status)}</span>
        <Text strong style={{ fontSize: '14px' }}>{data.name}</Text>
      </div>
      <div style={{ fontSize: '12px', color: '#666' }}>
        <div>Type: <Tag size="small">{data.type}</Tag></div>
        <div>IP: <Text code style={{ fontSize: '11px' }}>{data.ip}</Text></div>
        <div>Tier: <Tag color={data.tier === 1 ? 'red' : 'orange'} size="small">T{data.tier}</Tag></div>
      </div>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export default function NetworkTopology() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchTopologyData();
  }, [tierFilter, locationFilter]);

  const fetchTopologyData = async () => {
    setLoading(true);
    try {
      // Fetch topology data
      const filters: any = {};
      if (tierFilter) filters.tier = tierFilter;
      if (locationFilter) filters.location = locationFilter;

      const topologyResponse = await apiService.getNetworkTopology(filters);
      console.log('Topology Response:', topologyResponse);

      if (topologyResponse.success) {
        const { nodes: deviceNodes, links: deviceLinks } = topologyResponse.data;
        
        // Convert to ReactFlow format
        const flowNodes: Node[] = (deviceNodes || []).map((device: any, index: number) => ({
          id: device.id,
          type: 'custom',
          position: calculateNodePosition(index, deviceNodes.length, device.type),
          data: {
            name: device.name,
            type: device.type,
            ip: device.ip,
            status: device.status,
            tier: device.tier,
            location: device.location,
          },
        }));

        const flowEdges: Edge[] = (deviceLinks || []).map((link: any, index: number) => ({
          id: `edge-${index}`,
          source: link.source,
          target: link.target,
          type: 'default',
          animated: link.status === 'up' || link.status === 'active',
          style: { 
            stroke: (link.status === 'up' || link.status === 'active') ? '#52c41a' : '#d9d9d9',
            strokeWidth: 3,
          },
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
        
        console.log('Flow Nodes:', flowNodes.length);
        console.log('Flow Edges:', flowEdges.length);
        console.log('Sample Edge:', flowEdges[0]);
      }

      // Fetch stats - merge stats endpoint with topology summary for complete data
      const statsResponse = await apiService.getTopologyStats();
      const topologySummary = topologyResponse.data?.summary || {};
      if (statsResponse.success) {
        setStats({
          ...statsResponse.data,
          // Map stats fields to common names
          totalDevices: statsResponse.data.devices,
          totalConnections: statsResponse.data.connections,
          // Include device type breakdown from topology summary
          byType: topologySummary.byType || {},
        });
      } else if (topologySummary) {
        setStats(topologySummary);
      }

      message.success('Topology loaded successfully');
    } catch (error: any) {
      console.error('Error fetching topology:', error);
      message.error('Failed to load network topology');
    } finally {
      setLoading(false);
    }
  };

  // Calculate node positions in a circular layout
  const calculateNodePosition = (index: number, total: number, deviceType: string) => {
    const centerX = 500;
    const centerY = 300;
    
    // All devices in one circle with consistent radius
    const radius = 250;
    const angle = (index / total) * 2 * Math.PI;

    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  };

  const handleRefresh = () => {
    fetchTopologyData();
  };

  const handleResetFilters = () => {
    setTierFilter(null);
    setLocationFilter(null);
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Network Topology</Title>
        <Text type="secondary">Interactive visualization of network infrastructure</Text>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
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
      <Card style={{ marginBottom: '16px' }}>
        <Space wrap>
          <Select
            placeholder="Filter by Tier"
            style={{ width: 150 }}
            allowClear
            value={tierFilter}
            onChange={setTierFilter}
          >
            <Option value={1}>Tier 1</Option>
            <Option value={2}>Tier 2</Option>
            <Option value={3}>Tier 3</Option>
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

        <div style={{ marginTop: '12px' }}>
          <Space>
            <Tag color="blue">🔵 Router</Tag>
            <Tag color="green">🟢 Switch</Tag>
            <Tag color="orange">🟠 Firewall</Tag>
            <Tag color="purple">🟣 Server</Tag>
            <Tag color="magenta">🔴 Load Balancer</Tag>
            <Tag color="cyan">🔷 Application</Tag>
          </Space>
        </div>
      </Card>

      {/* Topology Graph */}
      <Card
        title="Network Diagram"
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Drag to move • Scroll to zoom • Click nodes for details
            </Text>
          </Space>
        }
        style={{ height: '700px' }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '600px' }}>
            <Spin size="large" tip="Loading topology..." />
          </div>
        ) : (
          <div style={{ height: '600px' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
              <Controls />
              <MiniMap 
                nodeColor={(node) => {
                  const device = node.data;
                  if (device.status === 'down') return '#ff4d4f';
                  const colors: any = {
                    router: '#1890ff',
                    switch: '#52c41a',
                    firewall: '#fa8c16',
                    server: '#722ed1',
                    load_balancer: '#eb2f96',
                    application: '#13c2c2',
                  };
                  return colors[device.type] || '#d9d9d9';
                }}
                style={{ 
                  background: '#f5f5f5',
                  border: '1px solid #d9d9d9',
                }}
              />
            </ReactFlow>
          </div>
        )}
      </Card>

      {/* Legend */}
      <Card title="Legend" style={{ marginTop: '16px' }}>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Space direction="vertical">
              <Text strong>Status Indicators:</Text>
              <div><span>🟢</span> <Text>Device Up</Text></div>
              <div><span>🟡</span> <Text>Warning</Text></div>
              <div><span>🔴</span> <Text>Device Down</Text></div>
            </Space>
          </Col>
          <Col span={12}>
            <Space direction="vertical">
              <Text strong>Connection Types:</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '30px', height: '2px', background: '#52c41a' }}></div>
                <Text>Active Link</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '30px', height: '2px', background: '#d9d9d9' }}></div>
                <Text>Inactive Link</Text>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
