import { useState, useEffect } from 'react';
import {
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  RefreshCw,
  BarChart3,
  Network,
} from 'lucide-react';

interface Application {
  applicationName: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  uptime: number;
  lastCheck: string;
  errorRate: number;
  throughput: number;
  dependencies: string[];
}

interface Transaction {
  id: string;
  applicationName: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: string;
  success: boolean;
  userId?: string;
  errorMessage?: string;
}

interface APMStatus {
  service: string;
  status: string;
  features: {
    healthChecks: boolean;
    transactionMonitoring: boolean;
    metricsTracking: boolean;
    errorTracking: boolean;
  };
  monitoredApplications: number;
  applications: Array<{ name: string; status: string }>;
}

function APM() {
  const [apmStatus, setApmStatus] = useState<APMStatus | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAPMData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [statusRes, appsRes] = await Promise.all([
        fetch('http://localhost:3100/apm/status'),
        fetch('http://localhost:3100/apm/applications'),
      ]);

      if (!statusRes.ok || !appsRes.ok) {
        throw new Error('Failed to fetch APM data');
      }

      const status = await statusRes.json();
      const appsData = await appsRes.json();

      setApmStatus(status);
      setApplications(appsData.applications);

      // Auto-select first app if none selected
      if (!selectedApp && appsData.applications.length > 0) {
        setSelectedApp(appsData.applications[0].applicationName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching APM data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTransactions = async (appName: string) => {
    try {
      const res = await fetch(`http://localhost:3100/apm/applications/${appName}/transactions?limit=20`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      
      const data = await res.json();
      setTransactions(data.transactions);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  useEffect(() => {
    fetchAPMData();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      fetchTransactions(selectedApp);
    }
  }, [selectedApp]);

  const handleRefresh = () => {
    fetchAPMData(true);
    if (selectedApp) {
      fetchTransactions(selectedApp);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'down':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'down':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-100 text-blue-700';
      case 'POST':
        return 'bg-green-100 text-green-700';
      case 'PUT':
        return 'bg-yellow-100 text-yellow-700';
      case 'DELETE':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getResponseTimeColor = (responseTime: number) => {
    if (responseTime < 200) return 'text-green-600';
    if (responseTime < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">Loading APM data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Error loading APM data:</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const selectedAppData = applications.find((app) => app.applicationName === selectedApp);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">APM Lite</h1>
            <p className="text-sm text-gray-600">Application Performance Monitoring</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Status Card */}
      {apmStatus && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Service Status</h2>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-700 capitalize">{apmStatus.status}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Service</p>
              <p className="font-medium text-gray-900">{apmStatus.service}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Applications</p>
              <p className="font-medium text-gray-900">{apmStatus.monitoredApplications}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Health Checks</p>
              <span className={`px-2 py-1 rounded text-xs font-medium ${apmStatus.features.healthChecks ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {apmStatus.features.healthChecks ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Transaction Monitoring</p>
              <span className={`px-2 py-1 rounded text-xs font-medium ${apmStatus.features.transactionMonitoring ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {apmStatus.features.transactionMonitoring ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Error Tracking</p>
              <span className={`px-2 py-1 rounded text-xs font-medium ${apmStatus.features.errorTracking ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {apmStatus.features.errorTracking ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Applications Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Monitored Applications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {applications.map((app) => (
            <div
              key={app.applicationName}
              onClick={() => setSelectedApp(app.applicationName)}
              className={`bg-white rounded-lg shadow-md p-6 border-2 cursor-pointer transition-all hover:shadow-lg ${
                selectedApp === app.applicationName ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(app.status)}
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(app.status)}`}>
                    {app.status}
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">{app.applicationName}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Response Time</span>
                  <span className={`font-medium ${getResponseTimeColor(app.responseTime)}`}>
                    {app.responseTime}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Uptime</span>
                  <span className="font-medium text-gray-900">{(app.uptime * 100).toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Error Rate</span>
                  <span className="font-medium text-gray-900">{(app.errorRate * 100).toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Throughput</span>
                  <span className="font-medium text-gray-900">{app.throughput}/min</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Application Details */}
      {selectedAppData && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedAppData.applicationName}</h2>
                  <p className="text-sm text-gray-600">Application Performance Metrics</p>
                </div>
              </div>
              {selectedAppData.dependencies.length > 0 && (
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {selectedAppData.dependencies.length} dependencies
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Performance Stats */}
          <div className="p-6 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Response Time</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedAppData.responseTime}ms</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Uptime</p>
                  <p className="text-2xl font-bold text-gray-900">{(selectedAppData.uptime * 100).toFixed(2)}%</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Error Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{(selectedAppData.errorRate * 100).toFixed(3)}%</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Throughput</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedAppData.throughput}/min</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="p-6">
            <h3 className="text-md font-semibold text-gray-900 mb-4">Recent Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.slice(0, 10).map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(txn.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getMethodColor(txn.method)}`}>
                          {txn.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono">{txn.endpoint}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            txn.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {txn.statusCode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${getResponseTimeColor(txn.responseTime)}`}>
                          {txn.responseTime}ms
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{txn.userId || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {applications.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Applications Monitored</h3>
          <p className="text-gray-600 mb-4">Start monitoring your applications to see performance metrics.</p>
        </div>
      )}
    </div>
  );
}

export default APM;