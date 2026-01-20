import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { healthAPI } from '../services/api';

const MainLayout = () => {
  const location = useLocation();
  const [backendStatus, setBackendStatus] = useState({ 
    nestjs: false, 
    ml: false,
    nms: false 
  });

  useEffect(() => {
    checkBackends();
    const interval = setInterval(checkBackends, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const checkBackends = async () => {
    const [nestjs, ml, nms] = await Promise.all([
      healthAPI.checkNestJS(),
      healthAPI.checkML(),
      healthAPI.checkNMS(),
    ]);
    setBackendStatus({ nestjs, ml, nms });
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/assets', label: 'Assets', icon: '🖥️' },
    { path: '/alerts', label: 'Alerts', icon: '🚨' },
    { path: '/metrics', label: 'Metrics', icon: '📈' },
    { path: '/correlations', label: 'Correlations', icon: '🔗' },
    { path: '/cloud', label: 'Cloud', icon: '☁️' },
    { path: '/apm', label: 'APM', icon: '⚡' },
    { path: '/network', label: 'Network', icon: '🌐' },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold">EMS Platform</h1>
          <p className="text-sm text-gray-400 mt-1">AI-Powered Monitoring</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Backend Status */}
        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-400 mb-2">Backend Status</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${backendStatus.nestjs ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">NestJS API</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${backendStatus.ml ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">ML Service</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${backendStatus.nms ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">NMS Service</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-800">
              {navItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {new Date().toLocaleString()}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
