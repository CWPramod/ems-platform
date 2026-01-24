// RBAC Decorators
// Decorators for annotating routes with permission requirements
// apps/api/src/rbac/decorators/rbac.decorators.ts

import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to specify required permissions for a route
 * @Permissions('device:read', 'device:update')
 */
export const Permissions = (...permissions: string[]) => SetMetadata('permissions', permissions);

/**
 * Decorator to specify required roles for a route
 * @Roles('admin', 'user')
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

/**
 * Decorator to mark a route as admin-only
 * @AdminOnly()
 */
export const AdminOnly = () => SetMetadata('adminOnly', true);

/**
 * Decorator to mark a route as public (no auth required)
 * @Public()
 */
export const Public = () => SetMetadata('isPublic', true);

/**
 * Decorator to get current user from request
 * @CurrentUser() user: User
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Decorator to get user ID from request
 * @UserId() userId: number
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.userId;
  },
);

/**
 * Decorator to get user role from request
 * @UserRole() role: string
 */
export const UserRole = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.role;
  },
);
