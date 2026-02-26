// Sophos Firewall SNMP OID Configuration
// Covers SNMPv2-MIB, IF-MIB, HOST-RESOURCES-MIB, and Sophos Enterprise MIB
// apps/api/src/monitoring/config/sophos-oids.ts

export const SOPHOS_OIDS = {
  // ── SNMPv2-MIB (System Information) ───────────────────────────────────────
  system: {
    sysDescr: '1.3.6.1.2.1.1.1.0',
    sysObjectID: '1.3.6.1.2.1.1.2.0',
    sysUpTime: '1.3.6.1.2.1.1.3.0',
    sysContact: '1.3.6.1.2.1.1.4.0',
    sysName: '1.3.6.1.2.1.1.5.0',
    sysLocation: '1.3.6.1.2.1.1.6.0',
  },

  // ── IF-MIB (Interface Table) ──────────────────────────────────────────────
  interfaces: {
    ifNumber: '1.3.6.1.2.1.2.1.0',
    // Table OIDs (walk base — append .ifIndex for specific interface)
    ifDescr: '1.3.6.1.2.1.2.2.1.2',
    ifType: '1.3.6.1.2.1.2.2.1.3',
    ifSpeed: '1.3.6.1.2.1.2.2.1.5',
    ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
    ifInOctets: '1.3.6.1.2.1.2.2.1.10',
    ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
    ifInErrors: '1.3.6.1.2.1.2.2.1.14',
    ifOutErrors: '1.3.6.1.2.1.2.2.1.20',
    // 64-bit high-capacity counters (IF-MIB)
    ifHCInOctets: '1.3.6.1.2.1.31.1.1.1.6',
    ifHCOutOctets: '1.3.6.1.2.1.31.1.1.1.10',
    ifHighSpeed: '1.3.6.1.2.1.31.1.1.1.15',
    ifName: '1.3.6.1.2.1.31.1.1.1.1',
  },

  // ── HOST-RESOURCES-MIB (CPU / Memory / Storage) ───────────────────────────
  hostResources: {
    // CPU — walk returns load per processor; average them
    hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
    // Storage table (walk base)
    hrStorageDescr: '1.3.6.1.2.1.25.2.3.1.3',
    hrStorageAllocationUnits: '1.3.6.1.2.1.25.2.3.1.4',
    hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
    hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',
    hrStorageType: '1.3.6.1.2.1.25.2.3.1.2',
    // Memory size (scalar)
    hrMemorySize: '1.3.6.1.2.1.25.2.2.0',
  },

  // ── Sophos Enterprise MIB (1.3.6.1.4.1.2604.5.1) ────────────────────────
  // Sophos XG / SFOS specific OIDs
  sophos: {
    // Firewall status
    sfosDeviceName: '1.3.6.1.4.1.2604.5.1.1.1.0',
    sfosDeviceType: '1.3.6.1.4.1.2604.5.1.1.2.0',
    sfosDeviceFWVersion: '1.3.6.1.4.1.2604.5.1.1.3.0',
    sfosWebcatVersion: '1.3.6.1.4.1.2604.5.1.1.4.0',
    sfosIPSVersion: '1.3.6.1.4.1.2604.5.1.1.5.0',

    // Live connections & users
    sfosLiveUsersCount: '1.3.6.1.4.1.2604.5.1.2.1.0',
    sfosHTTPHits: '1.3.6.1.4.1.2604.5.1.2.2.0',
    sfosFTPHits: '1.3.6.1.4.1.2604.5.1.2.3.0',

    // Service status (1 = untouched, 2 = stopped, 3 = initializing, 4 = running, 5 = exiting)
    sfosPoP3Service: '1.3.6.1.4.1.2604.5.1.3.1.0',
    sfosIMAP4Service: '1.3.6.1.4.1.2604.5.1.3.2.0',
    sfosSMTPService: '1.3.6.1.4.1.2604.5.1.3.3.0',
    sfosFTPService: '1.3.6.1.4.1.2604.5.1.3.4.0',
    sfosHTTPService: '1.3.6.1.4.1.2604.5.1.3.5.0',
    sfosAVService: '1.3.6.1.4.1.2604.5.1.3.6.0',
    sfosASService: '1.3.6.1.4.1.2604.5.1.3.7.0',
    sfosDNSService: '1.3.6.1.4.1.2604.5.1.3.8.0',
    sfosHAService: '1.3.6.1.4.1.2604.5.1.3.9.0',
    sfosIPSService: '1.3.6.1.4.1.2604.5.1.3.10.0',
    sfosApacheService: '1.3.6.1.4.1.2604.5.1.3.11.0',
    sfosNTPService: '1.3.6.1.4.1.2604.5.1.3.12.0',
    sfosTomcatService: '1.3.6.1.4.1.2604.5.1.3.13.0',
    sfosSSLVPNService: '1.3.6.1.4.1.2604.5.1.3.14.0',
    sfosIPSecVPNService: '1.3.6.1.4.1.2604.5.1.3.15.0',
    sfosDatabaseService: '1.3.6.1.4.1.2604.5.1.3.16.0',
    sfosNetworkService: '1.3.6.1.4.1.2604.5.1.3.17.0',
    sfosGarnerService: '1.3.6.1.4.1.2604.5.1.3.18.0',
    sfosDroutdService: '1.3.6.1.4.1.2604.5.1.3.19.0',
    sfosSSHdService: '1.3.6.1.4.1.2604.5.1.3.20.0',
    sfosDGDService: '1.3.6.1.4.1.2604.5.1.3.21.0',
  },
} as const;

