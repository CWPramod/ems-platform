import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { createMockUser } from '../../test-utils/mock-entities.factory';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockAuthService: { findUserById: jest.Mock };
  let mockConfigService: { get: jest.Mock };

  beforeEach(() => {
    mockAuthService = { findUserById: jest.fn() };
    mockConfigService = { get: jest.fn().mockReturnValue('test-jwt-secret') };

    strategy = new JwtStrategy(mockConfigService as any, mockAuthService as any);
  });

  it('should return user payload when user exists', async () => {
    const user = createMockUser({ id: 5, username: 'john', email: 'john@test.com', roleId: 2 });
    mockAuthService.findUserById.mockResolvedValue(user);

    const result = await strategy.validate({
      userId: 5,
      username: 'john',
      email: 'john@test.com',
      roleId: 2,
    });

    expect(result).toEqual({
      userId: 5,
      username: 'john',
      email: 'john@test.com',
      roleId: 2,
    });
  });

  it('should throw UnauthorizedException when user not found', async () => {
    mockAuthService.findUserById.mockResolvedValue(null);

    await expect(
      strategy.validate({ userId: 999, username: 'ghost', email: '', roleId: 1 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should call authService.findUserById with correct userId', async () => {
    mockAuthService.findUserById.mockResolvedValue(createMockUser());

    await strategy.validate({ userId: 42, username: 'test', email: 'test@test.com', roleId: 1 });

    expect(mockAuthService.findUserById).toHaveBeenCalledWith(42);
  });
});
