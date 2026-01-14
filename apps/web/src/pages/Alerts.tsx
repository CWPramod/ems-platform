import { useState, useEffect } from 'react';
import { alertsAPI, mlAPI } from '../services/api';
import type { Alert } from '../types';

const Alerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'severity' | 'impact'>('date');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await alertsAPI.getAll({ sortBy: 'createdAt', order: 'desc' });
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await alertsAPI.acknowledge(alertId, {
        acknowledgedBy: 'admin@ems.com',
        notes: 'Acknowledged via dashboard'
      });
      await loadAlerts();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await alertsAPI.resolve(alertId, {
        resolvedBy: 'admin@ems.com',
        notes: 'Resolved via dashboard',
        resolutionCategory: 'fixed'
      });
      await loadAlerts();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const handleClose = async (alertId: string) => {
    try {
      await alertsAPI.close(alertId, {
        closedBy: 'admin@ems.com',
        notes: 'Closed via dashboard'
      });
      await loadAlerts();
    } catch (error) {
      console.error('Failed to close alert:', error);
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
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
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getImpactColor = (score?: number) => {
    if (!score) return 'text-gray-600';
    if (score >= 80) return 'text-red-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-yellow-600';
  };

  // Filtering
  const filteredAlerts = alerts.filter((alert) => {
    if (filterStatus !== 'all' && alert.status !== filterStatus) return false;
    if (filterSeverity !== 'all' && alert.event?.severity !== filterSeverity) return false;
    return true;
  });

  // Sorting
  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'severity':
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        return (severityOrder[b.event?.severity as keyof typeof severityOrder] || 0) - 
               (severityOrder[a.event?.severity as keyof typeof severityOrder] || 0);
      case 'impact':
        return (b.businessImpactScore || 0) - (a.businessImpactScore || 0);
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Alerts</p>
          <p className="text-2xl font-bold text-gray-900">{alerts.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Open</p>
          <p className="text-2xl font-bold text-red-600">
            {alerts.filter((a) => a.status === 'open').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Critical</p>
          <p className="text-2xl font-bold text-red-600">
            {alerts.filter((a) => a.event?.severity === 'critical' && a.status === 'open').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Avg Impact</p>
          <p className={`text-2xl font-bold ${getImpactColor(
            Math.round(alerts.reduce((sum, a) => sum + (a.businessImpactScore || 0), 0) / alerts.length)
          )}`}>
            {Math.round(alerts.reduce((sum, a) => sum + (a.businessImpactScore || 0), 0) / alerts.length)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Severity
            </label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="date">Date</option>
              <option value="severity">Severity</option>
              <option value="impact">Business Impact</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadAlerts}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {sortedAlerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <div className="p-6">
              {/* Alert Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getSeverityColor(alert.event?.severity)}`}>
                      {alert.event?.severity?.toUpperCase() || 'INFO'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(alert.status)}`}>
                      {alert.status.toUpperCase()}
                    </span>
                    {alert.businessImpactScore && (
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800`}>
                        Impact: {alert.businessImpactScore}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {alert.event?.title || 'Alert'}
                  </h3>
                  <p className="text-gray-600">
                    {alert.event?.message || 'No message available'}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm text-gray-500">
                    {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* ML Insights */}
              {(alert.affectedUsers || alert.revenueAtRisk || alert.rootCauseAssetId) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">🤖 AI-Powered Insights</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {alert.affectedUsers && (
                      <div>
                        <span className="text-blue-700 font-medium">Affected Users:</span>
                        <span className="text-blue-900 ml-2">~{alert.affectedUsers}</span>
                      </div>
                    )}
                    {alert.revenueAtRisk && (
                      <div>
                        <span className="text-blue-700 font-medium">Revenue at Risk:</span>
                        <span className="text-blue-900 ml-2">${alert.revenueAtRisk.toLocaleString()}</span>
                      </div>
                    )}
                    {alert.rootCauseAssetId && (
                      <div>
                        <span className="text-blue-700 font-medium">Root Cause:</span>
                        <span className="text-blue-900 ml-2">Identified</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Event Details */}
              {alert.event && (
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 font-medium">Source:</span>
                      <span className="text-gray-900 ml-2">{alert.event.source}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Category:</span>
                      <span className="text-gray-900 ml-2">{alert.event.category}</span>
                    </div>
                    {alert.event.occurrenceCount > 1 && (
                      <div>
                        <span className="text-gray-600 font-medium">Occurrences:</span>
                        <span className="text-gray-900 ml-2">{alert.event.occurrenceCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Resolution Notes */}
              {alert.resolutionNotes && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-green-900 mb-1">Resolution Notes</h4>
                  <p className="text-sm text-green-800">{alert.resolutionNotes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {alert.status === 'open' && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm font-medium"
                  >
                    ✓ Acknowledge
                  </button>
                )}
                {(alert.status === 'open' || alert.status === 'acknowledged') && (
                  <button
                    onClick={() => handleResolve(alert.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                  >
                    ✓ Resolve
                  </button>
                )}
                {alert.status === 'resolved' && (
                  <button
                    onClick={() => handleClose(alert.id)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
                  >
                    ✓ Close
                  </button>
                )}
                {alert.status === 'closed' && (
                  <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md text-sm font-medium">
                    ✓ Closed
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {sortedAlerts.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-xl text-gray-600">No alerts found matching your filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;