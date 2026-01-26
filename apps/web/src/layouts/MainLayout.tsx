// Professional Enterprise MainLayout with Authentication
// apps/web/src/layouts/MainLayout.tsx

import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Badge,
  Space,
  Button,
  Typography,
  Breadcrumb,
  Modal,
} from 'antd';
import {
  DashboardOutlined,
  CloudServerOutlined,
  AlertOutlined,
  AreaChartOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  CloudOutlined,
  LinkOutlined,
  RobotOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { APP_MODE, FEATURES } from '../config/appMode';
import { useAuth } from '../contexts/AuthContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { confirm } = Modal;

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Handle logout
  const handleLogout = () => {
    confirm({
      title: 'Confirm Logout',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to logout?',
      okText: 'Yes, Logout',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        logout();
        navigate('/login');
      },
    });
  };

  // User dropdown menu
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate('/settings'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: handleLogout,
    },
  ];

  // Sidebar menu items
  const menuItems: MenuProps['items'] = [
    // EMS Overview (Dashboard)
    FEATURES[APP_MODE].showEMSOverview && {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },

    // NMS Menus (always visible)
    {
      key: '/network',
      icon: <CloudServerOutlined />,
      label: 'Network',
    },
    {
      key: '/alerts',
      icon: <AlertOutlined />,
      label: 'Alerts',
    },
    {
      key: '/metrics',
      icon: <AreaChartOutlined />,
      label: 'Metrics',
    },

    // EMS-only Menus
    FEATURES[APP_MODE].showITSM && {
      key: '/assets',
      icon: <AppstoreOutlined />,
      label: 'Assets',
    },
    FEATURES[APP_MODE].showAPM && {
      key: '/apm',
      icon: <ThunderboltOutlined />,
      label: 'APM',
    },
    FEATURES[APP_MODE].showCloud && {
      key: '/cloud',
      icon: <CloudOutlined />,
      label: 'Cloud',
    },
    FEATURES[APP_MODE].showEMSOverview && {
      key: '/correlations',
      icon: <LinkOutlined />,
      label: 'Correlations',
    },

    // ML Dashboard
    FEATURES[APP_MODE].showEMSOverview && {
      key: '/ml',
      icon: <RobotOutlined />,
      label: 'ML Dashboard',
    },
  ].filter(Boolean);

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
  };

  // Breadcrumb logic
  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    if (paths.length === 0) return [{ title: 'Home' }];

    return paths.map((path) => ({
      title: path.charAt(0).toUpperCase() + path.slice(1),
    }));
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {!collapsed ? (
            <Text
              strong
              style={{
                color: '#fff',
                fontSize: '18px',
                letterSpacing: '1px',
              }}
            >
              🔷 CANARIS
            </Text>
          ) : (
            <Text style={{ color: '#fff', fontSize: '24px' }}>🔷</Text>
          )}
        </div>

        {/* Menu */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>

      {/* Main Layout */}
      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'all 0.2s' }}>
        {/* Header */}
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)',
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '16px' }}
            />
            <Text strong style={{ fontSize: '16px', marginLeft: '16px' }}>
              {APP_MODE === 'nms' ? 'Network Management System' : 'Enterprise Management System'}
            </Text>
          </Space>

          <Space size="large">
            {/* Notifications */}
            <Badge count={5} offset={[-5, 5]}>
              <Button type="text" icon={<BellOutlined style={{ fontSize: '18px' }} />} />
            </Badge>

            {/* User Dropdown */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  style={{ backgroundColor: '#1890ff' }}
                  icon={<UserOutlined />}
                />
                <Text>{user?.username || 'Admin User'}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Breadcrumb */}
        <div
          style={{
            padding: '12px 24px',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Breadcrumb items={getBreadcrumbs()} />
        </div>

        {/* Content */}
        <Content
          style={{
            margin: '24px',
            padding: '24px',
            background: '#f0f2f5',
            minHeight: 'calc(100vh - 168px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
