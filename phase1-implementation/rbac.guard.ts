// RBAC Guard
// Protects routes based on user permissions
// apps/api/src/rbac/guards/rbac.guard.ts

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../rbac.service';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from route metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Get user from request
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has ALL required permissions
    const hasPermissions = await this.rbacService.hasAllPermissions(
      user.userId,
      requiredPermissions,
    );

    if (!hasPermissions) {
      throw new ForbiddenException(
        `You do not have the required permissions: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}

// Alternative: RbacAnyGuard - requires ANY of the specified permissions
@Injectable()
export class RbacAnyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has ANY of the required permissions
    const hasPermission = await this.rbacService.hasAnyPermission(
      user.userId,
      requiredPermissions,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `You need at least one of these permissions: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}

// Admin-only guard
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private rbacService: RbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const isAdmin = await this.rbacService.isAdmin(user.userId);

    if (!isAdmin) {
      throw new ForbiddenException('This action requires administrator privileges');
    }

    return true;
  }
}

export { RbacGuard, RbacAnyGuard, AdminGuard };
