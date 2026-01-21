import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';

import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Alerts from './pages/Alerts';
import Metrics from './pages/Metrics';
import Correlations from './pages/Correlations';
import Cloud from './pages/Cloud';
import APM from './pages/APM';
import Network from './pages/Network';

import { APP_MODE, FEATURES } from './config/appMode';

export default function App() {
  return (
    <Routes>
      {/* MainLayout is the shell (sidebar/header). It must wrap child routes. */}
      <Route element={<MainLayout />}>
        {/* Home route: NMS mode lands on Network, EMS mode lands on Dashboard */}
        <Route path="/" element={APP_MODE === 'nms' ? <Network /> : <Dashboard />} />

        {/* NMS routes (always enabled) */}
        <Route path="/network" element={<Network />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/metrics" element={<Metrics />} />

        {/* EMS-only routes (enabled only in EMS mode) */}
        {FEATURES[APP_MODE].showITSM && <Route path="/assets" element={<Assets />} />}
        {FEATURES[APP_MODE].showAPM && <Route path="/apm" element={<APM />} />}
        {FEATURES[APP_MODE].showCloud && <Route path="/cloud" element={<Cloud />} />}
        {FEATURES[APP_MODE].showEMSOverview && (
          <Route path="/correlations" element={<Correlations />} />
        )}
      </Route>
    </Routes>
  );
}
