// Branding Configuration
// Central configuration for CANARIS branding across the application
// apps/web/src/constants/branding.ts

export const BRANDING = {
  // Company Information
  companyName: 'CANARIS',
  productName: 'EMS Platform',
  fullProductName: 'Enterprise Monitoring System',
  tagline: 'Network Performance Monitoring Solution',
  
  // Version
  version: '2.0.0',
  versionLabel: 'Version 2.0.0',
  
  // Copyright
  copyrightYear: '2024-2026',
  copyrightText: '© 2024-2026 CANARIS. All rights reserved.',
  
  // Logo paths
  logo: {
    main: '/assets/logos/canaris-logo.jpg',
    icon: '/assets/logos/canaris-icon.png', // Small icon version
    light: '/assets/logos/canaris-logo.jpg', // Light theme
    dark: '/assets/logos/canaris-logo-dark.png', // Dark theme (if available)
  },
  
  // Colors (matching CANARIS blue from logo)
  colors: {
    primary: '#1976D2', // CANARIS Blue
    primaryLight: '#42A5F5',
    primaryDark: '#1565C0',
    secondary: '#424242',
    secondaryLight: '#616161',
    secondaryDark: '#212121',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
  },
  
  // Session Configuration
  session: {
    timeoutMinutes: 30,
    warningMinutes: 5, // Warning 5 minutes before timeout
  },
  
  // Password Policy Display
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },
  
  // Contact Information (optional)
  contact: {
    supportEmail: 'support@canaris.com',
    salesEmail: 'sales@canaris.com',
    phone: '+1-xxx-xxx-xxxx',
    website: 'https://www.canaris.com',
  },
  
  // Social Media (optional)
  social: {
    linkedin: 'https://linkedin.com/company/canaris',
    twitter: 'https://twitter.com/canaris',
  },
  
  // Application Settings
  app: {
    defaultTheme: 'light',
    defaultLanguage: 'en',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss',
    timezone: 'UTC',
  },
};

// Helper functions for branding
export const getBrandingColor = (colorName: keyof typeof BRANDING.colors): string => {
  return BRANDING.colors[colorName];
};

export const getLogoPath = (variant: keyof typeof BRANDING.logo = 'main'): string => {
  return BRANDING.logo[variant];
};

export const getCopyrightText = (): string => {
  return BRANDING.copyrightText;
};

export const getFullProductName = (): string => {
  return `${BRANDING.companyName} ${BRANDING.productName}`;
};

// Export default
export default BRANDING;
