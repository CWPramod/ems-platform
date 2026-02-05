import { User } from '../entities/user.entity';
import { Alert, AlertStatus } from '../entities/alert.entity';
import { Event, EventSource, EventSeverity } from '../entities/event.entity';
import { Asset, AssetType, AssetStatus, ServiceTier } from '../entities/asset.entity';
import { License, LicenseType, LicenseTier, LicenseStatus } from '../entities/license.entity';
import { DeviceHealth } from '../entities/device-health.entity';

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password: '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    roleId: 1,
    role: { id: 1, name: 'admin', description: 'Admin role', permissions: {}, createdAt: new Date(), updatedAt: new Date() } as any,
    passwordChangedAt: new Date(),
    failedLoginAttempts: 0,
    accountLockedUntil: null,
    lastActivity: new Date(),
    lastLogin: new Date(),
    forcePasswordChange: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 1,
    updatedBy: 1,
    ...overrides,
  } as User;
}

export function createMockAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-uuid-1',
    eventId: 'event-uuid-1',
    status: AlertStatus.OPEN,
    owner: undefined,
    team: undefined,
    rootCauseAssetId: 'asset-uuid-1',
    businessImpactScore: 0,
    slaBreached: false,
    slaDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Alert;
}

export function createMockEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-uuid-1',
    fingerprint: 'fp-test-001',
    source: EventSource.NMS,
    assetId: 'asset-uuid-1',
    severity: EventSeverity.WARNING,
    category: 'performance',
    title: 'Test Event',
    message: 'Test event message',
    metadata: {},
    timestamp: new Date(),
    firstOccurrence: new Date(),
    lastOccurrence: new Date(),
    occurrenceCount: 1,
    createdAt: new Date(),
    ...overrides,
  } as Event;
}

export function createMockAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-uuid-1',
    name: 'Test Router',
    type: AssetType.ROUTER,
    ip: '192.168.1.1',
    location: 'Server Room A',
    vendor: 'Cisco',
    tags: ['test'],
    tier: ServiceTier.CRITICAL,
    owner: 'admin',
    status: AssetStatus.ONLINE,
    monitoringEnabled: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Asset;
}

export function createMockLicense(overrides: Partial<License> = {}): License {
  const now = new Date();
  return {
    id: 'license-uuid-1',
    licenseKey: 'CANARIS-SUB-EMS-20261231-payload-signature',
    type: LicenseType.SUBSCRIPTION,
    tier: LicenseTier.EMS_FULL,
    status: LicenseStatus.ACTIVE,
    organizationName: 'Test Org',
    maxDeviceCount: 1000,
    startsAt: now,
    expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    gracePeriodDays: 7,
    activatedAt: now,
    lastValidatedAt: now,
    metadata: {},
    enabledFeatures: ['monitoring', 'alerts', 'topology', 'reports', 'metrics', 'network'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as License;
}

export function createMockDeviceHealth(overrides: Partial<DeviceHealth> = {}): DeviceHealth {
  return {
    id: 1,
    assetId: 'asset-uuid-1',
    status: 'online',
    healthScore: 85,
    isCritical: false,
    lastSeen: new Date(),
    responseTimeMs: 12,
    cpuUtilization: 35,
    memoryUtilization: 42,
    diskUtilization: 55,
    bandwidthInMbps: 100,
    bandwidthOutMbps: 50,
    packetLossPercent: 0.01,
    latencyMs: 5,
    totalInterfaces: 4,
    interfacesUp: 4,
    interfacesDown: 0,
    activeAlertsCount: 0,
    criticalAlertsCount: 0,
    warningAlertsCount: 0,
    uptimePercent24h: 99.99,
    uptimePercent7d: 99.95,
    uptimePercent30d: 99.90,
    slaCompliance: true,
    slaTargetPercent: 99.9,
    lastHealthCheck: new Date(),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as DeviceHealth;
}
