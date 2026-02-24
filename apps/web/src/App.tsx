// App.tsx with Dark Blue Theme + Network Topology Route
// apps/web/src/App.tsx

import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import { canarisTheme } from './config/theme';

import Dashboard from './pages/Dashboard';
import NetworkTopology from './pages/NetworkTopology';
import TopTalkers from './pages/TopTalkers';
import DeviceDetails from './pages/DeviceDetails';
import Reports from './pages/Reports';
import Assets from './pages/Assets';
import Alerts from './pages/Alerts';
import Metrics from './pages/Metrics';
import Correlations from './pages/Correlations';
import Cloud from './pages/Cloud';
import APM from './pages/APM';
import Network from './pages/Network';
import MLDashboard from './pages/MLDashboard';
import Security from './pages/Security';
import LicenseManagement from './pages/LicenseManagement';
import Masters from './pages/Masters';
import ITSMTickets from './pages/itsm/Tickets';
import ITSMSlaDashboard from './pages/itsm/SlaDashboard';
import ITSMProblems from './pages/itsm/Problems';
import ITSMChanges from './pages/itsm/Changes';
import ITSMKnowledgeBase from './pages/itsm/KnowledgeBase';
import { APP_MODE, FEATURES } from './config/appMode';

export default function App() {
  return (
    <ConfigProvider theme={canarisTheme}>
      <AuthProvider>
        <Routes>
          {/* Public Route - Login */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes - Wrapped in MainLayout */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Home route: NMS mode lands on Network, EMS mode lands on Dashboard */}
            <Route
              path="/"
              element={APP_MODE === 'nms' ? <Network /> : <Dashboard />}
            />

            {/* Masters (always enabled) */}
            <Route path="/masters" element={<Masters />} />

            {/* NMS routes (always enabled) */}
            <Route path="/network" element={<Network />} />
            <Route path="/topology" element={<NetworkTopology />} />
            <Route path="/top-talkers" element={<TopTalkers />} />
            <Route path="/device/:deviceId" element={<DeviceDetails />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/security" element={<Security />} />
            <Route path="/license" element={<LicenseManagement />} />

            {/* ITSM routes (enabled only in EMS mode) */}
            {FEATURES[APP_MODE].showITSM && (
              <>
                <Route path="/assets" element={<Assets />} />
                <Route path="/itsm/tickets" element={<ITSMTickets />} />
                <Route path="/itsm/sla" element={<ITSMSlaDashboard />} />
                <Route path="/itsm/problems" element={<ITSMProblems />} />
                <Route path="/itsm/changes" element={<ITSMChanges />} />
                <Route path="/itsm/kb" element={<ITSMKnowledgeBase />} />
              </>
            )}
            {FEATURES[APP_MODE].showAPM && (
              <Route path="/apm" element={<APM />} />
            )}
            {FEATURES[APP_MODE].showCloud && (
              <Route path="/cloud" element={<Cloud />} />
            )}
            {FEATURES[APP_MODE].showEMSOverview && (
              <Route path="/correlations" element={<Correlations />} />
            )}

            {/* ML Dashboard */}
            {FEATURES[APP_MODE].showEMSOverview && (
              <Route path="/ml" element={<MLDashboard />} />
            )}
          </Route>

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ConfigProvider>
  );
}
