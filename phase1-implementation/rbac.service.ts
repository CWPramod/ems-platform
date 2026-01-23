// RBAC Service
// Role-Based Access Control service for permission management
// apps/api/src/rbac/rbac.service.ts

import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string;
  is_system_role: boolean;
  is_active: boolean;
}

interface Permission {
  id: number;
  name: string;
  resource: string;
  action: string;
  description: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  role_id: number;
  role?: Role;
}

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository('Role')
    private roleRepo: Repository<Role>,
    @InjectRepository('Permission')
    private permissionRepo: Repository<Permission>,
    @InjectRepository('RolePermission')
    private rolePermissionRepo: Repository<any>,
    @InjectRepository('User')
    private userRepo: Repository<User>,
  ) {}

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: number, permissionName: string): Promise<boolean> {
    // Get user with role
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user || !user.role_id) {
      return false;
    }

    // Check if role has permission
    const result = await this.rolePermissionRepo
      .createQueryBuilder('rp')
      .innerJoin('permissions', 'p', 'rp.permission_id = p.id')
      .where('rp.role_id = :roleId', { roleId: user.role_id })
      .andWhere('p.name = :permissionName', { permissionName })
      .getOne();

    return !!result;
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId: number, permissionNames: string[]): Promise<boolean> {
    for (const permission of permissionNames) {
      const hasPermission = await this.hasPermission(userId, permission);
      if (hasPermission) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user has all specified permissions
   */
  async hasAllPermissions(userId: number, permissionNames: string[]): Promise<boolean> {
    for (const permission of permissionNames) {
      const hasPermission = await this.hasPermission(userId, permission);
      if (!hasPermission) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: number): Promise<Permission[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user || !user.role_id) {
      return [];
    }

    const permissions = await this.permissionRepo
      .createQueryBuilder('p')
      .innerJoin('role_permissions', 'rp', 'p.id = rp.permission_id')
      .where('rp.role_id = :roleId', { roleId: user.role_id })
      .getMany();

    return permissions;
  }

  /**
   * Get user's role
   */
  async getUserRole(userId: number): Promise<Role | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    return user?.role || null;
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userId: number): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role?.name === 'admin';
  }

  /**
   * Check if user is regular user
   */
  async isUser(userId: number): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role?.name === 'user';
  }

  /**
   * Require permission (throws exception if not allowed)
   */
  async requirePermission(userId: number, permissionName: string): Promise<void> {
    const hasPermission = await this.hasPermission(userId, permissionName);
    
    if (!hasPermission) {
      throw new ForbiddenException(
        `You do not have permission to perform this action (${permissionName})`
      );
    }
  }

  /**
   * Require admin role (throws exception if not admin)
   */
  async requireAdmin(userId: number): Promise<void> {
    const isAdmin = await this.isAdmin(userId);
    
    if (!isAdmin) {
      throw new ForbiddenException('This action requires administrator privileges');
    }
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    return this.roleRepo.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({
      order: { resource: 'ASC', action: 'ASC' },
    });
  }

  /**
   * Get permissions for a role
   */
  async getRolePermissions(roleId: number): Promise<Permission[]> {
    const permissions = await this.permissionRepo
      .createQueryBuilder('p')
      .innerJoin('role_permissions', 'rp', 'p.id = rp.permission_id')
      .where('rp.role_id = :roleId', { roleId })
      .getMany();

    return permissions;
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId: number, roleId: number): Promise<void> {
    await this.userRepo.update(userId, { role_id: roleId });
  }

  /**
   * Get role by name
   */
  async getRoleByName(roleName: string): Promise<Role | null> {
    return this.roleRepo.findOne({
      where: { name: roleName },
    });
  }

  /**
   * Check resource-action permission
   */
  async canPerformAction(
    userId: number,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user || !user.role_id) {
      return false;
    }

    // Check if role has permission for this resource-action combination
    const result = await this.rolePermissionRepo
      .createQueryBuilder('rp')
      .innerJoin('permissions', 'p', 'rp.permission_id = p.id')
      .where('rp.role_id = :roleId', { roleId: user.role_id })
      .andWhere('p.resource = :resource', { resource })
      .andWhere('p.action = :action', { action })
      .getOne();

    return !!result;
  }

  /**
   * Get permissions grouped by resource
   */
  async getPermissionsGroupedByResource(): Promise<Record<string, Permission[]>> {
    const permissions = await this.getAllPermissions();
    
    const grouped: Record<string, Permission[]> = {};
    
    for (const permission of permissions) {
      if (!grouped[permission.resource]) {
        grouped[permission.resource] = [];
      }
      grouped[permission.resource].push(permission);
    }
    
    return grouped;
  }

  /**
   * Create custom permission check function for specific resources
   */
  createPermissionChecker(resource: string) {
    return {
      canCreate: (userId: number) => this.canPerformAction(userId, resource, 'create'),
      canRead: (userId: number) => this.canPerformAction(userId, resource, 'read'),
      canUpdate: (userId: number) => this.canPerformAction(userId, resource, 'update'),
      canDelete: (userId: number) => this.canPerformAction(userId, resource, 'delete'),
      canManage: (userId: number) => this.canPerformAction(userId, resource, 'manage'),
      canExecute: (userId: number) => this.canPerformAction(userId, resource, 'execute'),
    };
  }
}

// Permission checker helpers for common resources
export class PermissionCheckers {
  constructor(private rbacService: RbacService) {}

  get device() {
    return this.rbacService.createPermissionChecker('device');
  }

  get asset() {
    return this.rbacService.createPermissionChecker('asset');
  }

  get report() {
    return this.rbacService.createPermissionChecker('report');
  }

  get alert() {
    return this.rbacService.createPermissionChecker('alert');
  }

  get customer() {
    return this.rbacService.createPermissionChecker('customer');
  }

  get user() {
    return this.rbacService.createPermissionChecker('user');
  }

  get system() {
    return this.rbacService.createPermissionChecker('system');
  }

  get nms() {
    return this.rbacService.createPermissionChecker('nms');
  }
}

export { Role, Permission };
