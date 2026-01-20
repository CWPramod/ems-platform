import { useState, useEffect } from 'react';
import { nmsAPI } from '../services/api';
import type { NetworkDevice, DeviceMetric } from '../types';

interface DeviceMetricsProps {
  device: NetworkDevice;
}

const DeviceMetrics = ({ device }: DeviceMetricsProps) => {
  const [metrics, setMetrics] = useState<DeviceMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [device.id]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const data = await nmsAPI.getDeviceMetrics(device.id);
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load device metrics:', error);
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Extract latest metrics
  const latestCPU = metrics.find(m => m.metricName === 'cpu_usage')?.value || 0;
  const latestMemory = metrics.find(m => m.metricName === 'memory_usage')?.value || 0;
  const latestBandwidth = metrics.find(m => m.metricName === 'bandwidth_usage')?.value || 0;
  const latestPacketLoss = metrics.find(m => m.metricName === 'packet_loss')?.value || 0;

  return (
    <div className="space-y-6">
      {/* Device Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">IP Address</p>
          <p className="font-mono text-sm font-medium">{device.ipAddress}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Type</p>
          <p className="text-sm font-medium capitalize">{device.type.replace('_', ' ')}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Vendor</p>
          <p className="text-sm font-medium">{device.vendor || 'Unknown'}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Model</p>
          <p className="text-sm font-medium">{device.model || 'Unknown'}</p>
        </div>
      </div>

      {/* Current Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* CPU Usage */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-600">CPU Usage</p>
            <span className="text-xl">💻</span>
          </div>
          <div className="flex items-baseline gap-1">
            <p className={`text-2xl font-bold ${
              latestCPU > 80 ? 'text-red-600' : latestCPU > 60 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {latestCPU.toFixed(1)}
            </p>
            <p className="text-sm text-gray-600">%</p>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                latestCPU > 80 ? 'bg-red-600' : latestCPU > 60 ? 'bg-yellow-600' : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(latestCPU, 100)}%` }}
            />
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-600">Memory Usage</p>
            <span className="text-xl">🧠</span>
          </div>
          <div className="flex items-baseline gap-1">
            <p className={`text-2xl font-bold ${
              latestMemory > 85 ? 'text-red-600' : latestMemory > 70 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {latestMemory.toFixed(1)}
            </p>
            <p className="text-sm text-gray-600">%</p>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                latestMemory > 85 ? 'bg-red-600' : latestMemory > 70 ? 'bg-yellow-600' : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(latestMemory, 100)}%` }}
            />
          </div>
        </div>

        {/* Bandwidth */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-600">Bandwidth</p>
            <span className="text-xl">📡</span>
          </div>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold text-blue-600">
              {latestBandwidth.toFixed(1)}
            </p>
            <p className="text-sm text-gray-600">Mbps</p>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="h-2 rounded-full bg-blue-600"
              style={{ width: `${Math.min(latestBandwidth / 10, 100)}%` }}
            />
          </div>
        </div>

        {/* Packet Loss */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-600">Packet Loss</p>
            <span className="text-xl">📦</span>
          </div>
          <div className="flex items-baseline gap-1">
            <p className={`text-2xl font-bold ${
              latestPacketLoss > 5 ? 'text-red-600' : latestPacketLoss > 1 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {latestPacketLoss.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600">%</p>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                latestPacketLoss > 5 ? 'bg-red-600' : latestPacketLoss > 1 ? 'bg-yellow-600' : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(latestPacketLoss * 10, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* SNMP Configuration */}
      {device.metadata?.snmpCommunity && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">SNMP Configuration</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-blue-700 font-medium">Community</p>
              <p className="text-blue-900">{device.metadata.snmpCommunity}</p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">Version</p>
              <p className="text-blue-900">{device.metadata.snmpVersion}</p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">Port</p>
              <p className="text-blue-900">{device.metadata.snmpPort || 161}</p>
            </div>
          </div>
        </div>
      )}

      {/* No Metrics Available */}
      {metrics.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 mb-2">⚠️ No metrics available for this device</p>
          <p className="text-sm text-yellow-700">
            This device may not have SNMP enabled or NMS hasn't polled it yet.
          </p>
        </div>
      )}

      {/* Historical Charts Placeholder */}
      {metrics.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Historical Trends</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-2">CPU Trend (Last 24h)</p>
              <div className="h-32 flex items-end justify-around gap-1">
                {[...Array(24)].map((_, i) => {
                  const height = Math.random() * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-blue-500 rounded-t"
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-2">Memory Trend (Last 24h)</p>
              <div className="h-32 flex items-end justify-around gap-1">
                {[...Array(24)].map((_, i) => {
                  const height = Math.random() * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-purple-500 rounded-t"
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center mt-4">
            📊 Full historical charts coming soon with time-series data
          </p>
        </div>
      )}
    </div>
  );
};

export default DeviceMetrics;
