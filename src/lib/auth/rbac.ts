/**
 * RBAC (Role-Based Access Control) System
 * Manages roles, permissions, and access control
 */

import { supabase } from '../supabase';

/**
 * Permission Categories
 */
export enum PermissionCategory {
  PROSPECTS = 'prospects',
  ACTIVITIES = 'activities',
  SEQUENCES = 'sequences',
  TEMPLATES = 'templates',
  ANALYTICS = 'analytics',
  TEAM = 'team',
  SETTINGS = 'settings',
  BILLING = 'billing',
  INTEGRATIONS = 'integrations',
  API = 'api',
}

/**
 * Permission Actions
 */
export enum PermissionAction {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
  MANAGE = 'manage',
  EXPORT = 'export',
  IMPORT = 'import',
}

/**
 * Predefined Permissions (50+ granular permissions)
 */
export const PERMISSIONS = {
  // Prospect Management
  PROSPECTS_VIEW_OWN: 'prospects:view:own',
  PROSPECTS_VIEW_TEAM: 'prospects:view:team',
  PROSPECTS_VIEW_ALL: 'prospects:view:all',
  PROSPECTS_CREATE: 'prospects:create',
  PROSPECTS_EDIT_OWN: 'prospects:edit:own',
  PROSPECTS_EDIT_TEAM: 'prospects:edit:team',
  PROSPECTS_EDIT_ALL: 'prospects:edit:all',
  PROSPECTS_DELETE_OWN: 'prospects:delete:own',
  PROSPECTS_DELETE_TEAM: 'prospects:delete:team',
  PROSPECTS_DELETE_ALL: 'prospects:delete:all',
  PROSPECTS_EXPORT: 'prospects:export',
  PROSPECTS_IMPORT: 'prospects:import',
  PROSPECTS_ASSIGN: 'prospects:assign',

  // Activity Management
  ACTIVITIES_VIEW_OWN: 'activities:view:own',
  ACTIVITIES_VIEW_TEAM: 'activities:view:team',
  ACTIVITIES_VIEW_ALL: 'activities:view:all',
  ACTIVITIES_CREATE: 'activities:create',
  ACTIVITIES_EDIT_OWN: 'activities:edit:own',
  ACTIVITIES_EDIT_TEAM: 'activities:edit:team',
  ACTIVITIES_DELETE_OWN: 'activities:delete:own',
  ACTIVITIES_DELETE_TEAM: 'activities:delete:team',

  // Sequence Management
  SEQUENCES_VIEW: 'sequences:view',
  SEQUENCES_CREATE: 'sequences:create',
  SEQUENCES_EDIT: 'sequences:edit',
  SEQUENCES_DELETE: 'sequences:delete',
  SEQUENCES_ENROLL: 'sequences:enroll',
  SEQUENCES_PAUSE: 'sequences:pause',

  // Template Management
  TEMPLATES_VIEW: 'templates:view',
  TEMPLATES_CREATE: 'templates:create',
  TEMPLATES_EDIT: 'templates:edit',
  TEMPLATES_DELETE: 'templates:delete',
  TEMPLATES_SHARE: 'templates:share',

  // Analytics & Reporting
  ANALYTICS_VIEW_OWN: 'analytics:view:own',
  ANALYTICS_VIEW_TEAM: 'analytics:view:team',
  ANALYTICS_VIEW_ALL: 'analytics:view:all',
  ANALYTICS_EXPORT: 'analytics:export',
  ANALYTICS_CUSTOM_REPORTS: 'analytics:custom_reports',

  // Team Management
  TEAM_VIEW: 'team:view',
  TEAM_INVITE: 'team:invite',
  TEAM_EDIT: 'team:edit',
  TEAM_REMOVE: 'team:remove',
  TEAM_MANAGE_ROLES: 'team:manage_roles',
  TEAM_VIEW_PERFORMANCE: 'team:view_performance',

  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT_PROFILE: 'settings:edit:profile',
  SETTINGS_EDIT_ORG: 'settings:edit:org',
  SETTINGS_EDIT_SECURITY: 'settings:edit:security',
  SETTINGS_MANAGE_SSO: 'settings:manage:sso',

  // Billing
  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',

  // Integrations
  INTEGRATIONS_VIEW: 'integrations:view',
  INTEGRATIONS_MANAGE: 'integrations:manage',
  INTEGRATIONS_CRM: 'integrations:crm',

  // API Access
  API_READ: 'api:read',
  API_WRITE: 'api:write',
  API_MANAGE_KEYS: 'api:manage_keys',
  WEBHOOKS_MANAGE: 'webhooks:manage',

  // Admin
  ADMIN_FULL_ACCESS: 'admin:full_access',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Predefined Roles
 */
export enum RoleType {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  REP = 'rep',
  READ_ONLY = 'read_only',
  CUSTOM = 'custom',
}

export interface Role {
  id: string;
  organizationId: string;
  name: string;
  type: RoleType;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: string;
  assignedBy: string;
}

/**
 * Default Role Permissions
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleType, Permission[]> = {
  [RoleType.SUPER_ADMIN]: [PERMISSIONS.ADMIN_FULL_ACCESS],

  [RoleType.ADMIN]: [
    // Prospects
    PERMISSIONS.PROSPECTS_VIEW_ALL,
    PERMISSIONS.PROSPECTS_CREATE,
    PERMISSIONS.PROSPECTS_EDIT_ALL,
    PERMISSIONS.PROSPECTS_DELETE_ALL,
    PERMISSIONS.PROSPECTS_EXPORT,
    PERMISSIONS.PROSPECTS_IMPORT,
    PERMISSIONS.PROSPECTS_ASSIGN,

    // Activities
    PERMISSIONS.ACTIVITIES_VIEW_ALL,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_EDIT_TEAM,
    PERMISSIONS.ACTIVITIES_DELETE_TEAM,

    // Sequences
    PERMISSIONS.SEQUENCES_VIEW,
    PERMISSIONS.SEQUENCES_CREATE,
    PERMISSIONS.SEQUENCES_EDIT,
    PERMISSIONS.SEQUENCES_DELETE,
    PERMISSIONS.SEQUENCES_ENROLL,
    PERMISSIONS.SEQUENCES_PAUSE,

    // Templates
    PERMISSIONS.TEMPLATES_VIEW,
    PERMISSIONS.TEMPLATES_CREATE,
    PERMISSIONS.TEMPLATES_EDIT,
    PERMISSIONS.TEMPLATES_DELETE,
    PERMISSIONS.TEMPLATES_SHARE,

    // Analytics
    PERMISSIONS.ANALYTICS_VIEW_ALL,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.ANALYTICS_CUSTOM_REPORTS,

    // Team
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_INVITE,
    PERMISSIONS.TEAM_EDIT,
    PERMISSIONS.TEAM_REMOVE,
    PERMISSIONS.TEAM_MANAGE_ROLES,
    PERMISSIONS.TEAM_VIEW_PERFORMANCE,

    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT_ORG,
    PERMISSIONS.SETTINGS_EDIT_SECURITY,
    PERMISSIONS.SETTINGS_MANAGE_SSO,

    // Billing
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_MANAGE,

    // Integrations
    PERMISSIONS.INTEGRATIONS_VIEW,
    PERMISSIONS.INTEGRATIONS_MANAGE,
    PERMISSIONS.INTEGRATIONS_CRM,

    // API
    PERMISSIONS.API_READ,
    PERMISSIONS.API_WRITE,
    PERMISSIONS.API_MANAGE_KEYS,
    PERMISSIONS.WEBHOOKS_MANAGE,
  ],

  [RoleType.MANAGER]: [
    // Prospects
    PERMISSIONS.PROSPECTS_VIEW_TEAM,
    PERMISSIONS.PROSPECTS_CREATE,
    PERMISSIONS.PROSPECTS_EDIT_TEAM,
    PERMISSIONS.PROSPECTS_EXPORT,
    PERMISSIONS.PROSPECTS_ASSIGN,

    // Activities
    PERMISSIONS.ACTIVITIES_VIEW_TEAM,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_EDIT_TEAM,

    // Sequences
    PERMISSIONS.SEQUENCES_VIEW,
    PERMISSIONS.SEQUENCES_CREATE,
    PERMISSIONS.SEQUENCES_EDIT,
    PERMISSIONS.SEQUENCES_ENROLL,
    PERMISSIONS.SEQUENCES_PAUSE,

    // Templates
    PERMISSIONS.TEMPLATES_VIEW,
    PERMISSIONS.TEMPLATES_CREATE,
    PERMISSIONS.TEMPLATES_EDIT,
    PERMISSIONS.TEMPLATES_SHARE,

    // Analytics
    PERMISSIONS.ANALYTICS_VIEW_TEAM,
    PERMISSIONS.ANALYTICS_EXPORT,

    // Team
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_VIEW_PERFORMANCE,

    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT_PROFILE,

    // Integrations
    PERMISSIONS.INTEGRATIONS_VIEW,

    // API
    PERMISSIONS.API_READ,
  ],

  [RoleType.REP]: [
    // Prospects
    PERMISSIONS.PROSPECTS_VIEW_OWN,
    PERMISSIONS.PROSPECTS_CREATE,
    PERMISSIONS.PROSPECTS_EDIT_OWN,
    PERMISSIONS.PROSPECTS_EXPORT,

    // Activities
    PERMISSIONS.ACTIVITIES_VIEW_OWN,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_EDIT_OWN,
    PERMISSIONS.ACTIVITIES_DELETE_OWN,

    // Sequences
    PERMISSIONS.SEQUENCES_VIEW,
    PERMISSIONS.SEQUENCES_ENROLL,
    PERMISSIONS.SEQUENCES_PAUSE,

    // Templates
    PERMISSIONS.TEMPLATES_VIEW,
    PERMISSIONS.TEMPLATES_CREATE,

    // Analytics
    PERMISSIONS.ANALYTICS_VIEW_OWN,

    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT_PROFILE,

    // Integrations
    PERMISSIONS.INTEGRATIONS_VIEW,
  ],

  [RoleType.READ_ONLY]: [
    // Prospects
    PERMISSIONS.PROSPECTS_VIEW_ALL,

    // Activities
    PERMISSIONS.ACTIVITIES_VIEW_ALL,

    // Sequences
    PERMISSIONS.SEQUENCES_VIEW,

    // Templates
    PERMISSIONS.TEMPLATES_VIEW,

    // Analytics
    PERMISSIONS.ANALYTICS_VIEW_ALL,
    PERMISSIONS.ANALYTICS_EXPORT,

    // Team
    PERMISSIONS.TEAM_VIEW,

    // Settings
    PERMISSIONS.SETTINGS_VIEW,
  ],

  [RoleType.CUSTOM]: [],
};

/**
 * RBAC Manager
 */
export class RBACManager {
  /**
   * Check if user has specific permission
   */
  async hasPermission(userId: string, permission: Permission): Promise<boolean> {
    // Super admin always has all permissions
    if (await this.isSuperAdmin(userId)) {
      return true;
    }

    // Admin full access check
    if (await this.hasAdminFullAccess(userId)) {
      return true;
    }

    // Get user's roles
    const roles = await this.getUserRoles(userId);

    // Check if any role has the permission
    for (const role of roles) {
      if (role.permissions.includes(permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, permission)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user has all of the specified permissions
   */
  async hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission(userId, permission))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all permissions for user
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const roles = await this.getUserRoles(userId);
    const permissions = new Set<Permission>();

    // If super admin, return all permissions
    if (await this.isSuperAdmin(userId)) {
      return Object.values(PERMISSIONS);
    }

    // Aggregate permissions from all roles
    for (const role of roles) {
      // If role has admin full access, return all permissions
      if (role.permissions.includes(PERMISSIONS.ADMIN_FULL_ACCESS)) {
        return Object.values(PERMISSIONS);
      }

      role.permissions.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Get user's roles
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId);

    if (!userRoles || userRoles.length === 0) {
      return [];
    }

    const roleIds = userRoles.map(ur => ur.role_id);

    const { data: roles } = await supabase
      .from('roles')
      .select('*')
      .in('id', roleIds);

    if (!roles) {
      return [];
    }

    return roles.map(r => this.mapDatabaseToRole(r));
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string, assignedBy: string): Promise<void> {
    const { error } = await supabase.from('user_roles').insert({
      user_id: userId,
      role_id: roleId,
      assigned_by: assignedBy,
      assigned_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to assign role: ${error.message}`);
    }

    // Log role assignment
    await this.logRoleChange({
      userId,
      roleId,
      action: 'role_assigned',
      performedBy: assignedBy,
    });
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, roleId: string, removedBy: string): Promise<void> {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId);

    if (error) {
      throw new Error(`Failed to remove role: ${error.message}`);
    }

    // Log role removal
    await this.logRoleChange({
      userId,
      roleId,
      action: 'role_removed',
      performedBy: removedBy,
    });
  }

  /**
   * Create custom role
   */
  async createRole(params: {
    organizationId: string;
    name: string;
    type: RoleType;
    description?: string;
    permissions: Permission[];
    createdBy: string;
  }): Promise<Role> {
    const { data, error } = await supabase
      .from('roles')
      .insert({
        organization_id: params.organizationId,
        name: params.name,
        type: params.type,
        description: params.description,
        permissions: params.permissions,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create role: ${error.message}`);
    }

    // Log role creation
    await this.logRoleChange({
      roleId: data.id,
      action: 'role_created',
      performedBy: params.createdBy,
    });

    return this.mapDatabaseToRole(data);
  }

  /**
   * Update role
   */
  async updateRole(
    roleId: string,
    updates: {
      name?: string;
      description?: string;
      permissions?: Permission[];
    },
    updatedBy: string
  ): Promise<Role> {
    const { data, error } = await supabase
      .from('roles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roleId)
      .eq('is_system', false) // Can't update system roles
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update role: ${error.message}`);
    }

    // Log role update
    await this.logRoleChange({
      roleId,
      action: 'role_updated',
      performedBy: updatedBy,
    });

    return this.mapDatabaseToRole(data);
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string, deletedBy: string): Promise<void> {
    // Can't delete system roles
    const { data: role } = await supabase
      .from('roles')
      .select('is_system')
      .eq('id', roleId)
      .single();

    if (role?.is_system) {
      throw new Error('Cannot delete system role');
    }

    // Delete role
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId);

    if (error) {
      throw new Error(`Failed to delete role: ${error.message}`);
    }

    // Log role deletion
    await this.logRoleChange({
      roleId,
      action: 'role_deleted',
      performedBy: deletedBy,
    });
  }

  /**
   * Get all roles for organization
   */
  async getOrganizationRoles(organizationId: string): Promise<Role[]> {
    const { data: roles } = await supabase
      .from('roles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (!roles) {
      return [];
    }

    return roles.map(r => this.mapDatabaseToRole(r));
  }

  /**
   * Initialize default roles for organization
   */
  async initializeDefaultRoles(organizationId: string): Promise<void> {
    const defaultRoles: Array<{
      name: string;
      type: RoleType;
      description: string;
      permissions: Permission[];
    }> = [
      {
        name: 'Super Admin',
        type: RoleType.SUPER_ADMIN,
        description: 'Full access to all features and settings',
        permissions: DEFAULT_ROLE_PERMISSIONS[RoleType.SUPER_ADMIN],
      },
      {
        name: 'Admin',
        type: RoleType.ADMIN,
        description: 'Manage organization settings, team, and all data',
        permissions: DEFAULT_ROLE_PERMISSIONS[RoleType.ADMIN],
      },
      {
        name: 'Manager',
        type: RoleType.MANAGER,
        description: 'View team performance and manage team members',
        permissions: DEFAULT_ROLE_PERMISSIONS[RoleType.MANAGER],
      },
      {
        name: 'Rep',
        type: RoleType.REP,
        description: 'Standard sales rep with access to own data',
        permissions: DEFAULT_ROLE_PERMISSIONS[RoleType.REP],
      },
      {
        name: 'Read Only',
        type: RoleType.READ_ONLY,
        description: 'View-only access for reporting purposes',
        permissions: DEFAULT_ROLE_PERMISSIONS[RoleType.READ_ONLY],
      },
    ];

    for (const role of defaultRoles) {
      await supabase.from('roles').insert({
        organization_id: organizationId,
        name: role.name,
        type: role.type,
        description: role.description,
        permissions: role.permissions,
        is_system: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Private helper methods

  private async isSuperAdmin(userId: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.some(role => role.type === RoleType.SUPER_ADMIN);
  }

  private async hasAdminFullAccess(userId: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.some(role => role.permissions.includes(PERMISSIONS.ADMIN_FULL_ACCESS));
  }

  private mapDatabaseToRole(data: any): Role {
    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      type: data.type,
      description: data.description,
      permissions: data.permissions,
      isSystem: data.is_system,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private async logRoleChange(params: {
    userId?: string;
    roleId?: string;
    action: string;
    performedBy: string;
  }): Promise<void> {
    await supabase.from('rbac_audit_log').insert({
      user_id: params.userId,
      role_id: params.roleId,
      action: params.action,
      performed_by: params.performedBy,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Create RBAC manager instance
 */
export function createRBACManager(): RBACManager {
  return new RBACManager();
}

/**
 * Permission middleware helper
 */
export async function requirePermission(userId: string, permission: Permission): Promise<void> {
  const rbac = createRBACManager();
  const hasPermission = await rbac.hasPermission(userId, permission);

  if (!hasPermission) {
    throw new Error('Insufficient permissions');
  }
}

/**
 * Permission check helper
 */
export async function checkPermission(userId: string, permission: Permission): Promise<boolean> {
  const rbac = createRBACManager();
  return rbac.hasPermission(userId, permission);
}
