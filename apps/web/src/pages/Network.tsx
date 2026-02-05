import { useState, useEffect } from 'react';
import { nmsAPI, eventsAPI, assetsAPI } from '../services/api';
import type { NetworkDevice, NMSStatus, Event, Asset } from '../types';
import NetworkTopology from '../components/NetworkTopology';
import DeviceMetrics from '../components/DeviceMetrics';
import NetworkEvents from '../components/NetworkEvents';

const Network = () => {
  const [nmsStatus, setNmsStatus] = useState<NMSStatus | null>(null);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Network device types
  const NETWORK_DEVICE_TYPES = ['router', 'switch', 'firewall', 'load_balancer', 'access_point', 'network_device'];

  useEffect(() => {
    loadNetworkData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadNetworkData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNetworkData = async () => {
    try {
      setLoading(true);

      // Fetch each data source independently so one failure doesn't block others
      let allAssets: Asset[] = [];
      let nmsStatusData: NMSStatus | null = null;
      let eventsData: Event[] = [];

      // 1. Fetch assets (always available from main API)
      try {
        const assetsRes = await assetsAPI.getAll();
        allAssets = assetsRes.data || [];
      } catch (err) {
        console.warn('Failed to load assets:', err);
      }

      // 2. Try NMS status (may not be running - service was migrated)
      try {
        const statusRes = await nmsAPI.getStatus();
        nmsStatusData = statusRes;
      } catch {
        // NMS service not available - this is OK, we'll use asset status directly
        console.info('NMS service not available, using asset status directly');
      }

      // 3. Fetch events
      try {
        const eventsRes = await eventsAPI.getAll({ source: 'nms' });
        eventsData = eventsRes.data || [];
      } catch {
        console.warn('Failed to load events');
      }

      // Filter for network devices (include all statuses, not just online)
      const networkAssets = allAssets.filter((asset: Asset) =>
        NETWORK_DEVICE_TYPES.includes(asset.type)
      );

      // Create device status map from NMS if available
      const deviceStatusMap = new Map();
      if (nmsStatusData?.devices) {
        nmsStatusData.devices.forEach((device: any) => {
          deviceStatusMap.set(device.assetId, {
            isReachable: device.isReachable,
            lastPollTime: device.lastPollTime,
            consecutiveFailures: device.consecutiveFailures,
          });
        });
      }

      // Merge asset data with NMS status (or use asset status as fallback)
      const enrichedDevices: NetworkDevice[] = networkAssets.map((asset: Asset) => {
        const nmsDeviceStatus = deviceStatusMap.get(asset.id);

        // Determine status: use NMS if available, otherwise map from asset status
        let deviceStatus: string;
        if (nmsDeviceStatus) {
          deviceStatus = nmsDeviceStatus.isReachable ? 'reachable' : 'unreachable';
        } else {
          // Map asset status to network device status
          deviceStatus = asset.status === 'online' ? 'reachable'
            : asset.status === 'warning' ? 'degraded'
            : 'unreachable';
        }

        return {
          id: asset.id,
          name: asset.name,
          type: asset.type,
          ipAddress: asset.ip || (asset as any).ipAddress,
          status: deviceStatus,
          vendor: asset.vendor,
          model: asset.model,
          location: asset.location,
          tier: (asset as any).tier,
          uptime: deviceStatus === 'reachable' ? 99.9 : deviceStatus === 'degraded' ? 85.0 : 0,
          lastSeen: nmsDeviceStatus?.lastPollTime,
          metadata: asset.metadata,
        };
      });

      setNmsStatus(nmsStatusData);
      setDevices(enrichedDevices);
      setEvents(eventsData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load network data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscovery = async () => {
    try {
      await nmsAPI.triggerDiscovery();
      // Reload data after a short delay
      setTimeout(loadNetworkData, 2000);
    } catch (error) {
      console.error('Failed to trigger discovery:', error);
    }
  };

  const handleRefresh = () => {
    loadNetworkData();
  };

  // Calculate stats
  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'reachable').length,
    offline: devices.filter(d => d.status === 'unreachable').length,
    degraded: devices.filter(d => d.status === 'degraded').length,
    avgUptime: devices.length > 0 
      ? devices.reduce((sum, d) => sum + (d.uptime || 0), 0) / devices.length 
      : 0,
  };

  const recentEvents = events.slice(0, 10);

  if (loading && !nmsStatus) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading network data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
          <button
            onClick={handleDiscovery}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <span>🔍</span>
            <span>Discover Devices</span>
          </button>
        </div>
        <div className="text-sm text-gray-600">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Total Devices */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Devices</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="text-4xl">🌐</div>
          </div>
        </div>

        {/* Online */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Online</p>
              <p className="text-3xl font-bold text-green-600">{stats.online}</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>

        {/* Offline */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Offline</p>
              <p className="text-3xl font-bold text-red-600">{stats.offline}</p>
            </div>
            <div className="text-4xl">❌</div>
          </div>
        </div>

        {/* Degraded */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Degraded</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.degraded}</p>
            </div>
            <div className="text-4xl">⚠️</div>
          </div>
        </div>

        {/* Avg Uptime */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Uptime</p>
              <p className="text-3xl font-bold text-blue-600">{stats.avgUptime.toFixed(1)}%</p>
            </div>
            <div className="text-4xl">⏱️</div>
          </div>
        </div>
      </div>

      {/* Network Topology */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Topology</h3>
        <NetworkTopology 
          devices={devices} 
          onDeviceSelect={setSelectedDevice}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device List & Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Devices</h3>
          <div className="space-y-4">
            {devices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-xl mb-2">🔍</p>
                <p>No network devices found</p>
                <p className="text-sm mt-1">Click "Discover Devices" to scan for devices</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {devices.map((device) => (
                      <tr 
                        key={device.id}
                        onClick={() => setSelectedDevice(device)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">
                              {device.type === 'router' && '🔀'}
                              {device.type === 'switch' && '🔌'}
                              {device.type === 'firewall' && '🛡️'}
                              {device.type === 'load_balancer' && '⚖️'}
                              {!['router', 'switch', 'firewall', 'load_balancer'].includes(device.type) && '🌐'}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900">{device.name}</p>
                              {device.vendor && (
                                <p className="text-xs text-gray-500">{device.vendor} {device.model}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                          {device.type.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          {device.ipAddress}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            device.status === 'reachable' 
                              ? 'bg-green-100 text-green-800'
                              : device.status === 'unreachable'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {device.status || 'unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {device.location || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Events Timeline */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Events</h3>
          <NetworkEvents events={recentEvents} />
        </div>
      </div>

      {/* Device Metrics (if device selected) */}
      {selectedDevice && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Device Metrics: {selectedDevice.name}
            </h3>
            <button
              onClick={() => setSelectedDevice(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <DeviceMetrics device={selectedDevice} />
        </div>
      )}
    </div>
  );
};

export default Network;
