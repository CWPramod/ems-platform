import { useState, useEffect } from 'react';
import { Cloud as CloudIcon, Server, Database, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface EC2Instance {
  name: string;
  type: string;
  ip: string;
  location: string;
  region: string;
  vendor: string;
  status: string;
  metadata: {
    instanceId: string;
    instanceType: string;
    state: string;
    publicIp?: string;
    privateIp: string;
    launchTime: string;
    tags: Record<string, string>;
  };
}

interface RDSDatabase {
  name: string;
  type: string;
  location: string;
  region: string;
  vendor: string;
  status: string;
  metadata: {
    dbInstanceId: string;
    dbInstanceClass: string;
    engine: string;
    engineVersion: string;
    status: string;
    endpoint: string;
    port: number;
    allocatedStorage: number;
    multiAZ: boolean;
  };
}

interface CloudData {
  summary: {
    totalResources: number;
    ec2Count: number;
    rdsCount: number;
  };
  resources: {
    ec2: EC2Instance[];
    rds: RDSDatabase[];
  };
}

interface StatusData {
  service: string;
  status: string;
  region: string;
  features: {
    ec2Discovery: boolean;
    rdsDiscovery: boolean;
    cloudWatchMetrics: boolean;
  };
  credentialsConfigured: boolean;
}

function Cloud() {
  const [cloudData, setCloudData] = useState<CloudData | null>(null);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCloudData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [discoveryRes, statusRes] = await Promise.all([
        fetch('http://localhost:3100/cloud/discover/all'),
        fetch('http://localhost:3100/cloud/status'),
      ]);

      if (!discoveryRes.ok || !statusRes.ok) {
        throw new Error('Failed to fetch cloud data');
      }

      const discovery = await discoveryRes.json();
      const status = await statusRes.json();

      setCloudData(discovery);
      setStatusData(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching cloud data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCloudData();
  }, []);

  const handleRefresh = () => {
    fetchCloudData(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">Loading cloud resources...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Error loading cloud data:</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CloudIcon className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cloud Monitoring</h1>
            <p className="text-sm text-gray-600">AWS Resource Discovery & Management</p>
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
      {statusData && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Service Status</h2>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-700 capitalize">{statusData.status}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Service</p>
              <p className="font-medium text-gray-900">{statusData.service}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Region</p>
              <p className="font-medium text-gray-900">{statusData.region}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Credentials</p>
              <p className={`font-medium ${statusData.credentialsConfigured ? 'text-green-600' : 'text-orange-600'}`}>
                {statusData.credentialsConfigured ? 'Configured' : 'Mock Data Mode'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Features</p>
              <div className="flex gap-1">
                {statusData.features.ec2Discovery && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">EC2</span>
                )}
                {statusData.features.rdsDiscovery && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">RDS</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {cloudData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Resources</p>
                <p className="text-3xl font-bold text-gray-900">{cloudData.summary.totalResources}</p>
              </div>
              <CloudIcon className="w-12 h-12 text-blue-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">EC2 Instances</p>
                <p className="text-3xl font-bold text-gray-900">{cloudData.summary.ec2Count}</p>
              </div>
              <Server className="w-12 h-12 text-green-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">RDS Databases</p>
                <p className="text-3xl font-bold text-gray-900">{cloudData.summary.rdsCount}</p>
              </div>
              <Database className="w-12 h-12 text-purple-500 opacity-20" />
            </div>
          </div>
        </div>
      )}

      {/* EC2 Instances */}
      {cloudData && cloudData.resources.ec2.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-semibold text-gray-900">EC2 Instances</h2>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                {cloudData.resources.ec2.length}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Instance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    State
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Launch Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cloudData.resources.ec2.map((instance, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{instance.name}</p>
                        <p className="text-sm text-gray-500">{instance.metadata.instanceId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                        {instance.metadata.instanceType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded font-medium ${
                          instance.metadata.state === 'running'
                            ? 'bg-green-100 text-green-700'
                            : instance.metadata.state === 'stopped'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {instance.metadata.state}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {instance.metadata.publicIp && (
                          <p className="text-gray-900">{instance.metadata.publicIp}</p>
                        )}
                        <p className="text-gray-500">{instance.metadata.privateIp}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{instance.location}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(instance.metadata.launchTime).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RDS Databases */}
      {cloudData && cloudData.resources.rds.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-gray-900">RDS Databases</h2>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                {cloudData.resources.rds.length}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Database
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engine
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Storage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Multi-AZ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endpoint
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cloudData.resources.rds.map((db, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{db.name}</p>
                        <p className="text-sm text-gray-500">{db.metadata.dbInstanceId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{db.metadata.engine}</p>
                        <p className="text-xs text-gray-500">{db.metadata.engineVersion}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                        {db.metadata.dbInstanceClass}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded font-medium ${
                          db.metadata.status === 'available'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {db.metadata.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{db.metadata.allocatedStorage} GB</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded font-medium ${
                          db.metadata.multiAZ ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {db.metadata.multiAZ ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 truncate max-w-xs">{db.metadata.endpoint}</p>
                      <p className="text-xs text-gray-500">Port: {db.metadata.port}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {cloudData && cloudData.summary.totalResources === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <CloudIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Cloud Resources Found</h3>
          <p className="text-gray-600 mb-4">
            No EC2 instances or RDS databases were discovered in the configured region.
          </p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Discovery
          </button>
        </div>
      )}
    </div>
  );
}

export default Cloud;