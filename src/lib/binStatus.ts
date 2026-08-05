export type BinStatus = 'available' | 'loaded' | 'composting' | 'harvesting' | 'maintenance' | 'completed' | 'blocked';

export const BIN_STATUSES: BinStatus[] = [
  'available',
  'loaded',
  'composting',
  'harvesting',
  'maintenance',
  'completed',
  'blocked',
];

export const BIN_STATUS_LABELS: Record<BinStatus, string> = {
  available: 'Available',
  loaded: 'Loaded',
  composting: 'Composting',
  harvesting: 'Harvesting',
  maintenance: 'Maintenance',
  completed: 'Completed',
  blocked: 'Blocked',
};

export const BIN_STATUS_COLORS: Record<BinStatus, { bg: string; text: string; border: string; dot: string; card: string }> = {
  available: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', dot: 'bg-gray-400', card: 'bg-gray-50 border-gray-300' },
  loaded: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-500', card: 'bg-blue-50 border-blue-300' },
  composting: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', dot: 'bg-yellow-500', card: 'bg-yellow-50 border-yellow-300' },
  harvesting: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', dot: 'bg-green-500', card: 'bg-green-50 border-green-300' },
  maintenance: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', dot: 'bg-orange-500', card: 'bg-orange-50 border-orange-300' },
  completed: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', dot: 'bg-purple-500', card: 'bg-purple-50 border-purple-300' },
  blocked: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', dot: 'bg-red-500', card: 'bg-red-50 border-red-300' },
};

export const MAINTENANCE_ISSUE_TYPES = [
  { value: 'broken_handle', label: 'Broken Handle' },
  { value: 'crack', label: 'Crack' },
  { value: 'lid_missing', label: 'Lid Missing' },
  { value: 'wheel_broken', label: 'Wheel Broken' },
  { value: 'qr_missing', label: 'QR Code Missing' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'other', label: 'Other' },
] as const;

export type MaintenanceIssueType = typeof MAINTENANCE_ISSUE_TYPES[number]['value'];

export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

export const MAINTENANCE_STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  in_progress: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
};
