export function createMockAuthService() {
  return {
    validateUser: jest.fn(),
    generateToken: jest.fn(),
    resetFailedAttempts: jest.fn(),
    updatePassword: jest.fn(),
    verifyCurrentPassword: jest.fn(),
    logLoginAttempt: jest.fn(),
    findUserById: jest.fn(),
    findUserByUsername: jest.fn(),
  };
}

export function createMockSessionManagerService() {
  return {
    createSession: jest.fn(),
    validateSession: jest.fn(),
    invalidateSession: jest.fn(),
    updateSessionActivity: jest.fn(),
    getUserSessions: jest.fn(),
    invalidateAllUserSessions: jest.fn(),
    getSessionConfig: jest.fn().mockReturnValue({ timeoutMinutes: 30, warningBeforeTimeoutMinutes: 5 }),
    cleanupExpiredSessions: jest.fn(),
  };
}

export function createMockPasswordPolicyService() {
  return {
    validatePassword: jest.fn(),
    checkPasswordStrength: jest.fn(),
    hashPassword: jest.fn(),
    comparePassword: jest.fn(),
    isPasswordRecentlyUsed: jest.fn(),
    getPasswordPolicy: jest.fn().mockReturnValue({
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      passwordHistoryCount: 5,
    }),
  };
}

export function createMockMLIntegrationService() {
  return {
    isMLServiceAvailable: jest.fn().mockResolvedValue(false),
    calculateBusinessImpact: jest.fn(),
    detectAnomaly: jest.fn(),
    analyzeRootCause: jest.fn(),
  };
}

export function createMockLicenseKeyService() {
  return {
    generateKey: jest.fn().mockReturnValue('CANARIS-SUB-EMS-20261231-payload-signature'),
    validateKeySignature: jest.fn().mockReturnValue(true),
    decodeKeyPayload: jest.fn().mockReturnValue({
      type: 'SUB',
      tier: 'EMS',
      maxDevices: 1000,
      expiresDate: '20261231',
    }),
  };
}

export function createMockLicenseValidationService() {
  return {
    validate: jest.fn().mockResolvedValue({
      valid: true,
      license: null,
      status: 'active',
      tier: 'ems_full',
      message: 'License active',
      daysRemaining: 365,
      deviceCount: 10,
      maxDevices: 1000,
      deviceLimitReached: false,
      enabledFeatures: ['monitoring', 'alerts'],
      warnings: [],
    }),
    clearCache: jest.fn(),
    isFeatureAllowed: jest.fn().mockResolvedValue(true),
    canAddDevice: jest.fn().mockResolvedValue(true),
  };
}

export function createMockConfigService(overrides: Record<string, any> = {}) {
  const defaults: Record<string, any> = {
    JWT_SECRET: 'test-jwt-secret',
    LICENSE_SIGNING_SECRET: 'test-license-secret',
    DATABASE_PASSWORD: 'test-db-password',
    NODE_ENV: 'test',
  };
  const merged = { ...defaults, ...overrides };
  return {
    get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
      return merged[key] !== undefined ? merged[key] : defaultValue;
    }),
  };
}
