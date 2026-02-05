// Canaris EMS Platform — Dark Blue Professional Theme
// Uses Ant Design ConfigProvider token-based theming

import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

const { darkAlgorithm } = theme;

export const canarisTheme: ThemeConfig = {
  algorithm: darkAlgorithm,
  token: {
    // Brand colors
    colorPrimary: '#1e88e5',
    colorInfo: '#1e88e5',
    colorSuccess: '#4caf50',
    colorWarning: '#ff9800',
    colorError: '#f44336',

    // Backgrounds
    colorBgBase: '#0a1628',
    colorBgContainer: '#0f2035',
    colorBgElevated: '#162d4a',
    colorBgLayout: '#0a1628',

    // Text
    colorText: '#e6edf5',
    colorTextSecondary: '#8ba3c1',
    colorTextTertiary: '#5c7a99',
    colorTextQuaternary: '#3d5a7a',

    // Borders
    colorBorder: '#1e3a5f',
    colorBorderSecondary: '#152a42',

    // Typography
    fontFamily: "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 14,
    borderRadius: 8,

    // Sizing
    controlHeight: 36,
  },
  components: {
    Layout: {
      siderBg: '#071222',
      headerBg: '#0f2035',
      bodyBg: '#0a1628',
      triggerBg: '#162d4a',
    },
    Menu: {
      darkItemBg: '#071222',
      darkSubMenuItemBg: '#0a1628',
      darkItemSelectedBg: '#1e3a5f',
      darkItemHoverBg: '#0f2035',
      darkItemColor: '#8ba3c1',
      darkItemSelectedColor: '#e6edf5',
    },
    Card: {
      colorBgContainer: '#0f2035',
      colorBorderSecondary: '#1e3a5f',
    },
    Table: {
      colorBgContainer: '#0f2035',
      headerBg: '#162d4a',
      headerColor: '#e6edf5',
      rowHoverBg: '#162d4a',
      borderColor: '#1e3a5f',
    },
    Button: {
      colorPrimaryHover: '#42a5f5',
      defaultBg: '#162d4a',
      defaultColor: '#e6edf5',
      defaultBorderColor: '#1e3a5f',
    },
    Input: {
      colorBgContainer: '#0f2035',
      colorBorder: '#1e3a5f',
      activeBorderColor: '#1e88e5',
      hoverBorderColor: '#42a5f5',
    },
    Select: {
      colorBgContainer: '#0f2035',
      colorBorder: '#1e3a5f',
      optionSelectedBg: '#1e3a5f',
    },
    Modal: {
      contentBg: '#0f2035',
      headerBg: '#0f2035',
    },
    Statistic: {
      colorTextDescription: '#8ba3c1',
    },
    Tag: {
      defaultBg: '#162d4a',
      defaultColor: '#8ba3c1',
    },
    Tabs: {
      itemColor: '#8ba3c1',
      itemActiveColor: '#1e88e5',
      itemSelectedColor: '#1e88e5',
      inkBarColor: '#1e88e5',
    },
    Badge: {
      colorBgContainer: '#0f2035',
    },
    Breadcrumb: {
      itemColor: '#5c7a99',
      lastItemColor: '#8ba3c1',
      separatorColor: '#3d5a7a',
    },
    Dropdown: {
      colorBgElevated: '#162d4a',
    },
    Drawer: {
      colorBgElevated: '#0f2035',
    },
    Progress: {
      remainingColor: '#1e3a5f',
    },
    Descriptions: {
      colorTextSecondary: '#8ba3c1',
    },
    Alert: {
      colorInfoBg: '#0f2035',
      colorInfoBorder: '#1e3a5f',
    },
    DatePicker: {
      colorBgContainer: '#0f2035',
      colorBorder: '#1e3a5f',
    },
    Form: {
      labelColor: '#8ba3c1',
    },
    Divider: {
      colorSplit: '#1e3a5f',
    },
  },
};
