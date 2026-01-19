import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Alerts from './pages/Alerts';
import Metrics from './pages/Metrics';
import Correlations from './pages/Correlations';
import Cloud from './pages/Cloud';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="assets" element={<Assets />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="metrics" element={<Metrics />} />
        <Route path="correlations" element={<Correlations />} />
        <Route path="cloud" element={<Cloud />} />

      </Route>
    </Routes>
  );
}

export default App;