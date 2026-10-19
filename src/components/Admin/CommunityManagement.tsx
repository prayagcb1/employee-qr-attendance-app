import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Pencil, X, Check, Users, Phone, Mail, ChevronDown, ChevronUp, Layers, Package, UserPlus, Eye, Wrench } from 'lucide-react';
import { BIN_STATUS_LABELS, BIN_STATUS_COLORS, MAINTENANCE_ISSUE_TYPES, MAINTENANCE_STATUS_LABELS, MAINTENANCE_STATUS_COLORS, type BinStatus } from '../../lib/binStatus';

interface Composter { id: string; make: string; model: string; capacity_liters: number; }
interface Site { id: string; name: string; address: string | null; }
interface KeyPerson { id: string; community_id: string; role_type: 'estate_manager' | 'mc_member' | 'caas_supervisor' | 'account_manager'; name: string; phone: string; email: string; }
interface Batch { id: string; community_id: string; batch_number: string; status: 'loading' | 'harvesting' | 'maintenance' | 'completed'; start_date: string | null; expected_harvest_date: string | null; }
interface Bin { id: string; bin_code: string; bin_status: string; capacity_liters: number; current_weight_kg: number; bin_number: number | null; notes: string; last_activity: string | null; }
interface CommunityUser { id: string; user_id: string; community_id: string; role_type: string; name: string; phone: string; email: string; active: boolean; }

interface Community {
  id: string; name: string; address: string;
  wet_waste_bin_size_liters: number; waste_density_kg_per_ltr: number;
  composter_id: string | null; bins_per_batch: number; active: boolean;
  site_id: string | null;
  bin_count?: number;
  composters?: Composter | null; site?: Site | null; key_people?: KeyPerson[];
  batches?: Batch[]; community_users?: CommunityUser[];
}

const ROLE_LABELS: Record<string, string> = {
  estate_manager: 'Estate Manager', mc_member: 'MC Member',
  caas_supervisor: 'CAAS Supervisor', account_manager: 'Account Manager',
};

const STATUS_COLORS: Record<string, string> = {
  loading: 'bg-blue-100 text-blue-800', harvesting: 'bg-green-100 text-green-800',
  maintenance: 'bg-orange-100 text-orange-800', completed: 'bg-gray-100 text-gray-600',
};

