export const CRM_ROLES = [
  'owner',
  'admin',
  'manager',
  'sales',
  'dispatcher',
  'crew',
  'viewer',
] as const

export type CrmRole = typeof CRM_ROLES[number]

export const PERMISSIONS = [
  'all',
  'lead:read',
  'lead:create',
  'lead:update',
  'lead:read_assigned',
  'lead:update_assigned',
  'contact:read',
  'contact:create',
  'contact:update',
  'contact:read_assigned',
  'estimate:read',
  'estimate:create',
  'estimate:update',
  'estimate:read_assigned',
  'job:read',
  'job:update',
  'job:read_assigned',
  'job:update_assigned_limited',
  'crew:read',
  'crew:update',
  'dispatch:manage',
  'user:read',
  'read_only',
] as const

export type Permission = typeof PERMISSIONS[number]

const ROLE_PERMISSIONS: Record<CrmRole, Permission[]> = {
  owner: ['all'],
  admin: ['all'],
  manager: [
    'lead:read',
    'lead:create',
    'lead:update',
    'contact:read',
    'contact:create',
    'contact:update',
    'estimate:read',
    'estimate:create',
    'estimate:update',
    'job:read',
    'job:update',
    'user:read',
  ],
  sales: [
    'lead:read_assigned',
    'lead:create',
    'lead:update_assigned',
    'contact:read_assigned',
    'contact:create',
    'estimate:read_assigned',
    'estimate:create',
  ],
  dispatcher: [
    'job:read',
    'job:update',
    'crew:read',
    'crew:update',
    'dispatch:manage',
  ],
  crew: [
    'job:read_assigned',
    'job:update_assigned_limited',
  ],
  viewer: ['read_only'],
}

const LEGACY_ROLE_MAP: Record<string, CrmRole> = {
  admin: 'admin',
  sales_manager: 'manager',
  ops_manager: 'manager',
  accountant: 'manager',
  senior_sales: 'sales',
  junior_sales: 'sales',
  dispatcher: 'dispatcher',
}

export function normalizeRole(role: string | null | undefined): CrmRole {
  if (!role) return 'viewer'
  if ((CRM_ROLES as readonly string[]).includes(role)) return role as CrmRole
  return LEGACY_ROLE_MAP[role] ?? 'viewer'
}

export function hasPermission(userRole: string | null | undefined, permission: Permission) {
  const role = normalizeRole(userRole)
  const permissions = ROLE_PERMISSIONS[role]
  return permissions.includes('all') || permissions.includes(permission)
}

export function requirePermission(userRole: string | null | undefined, permission: Permission) {
  if (!hasPermission(userRole, permission)) {
    throw new Error(`Missing permission: ${permission}`)
  }
}

export function isAdminRole(userRole: string | null | undefined) {
  const role = normalizeRole(userRole)
  return role === 'owner' || role === 'admin'
}

export function isActiveUser(profile: { is_active?: boolean | null } | null | undefined) {
  return Boolean(profile?.is_active)
}
