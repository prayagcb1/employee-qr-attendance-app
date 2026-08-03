import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Pencil, X, Check, Users, Phone, Mail, ChevronDown, ChevronUp, Layers } from 'lucide-react';

interface Composter {
  id: string;
  make: string;
  model: string;
  capacity_liters: number;
}

interface KeyPerson {
  id: string;
  community_id: string;
  role_type: 'estate_manager' | 'mc_member' | 'caas_supervisor' | 'account_manager';
  name: string;
  phone: string;
  email: string;
}

interface Batch {
  id: string;
  community_id: string;
  batch_number: string;
  status: 'loading' | 'harvesting' | 'maintenance' | 'completed';
}

interface Community {
  id: string;
  name: string;
  address: string;
  wet_waste_bin_size_liters: number;
  waste_density_kg_per_ltr: number;
  composter_id: string | null;
  bins_per_batch: number;
  active: boolean;
  composters?: Composter | null;
  key_people?: KeyPerson[];
  batches?: Batch[];
}

const ROLE_LABELS: Record<string, string> = {
  estate_manager: 'Estate Manager',
  mc_member: 'MC Member',
  caas_supervisor: 'CAAS Supervisor',
  account_manager: 'Account Manager',
};

const STATUS_COLORS: Record<string, string> = {
  loading: 'bg-blue-100 text-blue-800',
  harvesting: 'bg-green-100 text-green-800',
  maintenance: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-100 text-gray-600',
};

