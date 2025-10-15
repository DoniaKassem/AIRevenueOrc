import { supabase } from './supabase';

export type Permission =
  | 'users:manage'
  | 'users:view'
  | 'settings:manage'
  | 'integrations:manage'
  | 'integrations:view'
  | 'analytics:view'
  | 'audit:view'
  | 'prospects:manage'
  | 'prospects:view'
  | 'prospects:create'
  | 'deals:manage'
  | 'deals:view'
  | 'deals:create'
  | 'team:view'
  | 'team:manage'
  | 'cadences:manage'
  | 'cadences:execute'
  | 'activities:manage'
  | 'activities:view'
  | 'all';

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  permissions: Permission[];
  is_system_role: boolean;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  role_name: string;
  permissions: Permission[];
}

let cachedPermissions: Permission[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export async function getUserPermissions(userId: string): Promise<Permission[]> {
  if (cachedPermissions && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedPermissions;
  }

  const { data: userRoles, error } = await supabase
    .from('user_roles')
    .select('role_id, roles(permissions)')
    .eq('user_id', userId);

  if (error || !userRoles) {
    console.error('Error fetching user permissions:', error);
    return [];
  }

  const allPermissions = new Set<Permission>();

  userRoles.forEach((userRole: any) => {
    const permissions = userRole.roles?.permissions || [];
    permissions.forEach((perm: Permission) => allPermissions.add(perm));
  });

  cachedPermissions = Array.from(allPermissions);
  cacheTimestamp = Date.now();

  return cachedPermissions;
}

export function clearPermissionCache(): void {
  cachedPermissions = null;
  cacheTimestamp = 0;
}

export async function hasPermission(
  userId: string,
  requiredPermission: Permission
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);

  if (permissions.includes('all')) {
    return true;
  }

  return permissions.includes(requiredPermission);
}

export async function hasAnyPermission(
  userId: string,
  requiredPermissions: Permission[]
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);

  if (permissions.includes('all')) {
    return true;
  }

  return requiredPermissions.some(perm => permissions.includes(perm));
}

export async function hasAllPermissions(
  userId: string,
  requiredPermissions: Permission[]
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);

  if (permissions.includes('all')) {
    return true;
  }

  return requiredPermissions.every(perm => permissions.includes(perm));
}

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, role_id, roles(name, permissions)')
    .eq('user_id', userId);

  if (error || !data) {
    return [];
  }

  return data.map((item: any) => ({
    user_id: item.user_id,
    role_id: item.role_id,
    role_name: item.roles.name,
    permissions: item.roles.permissions,
  }));
}

export async function assignRole(
  userId: string,
  roleId: string,
  assignedBy?: string
): Promise<void> {
  const { error } = await supabase.from('user_roles').insert({
    user_id: userId,
    role_id: roleId,
    assigned_by: assignedBy,
  });

  if (error) {
    throw new Error(`Failed to assign role: ${error.message}`);
  }

  clearPermissionCache();
}

export async function removeRole(userId: string, roleId: string): Promise<void> {
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', roleId);

  if (error) {
    throw new Error(`Failed to remove role: ${error.message}`);
  }

  clearPermissionCache();
}

export async function createCustomRole(
  organizationId: string,
  name: string,
  description: string,
  permissions: Permission[]
): Promise<Role> {
  const { data, error } = await supabase
    .from('roles')
    .insert({
      organization_id: organizationId,
      name,
      description,
      permissions,
      is_system_role: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create role: ${error.message}`);
  }

  return data;
}

export async function updateRole(
  roleId: string,
  updates: Partial<{
    name: string;
    description: string;
    permissions: Permission[];
  }>
): Promise<void> {
  const { error } = await supabase
    .from('roles')
    .update(updates)
    .eq('id', roleId)
    .eq('is_system_role', false);

  if (error) {
    throw new Error(`Failed to update role: ${error.message}`);
  }

  clearPermissionCache();
}

export async function deleteRole(roleId: string): Promise<void> {
  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', roleId)
    .eq('is_system_role', false);

  if (error) {
    throw new Error(`Failed to delete role: ${error.message}`);
  }

  clearPermissionCache();
}

export async function getOrganizationRoles(
  organizationId: string
): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch roles: ${error.message}`);
  }

  return data || [];
}

export function checkPermissionSync(
  userPermissions: Permission[],
  requiredPermission: Permission
): boolean {
  if (userPermissions.includes('all')) {
    return true;
  }

  return userPermissions.includes(requiredPermission);
}

export function checkAnyPermissionSync(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  if (userPermissions.includes('all')) {
    return true;
  }

  return requiredPermissions.some(perm => userPermissions.includes(perm));
}

export const PERMISSION_GROUPS = {
  user_management: ['users:view', 'users:manage'] as Permission[],
  settings: ['settings:manage'] as Permission[],
  integrations: ['integrations:view', 'integrations:manage'] as Permission[],
  analytics: ['analytics:view'] as Permission[],
  audit: ['audit:view'] as Permission[],
  prospects: ['prospects:view', 'prospects:create', 'prospects:manage'] as Permission[],
  deals: ['deals:view', 'deals:create', 'deals:manage'] as Permission[],
  team: ['team:view', 'team:manage'] as Permission[],
  cadences: ['cadences:execute', 'cadences:manage'] as Permission[],
  activities: ['activities:view', 'activities:manage'] as Permission[],
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'users:manage': 'Create, edit, and deactivate users',
  'users:view': 'View user profiles and information',
  'settings:manage': 'Modify organization settings',
  'integrations:manage': 'Connect and configure integrations',
  'integrations:view': 'View integration status and settings',
  'analytics:view': 'Access analytics and reports',
  'audit:view': 'View audit logs and compliance data',
  'prospects:manage': 'Full access to prospects (create, edit, delete)',
  'prospects:view': 'View prospect information',
  'prospects:create': 'Create new prospects',
  'deals:manage': 'Full access to deals (create, edit, delete, move stages)',
  'deals:view': 'View deal information',
  'deals:create': 'Create new deals',
  'team:view': 'View team members and their activities',
  'team:manage': 'Manage team members and assignments',
  'cadences:manage': 'Create and modify cadences',
  'cadences:execute': 'Execute cadence steps and workflows',
  'activities:manage': 'Log and edit activities',
  'activities:view': 'View activity history',
  all: 'Full system access (super admin)',
};

export function getPermissionsByGroup(group: keyof typeof PERMISSION_GROUPS): Permission[] {
  return PERMISSION_GROUPS[group] || [];
}

export async function getUsersWithPermission(
  organizationId: string,
  permission: Permission
): Promise<string[]> {
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, permissions')
    .eq('organization_id', organizationId);

  if (rolesError || !roles) {
    return [];
  }

  const roleIds = roles
    .filter(role =>
      role.permissions.includes(permission) || role.permissions.includes('all')
    )
    .map(role => role.id);

  if (roleIds.length === 0) {
    return [];
  }

  const { data: userRoles, error: userRolesError } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role_id', roleIds);

  if (userRolesError || !userRoles) {
    return [];
  }

  return [...new Set(userRoles.map(ur => ur.user_id))];
}

export function isAdminRole(permissions: Permission[]): boolean {
  return permissions.includes('all') || permissions.includes('users:manage');
}

export function canManageUser(
  currentUserPermissions: Permission[],
  targetUserPermissions: Permission[]
): boolean {
  if (!currentUserPermissions.includes('users:manage') && !currentUserPermissions.includes('all')) {
    return false;
  }

  if (targetUserPermissions.includes('all')) {
    return currentUserPermissions.includes('all');
  }

  return true;
}
