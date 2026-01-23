// RBAC Decorators
// Custom decorators for permission-based route protection
// apps/api/src/rbac/decorators/rbac.decorators.ts

import { SetMetadata } from '@nestjs/common';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to specify required permissions for a route
 * Usage: @Permissions('device:create', 'device:update')
 */
export const Permissions = (...permissions: string[]) => 
  SetMetadata('permissions', permissions);

/**
 * Decorator to specify required role for a route
 * Usage: @Roles('admin', 'user')
 */
export const Roles = (...roles: string[]) => 
  SetMetadata('roles', roles);

/**
 * Decorator to mark route as admin-only
 * Usage: @AdminOnly()
 */
export const AdminOnly = () => SetMetadata('adminOnly', true);

/**
 * Decorator to get current user from request
 * Usage: @CurrentUser() user: User
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Decorator to get user ID from request
 * Usage: @UserId() userId: number
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.userId;
  },
);

/**
 * Decorator to get user role from request
 * Usage: @UserRole() role: string
 */
export const UserRole = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.role;
  },
);

/**
 * Decorator to mark route as public (no authentication required)
 * Usage: @Public()
 */
export const Public = () => SetMetadata('isPublic', true);

// Export all decorators
export {
  Permissions,
  Roles,
  AdminOnly,
  CurrentUser,
  UserId,
  UserRole,
  Public,
};
