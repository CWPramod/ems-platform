import { useState, useEffect } from 'react';
import { alertsAPI, mlAPI } from '../services/api';
import type { Alert, CorrelationResult } from '../types';

const Correlations = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [correlationResult, setCorrelationResult] = useState<CorrelationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [timeWindow, setTimeWindow] = useState<number>(1440); // 24 hours in minutes

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get open and acknowledged alerts
      const response = await alertsAPI.getAll();
      const alertList = (response.data || []).filter(
        (a) => a.status === 'open' || a.status === 'acknowledged'
      );
      
      setAlerts(alertList);

      // Auto-analyze if we have alerts
      if (alertList.length > 0) {
        await analyzeCorrelations(alertList);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeCorrelations = async (alertList: Alert[]) => {
    if (alertList.length === 0) {
      return;
    }

    try {
      setAnalyzing(true);
      
      const result = await mlAPI.findCorrelations({
        alerts: alertList,
        time_window_minutes: timeWindow,
      });

      setCorrelationResult(result);
    } catch (error) {
      console.error('Failed to analyze correlations:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const getGroupTypeColor = (type: string) => {
    switch (type) {
      case 'fingerprint':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'asset':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'time_cluster':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getGroupIcon = (type: string) => {
    switch (type) {
      case 'fingerprint':
        return '🔗';
      case 'asset':
        return '🖥️';
      case 'time_cluster':
        return '⏱️';
      default:
        return '📊';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-red-600';
    if (score >= 0.6) return 'text-orange-600';
    return 'text-yellow-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading correlations...</p>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center bg-white rounded-lg shadow p-12">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Active Alerts</h2>
          <p className="text-gray-600">
            All alerts have been resolved. Correlation analysis requires active alerts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">🤖 AI-Powered Alert Correlation</h2>
        <p className="text-purple-100">
          Machine learning analysis to identify related alerts, reduce noise, and find root causes
        </p>
      </div>

      {/* Stats Cards */}
      {correlationResult && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Alerts</p>
            <p className="text-2xl font-bold text-gray-900">
              {correlationResult.total_alerts}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Correlation Groups</p>
            <p className="text-2xl font-bold text-purple-600">
              {correlationResult.correlation_groups.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Unique Fingerprints</p>
            <p className="text-2xl font-bold text-blue-600">
              {correlationResult.unique_fingerprints}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Alert Storm</p>
            <p className={`text-2xl font-bold ${correlationResult.alert_storm_detected ? 'text-red-600' : 'text-green-600'}`}>
              {correlationResult.alert_storm_detected ? 'YES' : 'NO'}
            </p>
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Window
            </label>
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value={60}>1 Hour</option>
              <option value={360}>6 Hours</option>
              <option value={720}>12 Hours</option>
              <option value={1440}>24 Hours</option>
              <option value={4320}>3 Days</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => analyzeCorrelations(alerts)}
              disabled={analyzing}
              className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400"
            >
              {analyzing ? '⏳ Analyzing...' : '🔍 Re-analyze'}
            </button>
          </div>
        </div>
      </div>

      {/* Correlation Groups */}
      {correlationResult && correlationResult.correlation_groups.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Correlation Groups ({correlationResult.correlation_groups.length})
          </h3>
          
          {correlationResult.correlation_groups.map((group, idx) => (
            <div key={idx} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="p-6">
                {/* Group Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getGroupIcon(group.type)}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getGroupTypeColor(group.type)}`}>
                          {group.type.toUpperCase().replace('_', ' ')}
                        </span>
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
                          {group.alert_count} Alerts
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900">
                        Correlation Score: 
                        <span className={`ml-2 ${getScoreColor(group.correlation_score)}`}>
                          {(group.correlation_score * 100).toFixed(0)}%
                        </span>
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Analysis:</span> {group.reason}
                  </p>
                </div>

                {/* Alert IDs */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Correlated Alerts:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.alert_ids.map((alertId) => {
                      const alert = alerts.find((a) => a.id === alertId);
                      return (
                        <div
                          key={alertId}
                          className="px-3 py-2 bg-gray-100 rounded-md text-sm"
                        >
                          <span className="font-mono text-gray-600">
                            {alertId.substring(0, 8)}...
                          </span>
                          {alert?.event?.title && (
                            <span className="ml-2 text-gray-900">
                              {alert.event.title}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recommendation */}
                {group.correlation_score >= 0.8 && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                    <h5 className="text-sm font-semibold text-green-900 mb-1">
                      💡 Recommendation
                    </h5>
                    <p className="text-sm text-green-800">
                      High correlation detected! Consider treating these alerts as a single incident. 
                      Focus on resolving the root cause rather than individual symptoms.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Correlations Found
          </h3>
          <p className="text-gray-600">
            No significant correlations detected among current alerts.
            This could indicate isolated, independent issues.
          </p>
        </div>
      )}

      {/* Alert Storm Warning */}
      {correlationResult?.alert_storm_detected && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">⚠️</div>
            <div>
              <h3 className="text-lg font-bold text-red-900 mb-2">
                Alert Storm Detected!
              </h3>
              <p className="text-red-800 mb-3">
                Multiple alerts firing in rapid succession. This typically indicates a cascading 
                failure or widespread system issue requiring immediate attention.
              </p>
              <div className="bg-white rounded p-3 text-sm">
                <p className="font-semibold text-red-900 mb-1">Recommended Actions:</p>
                <ul className="list-disc list-inside text-red-800 space-y-1">
                  <li>Identify and address the root cause immediately</li>
                  <li>Consider suppressing duplicate/related alerts</li>
                  <li>Check system-wide health metrics</li>
                  <li>Review recent changes or deployments</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          How Correlation Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl mb-2">🔗</div>
            <h4 className="font-semibold text-purple-900 mb-1">Fingerprint Match</h4>
            <p className="text-sm text-purple-800">
              Groups alerts with identical event signatures (90% correlation)
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl mb-2">🖥️</div>
            <h4 className="font-semibold text-blue-900 mb-1">Asset Grouping</h4>
            <p className="text-sm text-blue-800">
              Links alerts affecting the same infrastructure (70% correlation)
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-2xl mb-2">⏱️</div>
            <h4 className="font-semibold text-green-900 mb-1">Time Clustering</h4>
            <p className="text-sm text-green-800">
              Identifies alerts occurring in close temporal proximity (60% correlation)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Correlations;