export function CommunityManagement() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [composters, setComposters] = useState<Composter[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', wet_waste_bin_size_liters: '50', waste_density_kg_per_ltr: '1.0', composter_id: '', bins_per_batch: '4', site_id: '' });

  const [showKeyPersonForm, setShowKeyPersonForm] = useState<string | null>(null);
  const [keyPersonForm, setKeyPersonForm] = useState({ role_type: 'estate_manager' as KeyPerson['role_type'], name: '', phone: '', email: '' });

  const [showBatchForm, setShowBatchForm] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState({ batch_number: '', status: 'loading' as Batch['status'], start_date: '', expected_harvest_date: '' });

  // Batch detail view
  const [batchDetailView, setBatchDetailView] = useState<{ communityId: string; batch: Batch } | null>(null);
  const [batchBins, setBatchBins] = useState<Bin[]>([]);
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [binMaintenance, setBinMaintenance] = useState<any[]>([]);
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [maintForm, setMaintForm] = useState({ issue_type: 'broken_handle', issue_description: '' });

  // Community user form
  const [showUserForm, setShowUserForm] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ role_type: 'estate_manager', name: '', phone: '', email: '', password: '' });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [composterRes, communityRes, siteRes] = await Promise.all([
      supabase.from('composters').select('*').eq('active', true).order('make'),
      supabase.from('communities').select('*').order('name'),
      supabase.from('sites').select('id, name, address').eq('active', true).order('name'),
    ]);
    if (composterRes.error || communityRes.error || siteRes.error) { setError(composterRes.error?.message || communityRes.error?.message || siteRes.error?.message || 'Failed to load'); setLoading(false); return; }
    const composterList = (composterRes.data ?? []) as Composter[];
    const siteList = (siteRes.data ?? []) as Site[];
    setComposters(composterList);
    setSites(siteList);
    const communityList = (communityRes.data ?? []) as Community[];
    const composterMap = new Map(composterList.map(c => [c.id, c]));
    const [keyPeopleRes, batchesRes, usersRes, binsRes] = await Promise.all([
      supabase.from('community_key_people').select('*').order('role_type'),
      supabase.from('community_batches').select('*').order('created_at', { ascending: false }),
      supabase.from('community_users').select('*').order('name'),
      supabase.from('bins').select('id, site_id'),
    ]);
    const keyPeople = (keyPeopleRes.data ?? []) as KeyPerson[];
    const batches = (batchesRes.data ?? []) as Batch[];
    const users = (usersRes.data ?? []) as CommunityUser[];
    const binCounts = new Map<string, number>();
    for (const bin of (binsRes.data ?? []) as { id: string; site_id: string }[]) {
      binCounts.set(bin.site_id, (binCounts.get(bin.site_id) ?? 0) + 1);
    }
    const siteMap = new Map(siteList.map(s => [s.id, s]));
    const enriched = communityList.map(c => ({
      ...c, composters: c.composter_id ? (composterMap.get(c.composter_id) ?? null) : null,
      site: c.site_id ? (siteMap.get(c.site_id) ?? null) : null,
      bin_count: c.site_id ? (binCounts.get(c.site_id) ?? 0) : 0,
      key_people: keyPeople.filter(kp => kp.community_id === c.id),
      batches: batches.filter(b => b.community_id === c.id),
      community_users: users.filter(u => u.community_id === c.id),
    }));
    setCommunities(enriched); setError(null); setLoading(false);
  };

  const resetForm = () => { setForm({ name: '', address: '', wet_waste_bin_size_liters: '50', waste_density_kg_per_ltr: '1.0', composter_id: '', bins_per_batch: '4', site_id: '' }); setEditingId(null); setShowForm(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Community name is required.'); return; }
    const payload = { name: form.name.trim(), address: form.address.trim(), wet_waste_bin_size_liters: parseFloat(form.wet_waste_bin_size_liters) || 50, waste_density_kg_per_ltr: parseFloat(form.waste_density_kg_per_ltr) || 1.0, composter_id: form.composter_id || null, bins_per_batch: parseInt(form.bins_per_batch) || 4, site_id: form.site_id || null };
    if (editingId) { const { error: err } = await supabase.from('communities').update(payload).eq('id', editingId); if (err) { setError(err.message); return; } }
    else { const { error: err } = await supabase.from('communities').insert(payload); if (err) { setError(err.message); return; } }
    resetForm(); fetchAll();
  };

  const handleEdit = (c: Community) => { setForm({ name: c.name, address: c.address, wet_waste_bin_size_liters: String(c.wet_waste_bin_size_liters), waste_density_kg_per_ltr: String(c.waste_density_kg_per_ltr), composter_id: c.composter_id || '', bins_per_batch: String(c.bins_per_batch), site_id: c.site_id || '' }); setEditingId(c.id); setShowForm(true); };

  const handleDelete = async (id: string) => { if (!confirm('Delete this community? All associated data will be deleted.')) return; const { error: err } = await supabase.from('communities').delete().eq('id', id); if (err) { setError(err.message); return; } fetchAll(); };

  const toggleActive = async (c: Community) => { const { error: err } = await supabase.from('communities').update({ active: !c.active }).eq('id', c.id); if (err) { setError(err.message); return; } fetchAll(); };

  const addKeyPerson = async (communityId: string) => {
    if (!keyPersonForm.name.trim()) { setError('Key person name is required.'); return; }
    const { error: err } = await supabase.from('community_key_people').insert({ community_id: communityId, role_type: keyPersonForm.role_type, name: keyPersonForm.name.trim(), phone: keyPersonForm.phone.trim(), email: keyPersonForm.email.trim() } as any);
    if (err) { setError(err.message); return; }
    setKeyPersonForm({ role_type: 'estate_manager', name: '', phone: '', email: '' }); setShowKeyPersonForm(null); fetchAll();
  };

  const deleteKeyPerson = async (id: string) => { const { error: err } = await supabase.from('community_key_people').delete().eq('id', id); if (err) { setError(err.message); return; } fetchAll(); };

  // Create batch with auto-generated bins
  const addBatch = async (communityId: string) => {
    const community = communities.find(c => c.id === communityId);
    if (!community) return;
    if (!community.site_id) { setError('This community must be linked to a Site before batches can be created.'); return; }
    const binsCount = community.bins_per_batch;
    const binSize = community.wet_waste_bin_size_liters;
    const siteId = community.site_id;
    const batchLabel = batchForm.batch_number.trim() || `Batch ${new Date().toLocaleDateString()}`;

    // Insert batch (trigger auto-generates bins with the community's site_id)
    const { data: batchData, error: batchErr } = await supabase.from('community_batches').insert({
      community_id: communityId, batch_number: batchLabel, status: batchForm.status,
      start_date: batchForm.start_date || null, expected_harvest_date: batchForm.expected_harvest_date || null,
    } as any).select('id').single();
    if (batchErr || !batchData) {
      setError(batchErr?.message || 'Failed to create batch');
      return;
    }

    setBatchForm({ batch_number: '', status: 'loading', start_date: '', expected_harvest_date: '' }); setShowBatchForm(null); fetchAll();
  };

  const updateBatchStatus = async (batch: Batch, status: Batch['status']) => { const { error: err } = await supabase.from('community_batches').update({ status }).eq('id', batch.id); if (err) { setError(err.message); return; } fetchAll(); };

  const deleteBatch = async (id: string) => { if (!confirm('Delete this batch? All bins in this batch will be unassigned.')) return; const { error: err } = await supabase.from('bins').update({ batch_id: null, bin_status: 'available' }).eq('batch_id', id); if (err) { setError(err.message); return; } const { error: e2 } = await supabase.from('community_batches').delete().eq('id', id); if (e2) { setError(e2.message); return; } fetchAll(); };

  // Batch detail view
  const openBatchDetail = async (communityId: string, batch: Batch) => {
    setBatchDetailView({ communityId, batch });
    const { data, error: err } = await supabase.from('bins').select('id, bin_code, bin_status, capacity_liters, current_weight_kg, bin_number, notes, last_activity').eq('batch_id', batch.id).order('bin_number', { ascending: true });
    if (err) { setError(err.message); return; }
    setBatchBins((data ?? []) as Bin[]);
  };

  const openBinDetails = async (bin: Bin) => {
    setSelectedBin(bin);
    const { data, error: err } = await supabase.from('bin_maintenance_history').select('*').eq('bin_id', bin.id).order('created_at', { ascending: false });
    if (err) { setError(err.message); return; }
    setBinMaintenance((data ?? []) as any[]);
    setShowMaintForm(false);
  };

  const updateBinStatus = async (bin: Bin, status: BinStatus) => {
    const { error: err } = await supabase.from('bins').update({ bin_status: status, last_activity: new Date().toISOString() }).eq('id', bin.id);
    if (err) { setError(err.message); return; }
    await supabase.from('bin_status_history').insert({ bin_id: bin.id, old_status: bin.bin_status, new_status: status, changed_by_type: 'employee' } as any);
    if (batchDetailView) openBatchDetail(batchDetailView.communityId, batchDetailView.batch);
    setSelectedBin(null);
  };

  const submitMaintenance = async (bin: Bin) => {
    if (!maintForm.issue_description.trim()) { setError('Please describe the issue.'); return; }
    const { error: err } = await supabase.from('bin_maintenance_history').insert({ bin_id: bin.id, issue_type: maintForm.issue_type, issue_description: maintForm.issue_description.trim(), status: 'open', reported_by_type: 'employee' } as any);
    if (err) { setError(err.message); return; }
    await supabase.from('bins').update({ bin_status: 'maintenance', last_activity: new Date().toISOString() }).eq('id', bin.id);
    await supabase.from('bin_status_history').insert({ bin_id: bin.id, old_status: bin.bin_status, new_status: 'maintenance', changed_by_type: 'employee', reason: maintForm.issue_description.trim() } as any);
    setMaintForm({ issue_type: 'broken_handle', issue_description: '' }); setShowMaintForm(false);
    openBinDetails({ ...bin, bin_status: 'maintenance' });
    if (batchDetailView) openBatchDetail(batchDetailView.communityId, batchDetailView.batch);
  };

  const resolveMaintenance = async (record: any, bin: Bin) => {
    const { error: err } = await supabase.from('bin_maintenance_history').update({ status: 'resolved', resolution_description: 'Issue resolved', resolved_at: new Date().toISOString() }).eq('id', record.id);
    if (err) { setError(err.message); return; }
    await supabase.from('bins').update({ bin_status: 'available', last_activity: new Date().toISOString() }).eq('id', bin.id);
    await supabase.from('bin_status_history').insert({ bin_id: bin.id, old_status: 'maintenance', new_status: 'available', changed_by_type: 'employee', reason: 'Maintenance resolved' } as any);
    openBinDetails({ ...bin, bin_status: 'available' });
    if (batchDetailView) openBatchDetail(batchDetailView.communityId, batchDetailView.batch);
  };

  // Community user management
  const addCommunityUser = async (communityId: string) => {
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.password) { setError('Name, email, and password are required.'); return; }
    const { data, error: signUpErr } = await supabase.auth.signUp({ email: userForm.email.trim(), password: userForm.password });
    if (signUpErr || !data.user) { setError(signUpErr?.message || 'Failed to create user'); return; }
    const { error: err } = await supabase.from('community_users').insert({ user_id: data.user.id, community_id: communityId, role_type: userForm.role_type, name: userForm.name.trim(), phone: userForm.phone.trim(), email: userForm.email.trim() } as any);
    if (err) { setError(err.message); return; }
    setUserForm({ role_type: 'estate_manager', name: '', phone: '', email: '', password: '' }); setShowUserForm(null); fetchAll();
  };

  const toggleUserActive = async (u: CommunityUser) => { const { error: err } = await supabase.from('community_users').update({ active: !u.active }).eq('id', u.id); if (err) { setError(err.message); return; } fetchAll(); };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  // Batch detail view render
  if (batchDetailView) {
    const { batch } = batchDetailView;
    const loadedCount = batchBins.filter(b => b.bin_status === 'loaded').length;
    const remainingCount = batchBins.filter(b => b.bin_status === 'available').length;
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setBatchDetailView(null)} className="text-gray-500 hover:text-gray-700 transition">&larr; Back</button>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><Layers className="w-5 h-5 text-blue-600" /></div>
            <h2 className="text-xl font-bold text-gray-900">{batch.batch_number}</h2>
            <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_COLORS[batch.status]}`}>{batch.status}</span>
          </div>
        </div>

        {/* Batch details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Start Date</p><p className="text-sm font-medium text-gray-900">{batch.start_date ? new Date(batch.start_date).toLocaleDateString() : '-'}</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Expected Harvest</p><p className="text-sm font-medium text-gray-900">{batch.expected_harvest_date ? new Date(batch.expected_harvest_date).toLocaleDateString() : '-'}</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Total Bins</p><p className="text-sm font-medium text-gray-900">{batchBins.length}</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Loaded / Remaining</p><p className="text-sm font-medium text-gray-900">{loadedCount} / {remainingCount}</p></div>
        </div>

        {/* Bin grid */}
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><Package className="w-4 h-4" />Bins in Batch</h3>
        {batchBins.length === 0 ? <p className="text-sm text-gray-500">No bins in this batch</p> : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {batchBins.map(bin => {
              const colors = BIN_STATUS_COLORS[bin.bin_status as BinStatus] ?? BIN_STATUS_COLORS.available;
              return (
                <button key={bin.id} onClick={() => openBinDetails(bin)} className={`p-3 border-2 rounded-lg text-center transition hover:shadow-md ${colors.card}`}>
                  <p className="text-sm font-semibold text-gray-900">Bin {bin.bin_number ?? '?'}</p>
                  <p className="text-xs text-gray-600 mt-1">{BIN_STATUS_LABELS[bin.bin_status as BinStatus] ?? bin.bin_status}</p>
                  {bin.current_weight_kg > 0 && <p className="text-xs text-gray-500 mt-0.5">{bin.current_weight_kg} kg</p>}
                </button>
              );
            })}
          </div>
        )}

        {/* Bin detail modal */}
        {selectedBin && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 overflow-y-auto">
            <div className="min-h-full flex items-start justify-center p-2 sm:p-4">
              <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-lg my-2 sm:my-6 overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-blue-700" /></div>
                    <div><h2 className="text-base font-bold text-gray-900">{selectedBin.bin_code}</h2><p className="text-xs text-gray-600">Bin #{selectedBin.bin_number ?? '-'} - {selectedBin.capacity_liters}L</p></div>
                  </div>
                  <button onClick={() => setSelectedBin(null)} className="text-gray-400 hover:text-gray-600 transition p-1"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="p-3 bg-white border border-gray-200 rounded-lg">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Current Status</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${BIN_STATUS_COLORS[selectedBin.bin_status as BinStatus]?.bg ?? ''} ${BIN_STATUS_COLORS[selectedBin.bin_status as BinStatus]?.text ?? ''}`}>{BIN_STATUS_LABELS[selectedBin.bin_status as BinStatus] ?? selectedBin.bin_status}</span>
                      {selectedBin.current_weight_kg > 0 && <span className="text-sm text-gray-600">{selectedBin.current_weight_kg} kg</span>}
                    </div>
                    {selectedBin.last_activity && <p className="text-xs text-gray-500 mt-2">Last activity: {new Date(selectedBin.last_activity).toLocaleString()}</p>}
                  </div>
                  <div className="p-3 bg-white border border-gray-200 rounded-lg">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Change Status</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(BIN_STATUS_LABELS) as BinStatus[]).map(status => {
                        const colors = BIN_STATUS_COLORS[status];
                        return <button key={status} onClick={() => updateBinStatus(selectedBin, status)} className={`px-3 py-2 rounded-lg text-sm font-medium transition ${colors.bg} ${colors.text} hover:opacity-80`}>{BIN_STATUS_LABELS[status]}</button>;
                      })}
                    </div>
                  </div>
                  <div className="p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Wrench className="w-4 h-4" />Maintenance</p>
                      <button onClick={() => setShowMaintForm(!showMaintForm)} className="text-xs text-blue-600 font-medium hover:text-blue-700">{showMaintForm ? 'Cancel' : '+ Report Issue'}</button>
                    </div>
                    {showMaintForm && (
                      <div className="mb-3 space-y-2">
                        <select value={maintForm.issue_type} onChange={e => setMaintForm({ ...maintForm, issue_type: e.target.value })} className={inputCls}>{MAINTENANCE_ISSUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                        <input type="text" placeholder="Describe the issue" value={maintForm.issue_description} onChange={e => setMaintForm({ ...maintForm, issue_description: e.target.value })} className={inputCls} />
                        <button onClick={() => submitMaintenance(selectedBin)} className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm font-medium">Report Issue</button>
                      </div>
                    )}
                    {binMaintenance.length > 0 ? (
                      <div className="space-y-2">
                        {binMaintenance.map(rec => (
                          <div key={rec.id} className="p-2 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-1"><span className="text-xs font-semibold text-gray-700">{MAINTENANCE_ISSUE_TYPES.find(t => t.value === rec.issue_type)?.label ?? rec.issue_type}</span><span className={`px-2 py-0.5 text-xs font-medium rounded-full ${MAINTENANCE_STATUS_COLORS[rec.status] ?? ''}`}>{MAINTENANCE_STATUS_LABELS[rec.status] ?? rec.status}</span></div>
                            <p className="text-xs text-gray-600">{rec.issue_description}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(rec.created_at).toLocaleDateString()}</p>
                            {rec.status !== 'resolved' && <button onClick={() => resolveMaintenance(rec, selectedBin)} className="mt-1 text-xs text-green-600 font-medium hover:text-green-700">Mark Resolved</button>}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-500">No maintenance history</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center"><Users className="w-5 h-5 text-indigo-600" /></div>
            <h2 className="text-xl font-bold text-gray-900">Community Management</h2>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"><Plus className="w-4 h-4" />Add Community</button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Community Name</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Green Valley Society" className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Community address" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Wet Waste Bin Size (L)</label><input type="number" min="0" value={form.wet_waste_bin_size_liters} onChange={e => setForm({ ...form, wet_waste_bin_size_liters: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Density (kg/L)</label><input type="number" min="0" step="0.01" value={form.waste_density_kg_per_ltr} onChange={e => setForm({ ...form, waste_density_kg_per_ltr: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Composter</label><select value={form.composter_id} onChange={e => setForm({ ...form, composter_id: e.target.value })} className={inputCls}><option value="">Select composter</option>{composters.map(c => <option key={c.id} value={c.id}>{c.make} {c.model} ({c.capacity_liters}L)</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Bins per Batch</label><input type="number" min="1" value={form.bins_per_batch} onChange={e => setForm({ ...form, bins_per_batch: e.target.value })} className={inputCls} /></div>
            </div>
            <div className="mt-4"><label className="block text-sm font-medium text-gray-700 mb-1">Linked Site <span className="text-red-500">*</span></label><select value={form.site_id} onChange={e => setForm({ ...form, site_id: e.target.value })} className={inputCls}><option value="">Select a site</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}{s.address ? ` — ${s.address}` : ''}</option>)}</select><p className="text-xs text-gray-500 mt-1">A site must be linked before batches can be created.</p></div>
            <div className="flex gap-3">
              <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"><Check className="w-4 h-4" />{editingId ? 'Update' : 'Add'} Community</button>
              <button type="button" onClick={resetForm} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"><X className="w-4 h-4" />Cancel</button>
            </div>
          </form>
        )}

        {loading ? <div className="text-center py-12 text-gray-500">Loading communities...</div> : communities.length === 0 ? <div className="text-center py-12 text-gray-500">No communities added yet</div> : (
          <div className="space-y-4">
            {communities.map(c => (
              <div key={c.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="w-full p-4 text-left hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1"><h3 className="text-base font-semibold text-gray-900 truncate">{c.name}</h3><span className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{c.active ? 'Active' : 'Inactive'}</span></div>
                      <div className="flex flex-wrap gap-3 text-sm text-gray-600"><span>Bin: {c.wet_waste_bin_size_liters}L</span><span>Density: {c.waste_density_kg_per_ltr} kg/L</span><span>Batch size: {c.bins_per_batch} bins</span>{c.composters && <span>Composter: {c.composters.make} {c.composters.model}</span>}<span>{c.key_people?.length || 0} key people</span><span>{c.batches?.length || 0} batches</span><span>{c.community_users?.length || 0} portal users</span><span>{c.bin_count ?? 0} bins</span>{c.site ? <span className="text-blue-600">Site: {c.site.name}</span> : <span className="text-orange-600 font-medium">No site linked</span>}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><Pencil className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); toggleActive(c); }} className="px-2 py-1 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition">{c.active ? 'Deactivate' : 'Activate'}</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                      {expandedId === c.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>
                </button>

                {expandedId === c.id && (
                  <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-4">
                    {/* Portal Users Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3"><h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><UserPlus className="w-4 h-4" />Portal Users</h4>
                        <button onClick={() => { setShowUserForm(showUserForm === c.id ? null : c.id); setUserForm({ role_type: 'estate_manager', name: '', phone: '', email: '', password: '' }); }} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition font-medium"><Plus className="w-3 h-3" />Add Portal User</button>
                      </div>
                      {showUserForm === c.id && (
                        <div className="mb-3 p-3 bg-white border border-gray-200 rounded-lg space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <select value={userForm.role_type} onChange={e => setUserForm({ ...userForm, role_type: e.target.value })} className={inputCls}>{Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                            <input type="text" placeholder="Full Name" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className={inputCls} />
                            <input type="text" placeholder="Phone" value={userForm.phone} onChange={e => setUserForm({ ...userForm, phone: e.target.value })} className={inputCls} />
                            <input type="email" placeholder="Email (for login)" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className={inputCls} />
                            <input type="password" placeholder="Password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className={inputCls} />
                          </div>
                          <div className="flex gap-2"><button onClick={() => addCommunityUser(c.id)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition font-medium">Create User</button><button onClick={() => setShowUserForm(null)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button></div>
                        </div>
                      )}
                      {c.community_users && c.community_users.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {c.community_users.map(u => (
                            <div key={u.id} className="p-3 bg-white border border-gray-200 rounded-lg flex items-start justify-between">
                              <div><div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold text-indigo-700">{ROLE_LABELS[u.role_type] ?? u.role_type}</span><span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${u.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{u.active ? 'Active' : 'Inactive'}</span></div><p className="text-sm font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-600">{u.email}</p></div>
                              <button onClick={() => toggleUserActive(u)} className="px-2 py-1 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition">{u.active ? 'Deactivate' : 'Activate'}</button>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-gray-500">No portal users created yet</p>}
                    </div>

                    {/* Key People Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3"><h4 className="text-sm font-semibold text-gray-800">Key People (Contacts)</h4>
                        <button onClick={() => { setShowKeyPersonForm(showKeyPersonForm === c.id ? null : c.id); setKeyPersonForm({ role_type: 'estate_manager', name: '', phone: '', email: '' }); }} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition font-medium"><Plus className="w-3 h-3" />Add Person</button>
                      </div>
                      {showKeyPersonForm === c.id && (
                        <div className="mb-3 p-3 bg-white border border-gray-200 rounded-lg space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <select value={keyPersonForm.role_type} onChange={e => setKeyPersonForm({ ...keyPersonForm, role_type: e.target.value as KeyPerson['role_type'] })} className={inputCls}>{Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                            <input type="text" placeholder="Name" value={keyPersonForm.name} onChange={e => setKeyPersonForm({ ...keyPersonForm, name: e.target.value })} className={inputCls} />
                            <input type="text" placeholder="Phone" value={keyPersonForm.phone} onChange={e => setKeyPersonForm({ ...keyPersonForm, phone: e.target.value })} className={inputCls} />
                            <input type="email" placeholder="Email" value={keyPersonForm.email} onChange={e => setKeyPersonForm({ ...keyPersonForm, email: e.target.value })} className={inputCls} />
                          </div>
                          <div className="flex gap-2"><button onClick={() => addKeyPerson(c.id)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition font-medium">Save</button><button onClick={() => setShowKeyPersonForm(null)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button></div>
                        </div>
                      )}
                      {c.key_people && c.key_people.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {c.key_people.map(kp => (
                            <div key={kp.id} className="p-3 bg-white border border-gray-200 rounded-lg flex items-start justify-between">
                              <div className="min-w-0"><div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold text-indigo-700">{ROLE_LABELS[kp.role_type]}</span></div><p className="text-sm font-medium text-gray-900 truncate">{kp.name}</p>{kp.phone && <p className="text-xs text-gray-600 flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{kp.phone}</p>}{kp.email && <p className="text-xs text-gray-600 flex items-center gap-1"><Mail className="w-3 h-3" />{kp.email}</p>}</div>
                              <button onClick={() => deleteKeyPerson(kp.id)} className="p-1 text-gray-400 hover:text-red-600 transition flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-gray-500">No key people added yet</p>}
                    </div>

                    {/* Batches Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3"><h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Layers className="w-4 h-4" />Batches</h4>
                        <button onClick={() => { setShowBatchForm(showBatchForm === c.id ? null : c.id); setBatchForm({ batch_number: '', status: 'loading', start_date: '', expected_harvest_date: '' }); }} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition font-medium"><Plus className="w-3 h-3" />Add Batch</button>
                      </div>
                      {showBatchForm === c.id && (
                        <div className="mb-3 p-3 bg-white border border-gray-200 rounded-lg space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <input type="text" placeholder="Batch label (optional)" value={batchForm.batch_number} onChange={e => setBatchForm({ ...batchForm, batch_number: e.target.value })} className={inputCls} />
                            <select value={batchForm.status} onChange={e => setBatchForm({ ...batchForm, status: e.target.value as Batch['status'] })} className={inputCls}><option value="loading">Loading</option><option value="harvesting">Harvesting</option><option value="maintenance">Maintenance</option><option value="completed">Completed</option></select>
                            <input type="date" value={batchForm.start_date} onChange={e => setBatchForm({ ...batchForm, start_date: e.target.value })} className={inputCls} />
                            <input type="date" value={batchForm.expected_harvest_date} onChange={e => setBatchForm({ ...batchForm, expected_harvest_date: e.target.value })} className={inputCls} />
                          </div>
                          {c.site_id ? <p className="text-xs text-gray-500">This will automatically generate {c.bins_per_batch} bins of {c.wet_waste_bin_size_liters}L each at site: {c.site?.name}.</p> : <p className="text-xs text-red-600 font-medium">This community must be linked to a Site before batches can be created. Edit the community to select a site.</p>}
                          <div className="flex gap-2"><button onClick={() => addBatch(c.id)} disabled={!c.site_id} className={`px-3 py-1.5 text-white text-xs rounded-lg transition font-medium ${c.site_id ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300 cursor-not-allowed'}`}>Create Batch & Generate Bins</button><button onClick={() => setShowBatchForm(null)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button></div>
                        </div>
                      )}
                      {c.batches && c.batches.length > 0 ? (
                        <div className="space-y-2">
                          {c.batches.map(b => (
                            <div key={b.id} className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button onClick={() => openBatchDetail(c.id, b)} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"><Eye className="w-4 h-4" />{b.batch_number || 'Untitled Batch'}</button>
                                <select value={b.status} onChange={e => updateBatchStatus(b, e.target.value as Batch['status'])} className={`px-2 py-0.5 text-xs font-medium rounded-full border-0 cursor-pointer ${STATUS_COLORS[b.status]}`}><option value="loading">Loading</option><option value="harvesting">Harvesting</option><option value="maintenance">Maintenance</option><option value="completed">Completed</option></select>
                              </div>
                              <button onClick={() => deleteBatch(b.id)} className="p-1 text-gray-400 hover:text-red-600 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-gray-500">No batches created yet</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
