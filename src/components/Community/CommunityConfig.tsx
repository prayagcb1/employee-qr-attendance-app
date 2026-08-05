import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, Users, Phone, Mail } from 'lucide-react';
import type { PermissionConfig } from '../../lib/communityPermissions';

interface Community {
  id: string;
  name: string;
  address: string;
  wet_waste_bin_size_liters: number;
  waste_density_kg_per_ltr: number;
  bins_per_batch: number;
}

interface KeyPerson {
  id: string;
  role_type: string;
  name: string;
  phone: string;
  email: string;
}

const ROLE_LABELS: Record<string, string> = {
  estate_manager: 'Estate Manager',
  mc_member: 'MC Member',
  caas_supervisor: 'CAAS Supervisor',
  account_manager: 'Account Manager',
};

export function CommunityConfig({ communityId }: { communityId: string; permissions: PermissionConfig }) {
  const [community, setCommunity] = useState<Community | null>(null);
  const [keyPeople, setKeyPeople] = useState<KeyPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, [communityId]);

  const fetchAll = async () => {
    setLoading(true);
    const [commRes, kpRes] = await Promise.all([
      supabase.from('communities').select('*').eq('id', communityId).maybeSingle(),
      supabase.from('community_key_people').select('*').eq('community_id', communityId).order('role_type'),
    ]);
    if (commRes.error || kpRes.error) { setError(commRes.error?.message || kpRes.error?.message || null); }
    else { setCommunity(commRes.data as Community | null); setKeyPeople((kpRes.data ?? []) as KeyPerson[]); setError(null); }
    setLoading(false);
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!community) return <div className="text-center py-12 text-gray-500">Community not found</div>;

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center"><Settings className="w-5 h-5 text-indigo-600" /></div>
          <h2 className="text-xl font-bold text-gray-900">Community Configuration</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Name</p><p className="text-sm font-medium text-gray-900">{community.name}</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Address</p><p className="text-sm font-medium text-gray-900">{community.address || '-'}</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Wet Waste Bin Size</p><p className="text-sm font-medium text-gray-900">{community.wet_waste_bin_size_liters} L</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Waste Density</p><p className="text-sm font-medium text-gray-900">{community.waste_density_kg_per_ltr} kg/L</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Bins per Batch</p><p className="text-sm font-medium text-gray-900">{community.bins_per_batch}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center"><Users className="w-5 h-5 text-indigo-600" /></div>
          <h2 className="text-xl font-bold text-gray-900">Key People</h2>
        </div>

        {keyPeople.length === 0 ? <p className="text-sm text-gray-500">No key people added</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {keyPeople.map(kp => (
              <div key={kp.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-xs font-semibold text-indigo-700">{ROLE_LABELS[kp.role_type] ?? kp.role_type}</span>
                <p className="text-sm font-medium text-gray-900 mt-1">{kp.name}</p>
                {kp.phone && <p className="text-xs text-gray-600 flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{kp.phone}</p>}
                {kp.email && <p className="text-xs text-gray-600 flex items-center gap-1"><Mail className="w-3 h-3" />{kp.email}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
