import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { assetsAPI, alertsAPI, mlAPI } from '../services/api';
import type { Asset, Alert, DashboardStats } from '../types';

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAssets: 0,
    onlineAssets: 0,
    totalAlerts: 0,
    openAlerts: 0,
    criticalAlerts: 0,
    averageHealthScore: 0,
  });
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [assetsRes, alertsRes] = await Promise.all([
        assetsAPI.getAll(),
        alertsAPI.getAll({ sortBy: 'createdAt', order: 'desc' }),
      ]);

      const assets = assetsRes.data || [];
      const alerts = alertsRes.data || [];

      // Calculate stats
      const onlineAssets = assets.filter(a => a.status === 'online').length;
      const openAlerts = alerts.filter(a => a.status === 'open').length;
      const criticalAlerts = alerts.filter(a => 
        a.event?.severity === 'critical' && a.status === 'open'
      ).length;

      // Get health scores for assets (limit to first 5 for performance)
      let totalHealthScore = 0;
      let healthScoreCount = 0;

      for (const asset of assets.slice(0, 5)) {
        try {
          const health = await mlAPI.analyzeAssetHealth(asset.id);
          totalHealthScore += health.health_score;
          healthScoreCount++;
        } catch (err) {
          console.error(`Failed to get health for asset ${asset.id}:`, err);
        }
      }

      const averageHealthScore = healthScoreCount > 0 
        ? Math.round(totalHealthScore / healthScoreCount) 
        : 0;

      setStats({
        totalAssets: assets.length,
        onlineAssets,
        totalAlerts: alerts.length,
        openAlerts,
        criticalAlerts,
        averageHealthScore,
      });

      setRecentAlerts(alerts.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Assets */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Assets</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalAssets}</p>
              <p className="text-sm text-green-600 mt-1">
                {stats.onlineAssets} online
              </p>
            </div>
            <div className="text-4xl">🖥️</div>
          </div>
        </div>

        {/* Open Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Open Alerts</p>
              <p className="text-3xl font-bold text-gray-900">{stats.openAlerts}</p>
              <p className="text-sm text-red-600 mt-1">
                {stats.criticalAlerts} critical
              </p>
            </div>
            <div className="text-4xl">🚨</div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Health Score</p>
              <p className={`text-3xl font-bold ${getHealthColor(stats.averageHealthScore)}`}>
                {stats.averageHealthScore}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                AI-powered analysis
              </p>
            </div>
            <div className="text-4xl">💚</div>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Alerts</h3>
          <Link 
            to="/alerts" 
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View All →
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {recentAlerts.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No alerts found
            </div>
          ) : (
            recentAlerts.map((alert) => (
              <div key={alert.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(alert.event?.severity)}`}>
                        {alert.event?.severity || 'info'}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(alert.status)}`}>
                        {alert.status}
                      </span>
                      {alert.businessImpactScore && (
                        <span className="text-xs text-gray-600">
                          Impact: {alert.businessImpactScore}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 mb-1">
                      {alert.event?.title || 'Alert'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {alert.event?.message || 'No message'}
                    </p>
                    {alert.affectedUsers && (
                      <p className="text-xs text-red-600 mt-1">
                        ~{alert.affectedUsers} users affected
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-xs text-gray-500">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/assets"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">🖥️</div>
            <div>
              <h4 className="font-semibold text-gray-900">Manage Assets</h4>
              <p className="text-sm text-gray-600">View and monitor all assets</p>
            </div>
          </div>
        </Link>

        <Link
          to="/alerts"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">🚨</div>
            <div>
              <h4 className="font-semibold text-gray-900">View Alerts</h4>
              <p className="text-sm text-gray-600">Manage and resolve alerts</p>
            </div>
          </div>
        </Link>

        <Link
          to="/correlations"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">🔗</div>
            <div>
              <h4 className="font-semibold text-gray-900">Correlations</h4>
              <p className="text-sm text-gray-600">AI-powered insights</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;