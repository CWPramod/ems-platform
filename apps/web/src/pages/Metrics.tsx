import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { assetsAPI, metricsAPI } from '../services/api';
import type { Asset, Metric } from '../types';

const Metrics = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [metrics, setMetrics] = useState<{
    cpu: Metric[];
    memory: Metric[];
    network: Metric[];
  }>({
    cpu: [],
    memory: [],
    network: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'cpu' | 'memory' | 'network'>('cpu');

  useEffect(() => {
    loadAssets();
  }, []);

  useEffect(() => {
    if (selectedAsset) {
      loadMetrics(selectedAsset);
    }
  }, [selectedAsset]);

  const loadAssets = async () => {
    try {
      const response = await assetsAPI.getAll();
      const assetList = response.data || [];
      setAssets(assetList);
      
      // Select first asset by default
      if (assetList.length > 0) {
        setSelectedAsset(assetList[0].id);
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async (assetId: string) => {
    try {
      setLoading(true);
      
      // Fetch different metric types
      const [cpuMetrics, memoryMetrics, networkMetrics] = await Promise.all([
        metricsAPI.query({ assetId, metricName: 'cpu_usage' }),
        metricsAPI.query({ assetId, metricName: 'memory_usage' }),
        metricsAPI.query({ assetId, metricName: 'network_latency' }),
      ]);

      setMetrics({
        cpu: cpuMetrics || [],
        memory: memoryMetrics || [],
        network: networkMetrics || [],
      });
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatChartData = (metricList: Metric[]) => {
    return metricList
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((metric) => ({
        timestamp: new Date(metric.timestamp).toLocaleTimeString(),
        value: metric.value,
        fullTime: new Date(metric.timestamp).toLocaleString(),
      }));
  };

  const getMetricStats = (metricList: Metric[]) => {
    if (metricList.length === 0) {
      return { avg: 0, min: 0, max: 0, current: 0 };
    }

    const values = metricList.map((m) => m.value);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const current = values[values.length - 1];

    return {
      avg: Math.round(avg * 10) / 10,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      current: Math.round(current * 10) / 10,
    };
  };

  const getMetricColor = (metricType: string) => {
    switch (metricType) {
      case 'cpu':
        return '#3b82f6'; // blue
      case 'memory':
        return '#10b981'; // green
      case 'network':
        return '#f59e0b'; // amber
      default:
        return '#6b7280'; // gray
    }
  };

  const getMetricUnit = (metricType: string) => {
    switch (metricType) {
      case 'cpu':
      case 'memory':
        return '%';
      case 'network':
        return 'ms';
      default:
        return '';
    }
  };

  const getMetricLabel = (metricType: string) => {
    switch (metricType) {
      case 'cpu':
        return 'CPU Usage';
      case 'memory':
        return 'Memory Usage';
      case 'network':
        return 'Network Latency';
      default:
        return 'Metric';
    }
  };

  const selectedAssetObj = assets.find((a) => a.id === selectedAsset);
  const currentMetrics = metrics[selectedMetric];
  const chartData = formatChartData(currentMetrics);
  const stats = getMetricStats(currentMetrics);

  if (loading && assets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Asset Selector */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Asset
        </label>
        <select
          value={selectedAsset}
          onChange={(e) => setSelectedAsset(e.target.value)}
          className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-md text-lg"
        >
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name} ({asset.type}) - {asset.location}
            </option>
          ))}
        </select>
        {selectedAssetObj && (
          <div className="mt-2 text-sm text-gray-600">
            IP: {selectedAssetObj.ip || 'N/A'} | Status: 
            <span className={`ml-1 font-semibold ${selectedAssetObj.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
              {selectedAssetObj.status}
            </span>
          </div>
        )}
      </div>

      {/* Metric Type Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedMetric('cpu')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            selectedMetric === 'cpu'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          📊 CPU Usage
        </button>
        <button
          onClick={() => setSelectedMetric('memory')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            selectedMetric === 'memory'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          💾 Memory Usage
        </button>
        {metrics.network.length > 0 && (
          <button
            onClick={() => setSelectedMetric('network')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              selectedMetric === 'network'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            🌐 Network Latency
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Current</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats.current}{getMetricUnit(selectedMetric)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Average</p>
          <p className="text-2xl font-bold text-blue-600">
            {stats.avg}{getMetricUnit(selectedMetric)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Minimum</p>
          <p className="text-2xl font-bold text-green-600">
            {stats.min}{getMetricUnit(selectedMetric)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Maximum</p>
          <p className="text-2xl font-bold text-red-600">
            {stats.max}{getMetricUnit(selectedMetric)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {getMetricLabel(selectedMetric)} - Last 10 Hours
        </h3>
        
        {chartData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No metrics data available for this asset</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                label={{ 
                  value: getMetricLabel(selectedMetric) + ' (' + getMetricUnit(selectedMetric) + ')', 
                  angle: -90, 
                  position: 'insideLeft' 
                }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                formatter={(value: number) => [`${value}${getMetricUnit(selectedMetric)}`, getMetricLabel(selectedMetric)]}
                labelFormatter={(label) => {
                  const item = chartData.find((d) => d.timestamp === label);
                  return item ? item.fullTime : label;
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                name={getMetricLabel(selectedMetric)}
                stroke={getMetricColor(selectedMetric)} 
                strokeWidth={2}
                dot={{ fill: getMetricColor(selectedMetric), r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Anomaly Detection Note */}
        {stats.max > 90 && selectedMetric === 'cpu' && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-red-900 mb-1">🚨 Anomaly Detected</h4>
            <p className="text-sm text-red-800">
              CPU usage spiked to {stats.max}% - significantly above normal range. 
              AI analysis suggests potential performance issue.
            </p>
          </div>
        )}

        {stats.max > 90 && selectedMetric === 'memory' && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-900 mb-1">⚠️ High Memory Usage</h4>
            <p className="text-sm text-yellow-800">
              Memory usage reached {stats.max}% - approaching capacity limits.
            </p>
          </div>
        )}
      </div>

      {/* Data Points Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Data Points</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Timestamp
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Value
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentMetrics.slice(-10).reverse().map((metric, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {new Date(metric.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold text-gray-900">
                    {metric.value}{getMetricUnit(selectedMetric)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {metric.value > 90 ? (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        High
                      </span>
                    ) : metric.value > 70 ? (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                        Elevated
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        Normal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Metrics;