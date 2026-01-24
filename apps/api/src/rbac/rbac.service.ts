// RBAC Service (Fixed)
// Handles role-based access control and permission checking
// apps/api/src/rbac/rbac.service.ts

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class RbacService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: number, permissionName: string): Promise<boolean> {
    const result = await this.dataSource.query(
      'SELECT user_has_permission($1, $2) as has_permission',
      [userId, permissionName]
    );
    
    return result[0]?.has_permission || false;
  }

  /**
   * Check if user has ANY of the specified permissions
   */
  async hasAnyPermission(userId: number, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      const hasPermission = await this.hasPermission(userId, permission);
      if (hasPermission) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user has ALL of the specified permissions
   */
  async hasAllPermissions(userId: number, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
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
  async getUserPermissions(userId: number): Promise<string[]> {
    const result = await this.dataSource.query(
      'SELECT * FROM get_user_permissions($1)',
      [userId]
    );
    
    return result.map((r: any) => r.permission_name);
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userId: number): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT r.name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
      [userId]
    );
    
    return result[0]?.name === 'admin';
  }

  /**
   * Get user role
   */
  async getUserRole(userId: number): Promise<string | null> {
    const result = await this.dataSource.query(
      `SELECT r.name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
      [userId]
    );
    
    return result[0]?.name || null;
  }

  /**
   * Check resource-action permission
   */
  async canAccess(userId: number, resource: string, action: string): Promise<boolean> {
    const permissionName = `${resource}:${action}`;
    return this.hasPermission(userId, permissionName);
  }
}
