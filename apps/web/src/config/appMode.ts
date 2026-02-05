export type AppMode = 'ems' | 'nms';

export const APP_MODE: AppMode =
  (import.meta.env.VITE_APP_MODE as AppMode) || 'ems';

export const FEATURES = {
  ems: {
    showEMSOverview: true,
    showNMS: true,
    showITSM: true,
    showAPM: true,
    showCloud: true,
    showReports: true,
  },
  nms: {
    showEMSOverview: false,
    showNMS: true,
    showITSM: false,
    showAPM: false,
    showCloud: false,
    showReports: true,
  },
} as const;
