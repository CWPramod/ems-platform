// Professional Enterprise MainLayout — Dark Blue Theme
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
  ApartmentOutlined,
  BarChartOutlined,
  FileTextOutlined,
  SecurityScanOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  ToolOutlined,
  BugOutlined,
  SwapOutlined,
  BookOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { APP_MODE, FEATURES } from '../config/appMode';
import { useAuth } from '../contexts/AuthContext';
import LicenseWarningBanner from '../components/LicenseWarningBanner';
import CanarisLogo from '../components/CanarisLogo';

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
  const menuItems = ([
    // EMS Overview (Dashboard)
    FEATURES[APP_MODE].showEMSOverview && {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },

    // Masters
    {
      key: '/masters',
      icon: <DatabaseOutlined />,
      label: 'Masters',
    },

    // NMS Menus (always visible)
    {
      key: '/network',
      icon: <CloudServerOutlined />,
      label: 'Network',
    },
    {
      key: '/topology',
      icon: <ApartmentOutlined />,
      label: 'Topology',
    },
    {
      key: '/top-talkers',
      icon: <BarChartOutlined />,
      label: 'Top Talkers',
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: 'Reports',
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
    {
      key: '/security',
      icon: <SecurityScanOutlined />,
      label: 'Security',
    },
    {
      key: '/license',
      icon: <SafetyCertificateOutlined />,
      label: 'License',
    },

    // ITSM Module
    FEATURES[APP_MODE].showITSM && {
      key: 'itsm',
      icon: <ToolOutlined />,
      label: 'ITSM',
      children: [
        { key: '/itsm/tickets', icon: <AlertOutlined />, label: 'Tickets' },
        { key: '/itsm/sla', icon: <DashboardOutlined />, label: 'SLA Dashboard' },
        { key: '/itsm/problems', icon: <BugOutlined />, label: 'Problems' },
        { key: '/itsm/changes', icon: <SwapOutlined />, label: 'Changes' },
        { key: '/itsm/kb', icon: <BookOutlined />, label: 'Knowledge Base' },
        { key: '/assets', icon: <AppstoreOutlined />, label: 'Assets' },
      ],
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
  ]).filter(Boolean) as MenuProps['items'];

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
            borderBottom: '1px solid #1e3a5f',
            padding: '0 12px',
          }}
        >
          <CanarisLogo size="md" collapsed={collapsed} />
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1e3a5f',
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
              style={{ fontSize: '16px', color: '#8ba3c1' }}
            />
            <Text strong style={{ fontSize: '16px', marginLeft: '16px' }}>
              {APP_MODE === 'nms' ? 'Network Management System' : 'Enterprise Management System'}
            </Text>
          </Space>

          <Space size="large">
            {/* Notifications */}
            <Badge count={5} offset={[-5, 5]}>
              <Button type="text" icon={<BellOutlined style={{ fontSize: '18px', color: '#8ba3c1' }} />} />
            </Badge>

            {/* User Dropdown */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  style={{ backgroundColor: '#1e88e5' }}
                  icon={<UserOutlined />}
                />
                <Text>{user?.username || 'Admin User'}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* License Warning Banner */}
        <LicenseWarningBanner />

        {/* Breadcrumb */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid #1e3a5f',
          }}
        >
          <Breadcrumb items={getBreadcrumbs()} />
        </div>

        {/* Content */}
        <Content
          style={{
            margin: '24px',
            padding: '24px',
            minHeight: 'calc(100vh - 168px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
