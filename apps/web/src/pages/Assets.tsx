import { useState, useEffect } from 'react';
import { assetsAPI, mlAPI } from '../services/api';
import type { Asset } from '../types';

interface AssetWithHealth extends Asset {
  healthScore?: number;
  healthStatus?: string;
}

const Assets = () => {
  const [assets, setAssets] = useState<AssetWithHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'health' | 'status'>('name');

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await assetsAPI.getAll();
      const assetList = response.data || [];

      // Fetch health scores for each asset
      const assetsWithHealth = await Promise.all(
        assetList.map(async (asset) => {
          try {
            const health = await mlAPI.analyzeAssetHealth(asset.id);
            return {
              ...asset,
              healthScore: health.health_score,
              healthStatus: health.status,
            };
          } catch (err) {
            console.error(`Failed to get health for ${asset.name}:`, err);
            return {
              ...asset,
              healthScore: 0,
              healthStatus: 'unknown',
            };
          }
        })
      );

      setAssets(assetsWithHealth);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBgColor = (score?: number) => {
    if (!score) return 'bg-gray-100';
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'maintenance':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierBadge = (tier: string | number) => {
    const tierNum = typeof tier === 'string' ? parseInt(tier.replace('tier', '')) : tier;
    const colors = {
      1: 'bg-red-100 text-red-800',
      2: 'bg-orange-100 text-orange-800',
      3: 'bg-yellow-100 text-yellow-800',
    };
    return colors[tierNum as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      router: '🔀',
      switch: '🔄',
      server: '🖥️',
      firewall: '🔥',
      load_balancer: '⚖️',
      application: '📱',
    };
    return icons[type] || '📦';
  };

  // Filtering
  const filteredAssets = assets.filter((asset) => {
    if (filterType !== 'all' && asset.type !== filterType) return false;
    if (filterStatus !== 'all' && asset.status !== filterStatus) return false;
    return true;
  });

  // Sorting
  const sortedAssets = [...filteredAssets].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'health':
        return (b.healthScore || 0) - (a.healthScore || 0);
      case 'status':
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading assets and health scores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Assets</p>
          <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Online</p>
          <p className="text-2xl font-bold text-green-600">
            {assets.filter((a) => a.status === 'online').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Degraded</p>
          <p className="text-2xl font-bold text-yellow-600">
            {assets.filter((a) => a.status === 'degraded').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Avg Health</p>
          <p className={`text-2xl font-bold ${getHealthColor(
            Math.round(assets.reduce((sum, a) => sum + (a.healthScore || 0), 0) / assets.length)
          )}`}>
            {Math.round(assets.reduce((sum, a) => sum + (a.healthScore || 0), 0) / assets.length)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Types</option>
              <option value="router">Router</option>
              <option value="switch">Switch</option>
              <option value="server">Server</option>
              <option value="firewall">Firewall</option>
              <option value="load_balancer">Load Balancer</option>
              <option value="application">Application</option>
            </select>
          </div>

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
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="degraded">Degraded</option>
              <option value="maintenance">Maintenance</option>
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
              <option value="name">Name</option>
              <option value="health">Health Score</option>
              <option value="status">Status</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadAssets}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Asset
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Health Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                IP Address
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedAssets.map((asset) => (
              <tr key={asset.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">{getTypeIcon(asset.type)}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {asset.name}
                      </div>
                      {asset.vendor && (
                        <div className="text-xs text-gray-500">
                          {asset.vendor} {asset.model}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900 capitalize">
                    {asset.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(asset.status)}`}>
                    {asset.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTierBadge(asset.tier)}`}>
                    Tier {asset.tier}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`w-16 h-2 rounded-full mr-2 ${getHealthBgColor(asset.healthScore)}`}>
                      <div
                        className={`h-2 rounded-full ${asset.healthScore && asset.healthScore >= 80 ? 'bg-green-600' : asset.healthScore && asset.healthScore >= 60 ? 'bg-yellow-600' : 'bg-red-600'}`}
                        style={{ width: `${asset.healthScore || 0}%` }}
                      />
                    </div>
                    <span className={`text-sm font-semibold ${getHealthColor(asset.healthScore)}`}>
                      {asset.healthScore || 0}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {asset.location}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {asset.ip || asset.ipAddress || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedAssets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No assets found matching your filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Assets;