// Service status value mappings
export const SOPHOS_SERVICE_STATUS: Record<number, string> = {
  1: 'untouched',
  2: 'stopped',
  3: 'initializing',
  4: 'running',
  5: 'exiting',
};

// Storage type OIDs for hrStorageType (to distinguish RAM vs disk)
export const HR_STORAGE_TYPES = {
  hrStorageRam: '1.3.6.1.2.1.25.2.1.2',
  hrStorageVirtualMemory: '1.3.6.1.2.1.25.2.1.3',
  hrStorageFixedDisk: '1.3.6.1.2.1.25.2.1.4',
} as const;

// Interface operational status values
export const IF_OPER_STATUS: Record<number, string> = {
  1: 'up',
  2: 'down',
  3: 'testing',
  4: 'unknown',
  5: 'dormant',
  6: 'notPresent',
  7: 'lowerLayerDown',
};

// Quick-access lists for batch polling
export const SYSTEM_SCALAR_OIDS = [
  SOPHOS_OIDS.system.sysDescr,
  SOPHOS_OIDS.system.sysName,
  SOPHOS_OIDS.system.sysUpTime,
  SOPHOS_OIDS.system.sysLocation,
  SOPHOS_OIDS.system.sysContact,
  SOPHOS_OIDS.interfaces.ifNumber,
];

export const SOPHOS_SCALAR_OIDS = [
  SOPHOS_OIDS.sophos.sfosDeviceName,
  SOPHOS_OIDS.sophos.sfosDeviceType,
  SOPHOS_OIDS.sophos.sfosDeviceFWVersion,
  SOPHOS_OIDS.sophos.sfosLiveUsersCount,
  SOPHOS_OIDS.sophos.sfosHTTPHits,
];

export const SOPHOS_SERVICE_OIDS = [
  SOPHOS_OIDS.sophos.sfosHTTPService,
  SOPHOS_OIDS.sophos.sfosAVService,
  SOPHOS_OIDS.sophos.sfosIPSService,
  SOPHOS_OIDS.sophos.sfosSSLVPNService,
  SOPHOS_OIDS.sophos.sfosIPSecVPNService,
  SOPHOS_OIDS.sophos.sfosDNSService,
  SOPHOS_OIDS.sophos.sfosNTPService,
];

// Walk base OIDs — these are table prefixes, not scalar
export const WALK_OIDS = {
  cpuLoad: SOPHOS_OIDS.hostResources.hrProcessorLoad,
  storageDescr: SOPHOS_OIDS.hostResources.hrStorageDescr,
  storageType: SOPHOS_OIDS.hostResources.hrStorageType,
  storageUnits: SOPHOS_OIDS.hostResources.hrStorageAllocationUnits,
  storageSize: SOPHOS_OIDS.hostResources.hrStorageSize,
  storageUsed: SOPHOS_OIDS.hostResources.hrStorageUsed,
  ifDescr: SOPHOS_OIDS.interfaces.ifDescr,
  ifOperStatus: SOPHOS_OIDS.interfaces.ifOperStatus,
  ifHCInOctets: SOPHOS_OIDS.interfaces.ifHCInOctets,
  ifHCOutOctets: SOPHOS_OIDS.interfaces.ifHCOutOctets,
  ifHighSpeed: SOPHOS_OIDS.interfaces.ifHighSpeed,
  ifName: SOPHOS_OIDS.interfaces.ifName,
  ifInErrors: SOPHOS_OIDS.interfaces.ifInErrors,
  ifOutErrors: SOPHOS_OIDS.interfaces.ifOutErrors,
};