export function CommunityManagement() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [composters, setComposters] = useState<Composter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    address: '',
    wet_waste_bin_size_liters: '50',
    waste_density_kg_per_ltr: '1.0',
    composter_id: '',
    bins_per_batch: '4',
  });

  // Key person form
  const [showKeyPersonForm, setShowKeyPersonForm] = useState<string | null>(null);
  const [keyPersonForm, setKeyPersonForm] = useState({ role_type: 'estate_manager', name: '', phone: '', email: '' });

  // Batch form
  const [showBatchForm, setShowBatchForm] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState({ batch_number: '', status: 'loading' as Batch['status'] });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [composterRes, communityRes] = await Promise.all([
      supabase.from('composters').select('*').eq('active', true).order('make'),
      supabase.from('communities').select('*').order('name'),
    ]);

    if (composterRes.error || communityRes.error) {
      setError(composterRes.error?.message || communityRes.error?.message || 'Failed to load');
      setLoading(false);
      return;
    }

    const composterList = (composterRes.data ?? []) as Composter[];
    setComposters(composterList);

    const communityList = (communityRes.data ?? []) as Community[];
    const composterMap = new Map(composterList.map(c => [c.id, c]));

    // Fetch key people and batches for all communities
    const [keyPeopleRes, batchesRes] = await Promise.all([
      supabase.from('community_key_people').select('*').order('role_type'),
      supabase.from('community_batches').select('*').order('created_at', { ascending: false }),
    ]);

    const keyPeople = (keyPeopleRes.data ?? []) as KeyPerson[];
    const batches = (batchesRes.data ?? []) as Batch[];

    const enriched = communityList.map(c => ({
      ...c,
      composters: c.composter_id ? (composterMap.get(c.composter_id) ?? null) : null,
      key_people: keyPeople.filter(kp => kp.community_id === c.id),
      batches: batches.filter(b => b.community_id === c.id),
    }));

    setCommunities(enriched);
    setError(null);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name: '', address: '', wet_waste_bin_size_liters: '50', waste_density_kg_per_ltr: '1.0', composter_id: '', bins_per_batch: '4' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Community name is required.'); return; }

    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      wet_waste_bin_size_liters: parseFloat(form.wet_waste_bin_size_liters) || 50,
      waste_density_kg_per_ltr: parseFloat(form.waste_density_kg_per_ltr) || 1.0,
      composter_id: form.composter_id || null,
      bins_per_batch: parseInt(form.bins_per_batch) || 4,
    };

    if (editingId) {
      const { error: err } = await supabase.from('communities').update(payload).eq('id', editingId);
      if (err) { setError(err.message); return; }
    } else {
      const { error: err } = await supabase.from('communities').insert(payload);
      if (err) { setError(err.message); return; }
    }

    resetForm();
    fetchAll();
  };

  const handleEdit = (c: Community) => {
    setForm({
      name: c.name,
      address: c.address,
      wet_waste_bin_size_liters: String(c.wet_waste_bin_size_liters),
      waste_density_kg_per_ltr: String(c.waste_density_kg_per_ltr),
      composter_id: c.composter_id || '',
      bins_per_batch: String(c.bins_per_batch),
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this community? All associated key people and batches will also be deleted.')) return;
    const { error: err } = await supabase.from('communities').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    fetchAll();
  };

  const toggleActive = async (c: Community) => {
    const { error: err } = await supabase.from('communities').update({ active: !c.active }).eq('id', c.id);
    if (err) { setError(err.message); return; }
    fetchAll();
  };

  // Key person handlers
  const addKeyPerson = async (communityId: string) => {
    if (!keyPersonForm.name.trim()) { setError('Key person name is required.'); return; }
    const { error: err } = await supabase.from('community_key_people').insert({
      community_id: communityId,
      role_type: keyPersonForm.role_type,
      name: keyPersonForm.name.trim(),
      phone: keyPersonForm.phone.trim(),
      email: keyPersonForm.email.trim(),
    } as any);
    if (err) { setError(err.message); return; }
    setKeyPersonForm({ role_type: 'estate_manager', name: '', phone: '', email: '' });
    setShowKeyPersonForm(null);
    fetchAll();
  };

  const deleteKeyPerson = async (id: string) => {
    const { error: err } = await supabase.from('community_key_people').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    fetchAll();
  };

  // Batch handlers
  const addBatch = async (communityId: string) => {
    const { error: err } = await supabase.from('community_batches').insert({
      community_id: communityId,
      batch_number: batchForm.batch_number.trim() || `Batch ${new Date().toLocaleDateString()}`,
      status: batchForm.status,
    });
    if (err) { setError(err.message); return; }
    setBatchForm({ batch_number: '', status: 'loading' });
    setShowBatchForm(null);
    fetchAll();
  };

  const updateBatchStatus = async (batch: Batch, status: Batch['status']) => {
    const { error: err } = await supabase.from('community_batches').update({ status }).eq('id', batch.id);
    if (err) { setError(err.message); return; }
    fetchAll();
  };

  const deleteBatch = async (id: string) => {
    if (!confirm('Delete this batch? Bin assignments will be removed.')) return;
    const { error: err } = await supabase.from('community_batches').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    fetchAll();
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Community Management</h2>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Community
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Community Name</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Green Valley Society" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Community address" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wet Waste Bin Size (L)</label>
                <input type="number" min="0" value={form.wet_waste_bin_size_liters}
                  onChange={e => setForm({ ...form, wet_waste_bin_size_liters: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Density (kg/L)</label>
                <input type="number" min="0" step="0.01" value={form.waste_density_kg_per_ltr}
                  onChange={e => setForm({ ...form, waste_density_kg_per_ltr: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Composter</label>
                <select value={form.composter_id} onChange={e => setForm({ ...form, composter_id: e.target.value })} className={inputCls}>
                  <option value="">Select composter</option>
                  {composters.map(c => (
                    <option key={c.id} value={c.id}>{c.make} {c.model} ({c.capacity_liters}L)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bins per Batch</label>
                <input type="number" min="1" value={form.bins_per_batch}
                  onChange={e => setForm({ ...form, bins_per_batch: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
                <Check className="w-4 h-4" />{editingId ? 'Update' : 'Add'} Community
              </button>
              <button type="button" onClick={resetForm} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">
                <X className="w-4 h-4" />Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading communities...</div>
        ) : communities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No communities added yet</div>
        ) : (
          <div className="space-y-4">
            {communities.map(c => (
              <div key={c.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-gray-900 truncate">{c.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {c.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                        <span>Bin: {c.wet_waste_bin_size_liters}L</span>
                        <span>Density: {c.waste_density_kg_per_ltr} kg/L</span>
                        <span>Batch size: {c.bins_per_batch} bins</span>
                        {c.composters && <span>Composter: {c.composters.make} {c.composters.model} ({c.composters.capacity_liters}L)</span>}
                        <span>{c.key_people?.length || 0} key people</span>
                        <span>{c.batches?.length || 0} batches</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleActive(c); }}
                        className="px-2 py-1 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition">
                        {c.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {expandedId === c.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>
                </button>

                {expandedId === c.id && (
                  <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-4">
                    {/* Key People Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-800">Key People</h4>
                        <button
                          onClick={() => { setShowKeyPersonForm(showKeyPersonForm === c.id ? null : c.id); setKeyPersonForm({ role_type: 'estate_manager', name: '', phone: '', email: '' }); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition font-medium"
                        >
                          <Plus className="w-3 h-3" />Add Person
                        </button>
                      </div>

                      {showKeyPersonForm === c.id && (
                        <div className="mb-3 p-3 bg-white border border-gray-200 rounded-lg space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <select value={keyPersonForm.role_type} onChange={e => setKeyPersonForm({ ...keyPersonForm, role_type: e.target.value as KeyPerson['role_type'] })} className={inputCls}>
                              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            <input type="text" placeholder="Name" value={keyPersonForm.name} onChange={e => setKeyPersonForm({ ...keyPersonForm, name: e.target.value })} className={inputCls} />
                            <input type="text" placeholder="Phone" value={keyPersonForm.phone} onChange={e => setKeyPersonForm({ ...keyPersonForm, phone: e.target.value })} className={inputCls} />
                            <input type="email" placeholder="Email" value={keyPersonForm.email} onChange={e => setKeyPersonForm({ ...keyPersonForm, email: e.target.value })} className={inputCls} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => addKeyPerson(c.id)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition font-medium">Save</button>
                            <button onClick={() => setShowKeyPersonForm(null)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                          </div>
                        </div>
                      )}

                      {c.key_people && c.key_people.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {c.key_people.map(kp => (
                            <div key={kp.id} className="p-3 bg-white border border-gray-200 rounded-lg flex items-start justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-indigo-700">{ROLE_LABELS[kp.role_type]}</span>
                                </div>
                                <p className="text-sm font-medium text-gray-900 truncate">{kp.name}</p>
                                {kp.phone && <p className="text-xs text-gray-600 flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{kp.phone}</p>}
                                {kp.email && <p className="text-xs text-gray-600 flex items-center gap-1"><Mail className="w-3 h-3" />{kp.email}</p>}
                              </div>
                              <button onClick={() => deleteKeyPerson(kp.id)} className="p-1 text-gray-400 hover:text-red-600 transition flex-shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No key people added yet</p>
                      )}
                    </div>

                    {/* Batches Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Layers className="w-4 h-4" />Batches</h4>
                        <button
                          onClick={() => { setShowBatchForm(showBatchForm === c.id ? null : c.id); setBatchForm({ batch_number: '', status: 'loading' }); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition font-medium"
                        >
                          <Plus className="w-3 h-3" />Add Batch
                        </button>
                      </div>

                      {showBatchForm === c.id && (
                        <div className="mb-3 p-3 bg-white border border-gray-200 rounded-lg space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input type="text" placeholder="Batch label (optional)" value={batchForm.batch_number} onChange={e => setBatchForm({ ...batchForm, batch_number: e.target.value })} className={inputCls} />
                            <select value={batchForm.status} onChange={e => setBatchForm({ ...batchForm, status: e.target.value as Batch['status'] })} className={inputCls}>
                              <option value="loading">Loading</option>
                              <option value="harvesting">Harvesting</option>
                              <option value="maintenance">Maintenance</option>
                              <option value="completed">Completed</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => addBatch(c.id)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition font-medium">Save</button>
                            <button onClick={() => setShowBatchForm(null)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                          </div>
                        </div>
                      )}

                      {c.batches && c.batches.length > 0 ? (
                        <div className="space-y-2">
                          {c.batches.map(b => (
                            <div key={b.id} className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-900">{b.batch_number || 'Untitled Batch'}</span>
                                <select
                                  value={b.status}
                                  onChange={e => updateBatchStatus(b, e.target.value as Batch['status'])}
                                  className={`px-2 py-0.5 text-xs font-medium rounded-full border-0 cursor-pointer ${STATUS_COLORS[b.status]}`}
                                >
                                  <option value="loading">Loading</option>
                                  <option value="harvesting">Harvesting</option>
                                  <option value="maintenance">Maintenance</option>
                                  <option value="completed">Completed</option>
                                </select>
                              </div>
                              <button onClick={() => deleteBatch(b.id)} className="p-1 text-gray-400 hover:text-red-600 transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No batches created yet</p>
                      )}
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
