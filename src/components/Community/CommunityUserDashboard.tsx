import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COMMUNITY_ROLE_PERMISSIONS, COMMUNITY_ROLE_LABELS, type CommunityTab } from '../../lib/communityPermissions';
import { LogOut, BarChart3, ClipboardCheck, Layers, Boxes, Settings, FileText } from 'lucide-react';
import { CommunityDailyMonitoring } from './CommunityDailyMonitoring';
import { CommunityBatches } from './CommunityBatches';
import { CommunityAnalytics } from './CommunityAnalytics';
import { CommunityInventory } from './CommunityInventory';
import { CommunityConfig } from './CommunityConfig';
import { CommunityReports } from './CommunityReports';

export function CommunityUserDashboard() {
  const { communityUser, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<CommunityTab>('daily-monitoring');
  const [communityName, setCommunityName] = useState('');

  useEffect(() => {
    if (communityUser) {
      supabase.from('communities').select('name').eq('id', communityUser.community_id).maybeSingle()
        .then(({ data }) => {
          if (data) setCommunityName((data as { name: string }).name);
        });
    }
  }, [communityUser]);

  if (!communityUser) return null;

  const permissions = COMMUNITY_ROLE_PERMISSIONS[communityUser.role_type];
  const roleLabel = COMMUNITY_ROLE_LABELS[communityUser.role_type];

  const tabConfig: { id: CommunityTab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'daily-monitoring', label: 'Daily Monitoring', icon: ClipboardCheck },
    { id: 'batches', label: 'Batch Status', icon: Layers },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'community-config', label: 'Settings', icon: Settings },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  const visibleTabs = tabConfig.filter(t => permissions.tabs.includes(t.id));

  // Ensure active tab is allowed
  if (!permissions.tabs.includes(activeTab)) {
    setActiveTab(visibleTabs[0]?.id ?? 'daily-monitoring');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{communityName || 'Community Portal'}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-xs sm:text-sm text-gray-600 truncate">{communityUser.name}</p>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 whitespace-nowrap">
                  {roleLabel}
                </span>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm mb-6 border border-gray-200">
          <nav className="flex border-b border-gray-200 overflow-x-auto">
            {visibleTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium transition relative whitespace-nowrap ${
                  activeTab === id
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div>
          {activeTab === 'daily-monitoring' && <CommunityDailyMonitoring communityId={communityUser.community_id} permissions={permissions} />}
          {activeTab === 'batches' && <CommunityBatches communityId={communityUser.community_id} permissions={permissions} />}
          {activeTab === 'analytics' && <CommunityAnalytics communityId={communityUser.community_id} />}
          {activeTab === 'inventory' && <CommunityInventory communityId={communityUser.community_id} permissions={permissions} />}
          {activeTab === 'community-config' && <CommunityConfig communityId={communityUser.community_id} permissions={permissions} />}
          {activeTab === 'reports' && <CommunityReports communityId={communityUser.community_id} />}
        </div>
      </div>
    </div>
  );
}
