export interface ProbeDevice {
  assetId: string;
  name: string;
  ip: string;
  snmpCommunity: string;
  snmpVersion: string;
}

export const RAILTEL_DEVICES: ProbeDevice[] = [
  {
    assetId: 'a0000001-0001-0001-0001-000000000001',
    name: 'DM-Tuticorin',
    ip: '172.26.186.110',
    snmpCommunity: 'RailTel@2025',
    snmpVersion: 'v2c',
  },
  {
    assetId: 'a0000001-0001-0001-0001-000000000002',
    name: 'DM-Theni',
    ip: '172.26.186.114',
    snmpCommunity: 'RailTel@2025',
    snmpVersion: 'v2c',
  },
  {
    assetId: 'a0000001-0001-0001-0001-000000000003',
    name: 'DM-Vellore',
    ip: '172.26.186.106',
    snmpCommunity: 'RailTel@2025',
    snmpVersion: 'v2c',
  },
  {
    assetId: 'a0000001-0001-0001-0001-000000000004',
    name: 'Depot-Coimbatore South(PLMD)',
    ip: '172.26.186.10',
    snmpCommunity: 'RailTel@2025',
    snmpVersion: 'v2c',
  },
  {
    assetId: 'a0000001-0001-0001-0001-000000000005',
    name: 'DM-Dindigul',
    ip: '172.26.186.102',
    snmpCommunity: 'RailTel@2025',
    snmpVersion: 'v2c',
  },
];

export function getProbeConfig() {
  return {
    probeId: process.env.PROBE_ID || 'railtel-pop-01',
    emsApiUrl: process.env.EMS_API_URL || 'http://122.252.227.202:3100',
    probeApiKey: process.env.PROBE_API_KEY || '',
    probePort: parseInt(process.env.PROBE_PORT || '3200', 10),
    pollIntervalSeconds: parseInt(process.env.POLL_INTERVAL_SECONDS || '30', 10),
  };
}
