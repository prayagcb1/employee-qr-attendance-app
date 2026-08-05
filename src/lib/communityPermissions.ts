export type CommunityRole = 'estate_manager' | 'mc_member' | 'caas_supervisor' | 'account_manager';

export type CommunityTab = 'daily-monitoring' | 'batches' | 'analytics' | 'inventory' | 'community-config' | 'reports';

export interface PermissionConfig {
  tabs: CommunityTab[];
  canEdit: boolean;
  canDelete: boolean;
  canManageInventory: boolean;
  canManageBatches: boolean;
  canManageCommunityConfig: boolean;
  canManageMaintenance: boolean;
}

export const COMMUNITY_ROLE_PERMISSIONS: Record<CommunityRole, PermissionConfig> = {
  estate_manager: {
    tabs: ['daily-monitoring', 'batches', 'analytics', 'inventory'],
    canEdit: false,
    canDelete: false,
    canManageInventory: false,
    canManageBatches: false,
    canManageCommunityConfig: false,
    canManageMaintenance: false,
  },
  mc_member: {
    tabs: ['analytics', 'batches', 'reports'],
    canEdit: false,
    canDelete: false,
    canManageInventory: false,
    canManageBatches: false,
    canManageCommunityConfig: false,
    canManageMaintenance: false,
  },
  caas_supervisor: {
    tabs: ['daily-monitoring', 'batches', 'analytics', 'inventory'],
    canEdit: true,
    canDelete: false,
    canManageInventory: true,
    canManageBatches: true,
    canManageCommunityConfig: false,
    canManageMaintenance: true,
  },
  account_manager: {
    tabs: ['daily-monitoring', 'batches', 'analytics', 'inventory', 'community-config', 'reports'],
    canEdit: true,
    canDelete: false,
    canManageInventory: true,
    canManageBatches: true,
    canManageCommunityConfig: true,
    canManageMaintenance: true,
  },
};

export const COMMUNITY_ROLE_LABELS: Record<CommunityRole, string> = {
  estate_manager: 'Estate Manager',
  mc_member: 'MC Member',
  caas_supervisor: 'CAAS Supervisor',
  account_manager: 'Account Manager',
};
