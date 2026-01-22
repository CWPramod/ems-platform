import { Outlet, NavLink } from 'react-router-dom';
import { APP_MODE, FEATURES } from '../config/appMode';

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  color: '#fff',
  textDecoration: 'none',
  padding: '8px 12px',
  borderRadius: '6px',
  background: isActive ? '#2563eb' : 'transparent',
});

export default function MainLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '220px',
          background: '#0f172a',
          color: '#fff',
          padding: '16px',
        }}
      >
        <h2 style={{ marginBottom: '24px' }}>
          {APP_MODE === 'nms' ? 'NMS Dashboard' : 'EMS Platform'}
        </h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* EMS Overview */}
          {FEATURES[APP_MODE].showEMSOverview && (
            <NavLink to="/" style={linkStyle}>
              Dashboard
            </NavLink>
          )}

          {/* NMS Menus (always visible) */}
          <NavLink to="/network" style={linkStyle}>
            Network
          </NavLink>
          <NavLink to="/alerts" style={linkStyle}>
            Alerts
          </NavLink>
          <NavLink to="/metrics" style={linkStyle}>
            Metrics
          </NavLink>

          {/* EMS-only Menus */}
          {FEATURES[APP_MODE].showITSM && (
            <NavLink to="/assets" style={linkStyle}>
              Assets
            </NavLink>
          )}
          {FEATURES[APP_MODE].showAPM && (
            <NavLink to="/apm" style={linkStyle}>
              APM
            </NavLink>
          )}
          {FEATURES[APP_MODE].showCloud && (
            <NavLink to="/cloud" style={linkStyle}>
              Cloud
            </NavLink>
          )}
          {FEATURES[APP_MODE].showEMSOverview && (
            <NavLink to="/correlations" style={linkStyle}>
              Correlations
            </NavLink>
          )}

          {/* ML Dashboard - Always visible in EMS mode */}
          {FEATURES[APP_MODE].showEMSOverview && (
            <NavLink to="/ml" style={linkStyle}>
              🤖 ML Dashboard
            </NavLink>
          )}
        </nav>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '24px', background: '#f8fafc' }}>
        <Outlet />
      </main>
    </div>
  );
}
