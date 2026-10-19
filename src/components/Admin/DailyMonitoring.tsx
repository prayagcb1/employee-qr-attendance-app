import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ClipboardList, Plus, Trash2, Layers, Package, Check, X } from 'lucide-react';
import { BIN_STATUS_LABELS, BIN_STATUS_COLORS, type BinStatus } from '../../lib/binStatus';

interface Community { id: string; name: string; wet_waste_bin_size_liters: number; waste_density_kg_per_ltr: number; bins_per_batch: number; }
interface Batch { id: string; community_id: string; batch_number: string; status: 'loading' | 'harvesting' | 'maintenance' | 'completed'; start_date: string | null; expected_harvest_date: string | null; }
interface Bin { id: string; bin_code: string; bin_status: string; capacity_liters: number; current_weight_kg: number; bin_number: number | null; batch_id: string | null; }
interface DailyEntry { id: string; community_id: string; date: string; number_of_bins: number; recorded_by: string; remarks: string; created_at: string; }

const FRACTION_OPTIONS = ['0.5', '1', '1.25', '1.5', '1.75', '2', '2.5', '3', '3.5', '4', '5'];
const todayDate = () => new Date().toISOString().split('T')[0];

export function DailyMonitoring() {
  const { employee } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [wwBins, setWwBins] = useState('');
  const [wwDate, setWwDate] = useState(todayDate());
  const [wwRemarks, setWwRemarks] = useState('');

  // Loading/harvesting bin selection
  const [selectedBins, setSelectedBins] = useState<Set<string>>(new Set());
  const [actionMode, setActionMode] = useState<'loading' | 'harvesting' | null>(null);
  const [weightInput, setWeightInput] = useState('');

  useEffect(() => { fetchCommunities(); }, []);
  useEffect(() => { if (selectedCommunity) fetchCommunityData(selectedCommunity); }, [selectedCommunity]);

  const fetchCommunities = async () => {
    const { data, error: err } = await supabase.from('sites').select('id, name').eq('active', true).order('name');
    if (err) { setError(err.message); setLoading(false); return; }
    const siteCommunities = ((data ?? []) as { id: string; name: string }[]).map(site => ({
      id: site.id,
      name: site.name,
      wet_waste_bin_size_liters: 50,
      waste_density_kg_per_ltr: 1,
      bins_per_batch: 4,
    }));
    setCommunities(siteCommunities);
    if (siteCommunities.length > 0 && !selectedCommunity) setSelectedCommunity(siteCommunities[0].id);
    setLoading(false);
  };

  const fetchCommunityData = async (communityId: string) => {
    setLoading(true);
    const [batchesRes, binsRes, dailyRes] = await Promise.all([
      supabase.from('community_batches').select('*').eq('community_id', communityId).order('created_at', { ascending: false }),
      supabase.from('bins').select('id, bin_code, bin_status, capacity_liters, current_weight_kg, bin_number, batch_id').eq('community_id', communityId).order('bin_number', { ascending: true }),
      supabase.from('daily_wet_waste_entries').select('*').eq('community_id', communityId).order('date', { ascending: false }).limit(30),
    ]);
    if (batchesRes.error || binsRes.error || dailyRes.error) { setError(batchesRes.error?.message || binsRes.error?.message || dailyRes.error?.message || null); setLoading(false); return; }
    setBatches((batchesRes.data ?? []) as Batch[]);
    setBins((binsRes.data ?? []) as Bin[]);
    setDailyEntries((dailyRes.data ?? []) as DailyEntry[]);
    setError(null); setLoading(false);
  };

  const submitWetWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !selectedCommunity || !wwBins) { setError('Please fill in all required fields.'); return; }
    const { error: err } = await supabase.from('daily_wet_waste_entries').insert({ community_id: selectedCommunity, date: wwDate, number_of_bins: parseFloat(wwBins), employee_id: employee.id, recorded_by: employee.full_name, remarks: wwRemarks.trim() } as any);
    if (err) { setError(err.message); return; }
    setWwBins(''); setWwRemarks(''); fetchCommunityData(selectedCommunity);
  };

  const deleteDailyEntry = async (id: string) => {
    if (!confirm('Delete this daily entry?')) return;
    const { error: err } = await supabase.from('daily_wet_waste_entries').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    if (selectedCommunity) fetchCommunityData(selectedCommunity);
  };

  const toggleBinSelection = (binId: string) => {
    setSelectedBins(prev => { const next = new Set(prev); if (next.has(binId)) next.delete(binId); else next.add(binId); return next; });
  };

  const executeAction = async () => {
    if (!employee || !selectedCommunity || !actionMode || selectedBins.size === 0) return;
    const newStatus: BinStatus = actionMode === 'loading' ? 'loaded' : 'harvesting';
    const weight = weightInput ? parseFloat(weightInput) : 0;

    for (const binId of selectedBins) {
      const bin = bins.find(b => b.id === binId);
      if (!bin) continue;
      const updatePayload: any = { bin_status: newStatus, last_activity: new Date().toISOString() };
      if (actionMode === 'loading' && weight > 0) updatePayload.current_weight_kg = weight;
      await supabase.from('bins').update(updatePayload).eq('id', binId);
      await supabase.from('bin_status_history').insert({ bin_id: binId, old_status: bin.bin_status, new_status: newStatus, changed_by: employee.id, changed_by_type: 'employee', reason: actionMode } as any);
    }

    setSelectedBins(new Set()); setActionMode(null); setWeightInput('');
    fetchCommunityData(selectedCommunity);
  };

  const markCompleted = async () => {
    if (!employee || !selectedCommunity) return;
    for (const binId of selectedBins) {
      const bin = bins.find(b => b.id === binId);
      if (!bin) continue;
      await supabase.from('bins').update({ bin_status: 'completed', last_activity: new Date().toISOString() }).eq('id', binId);
      await supabase.from('bin_status_history').insert({ bin_id: binId, old_status: bin.bin_status, new_status: 'completed', changed_by: employee.id, changed_by_type: 'employee', reason: 'Harvest completed' } as any);
    }
    setSelectedBins(new Set()); fetchCommunityData(selectedCommunity);
  };

  const community = communities.find(c => c.id === selectedCommunity);
  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  const binsByBatch = (batchId: string) => bins.filter(b => b.batch_id === batchId);
  const getStatusCount = (batchId: string, status: string) => binsByBatch(batchId).filter(b => b.bin_status === status).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-semibold text-gray-700">Select Community:</label>
          <select value={selectedCommunity || ''} onChange={e => setSelectedCommunity(e.target.value || null)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[200px]">
            {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {community && <div className="flex flex-wrap gap-3 text-xs text-gray-600"><span className="px-2 py-1 bg-blue-50 rounded">Bin: {community.wet_waste_bin_size_liters}L</span><span className="px-2 py-1 bg-teal-50 rounded">Density: {community.waste_density_kg_per_ltr} kg/L</span><span className="px-2 py-1 bg-indigo-50 rounded">Batch: {community.bins_per_batch} bins</span></div>}
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {/* Daily Wet Waste Entry */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center"><ClipboardList className="w-5 h-5 text-green-600" /></div><h2 className="text-xl font-bold text-gray-900">Daily Wet Waste Monitoring</h2></div>
        <form onSubmit={submitWetWaste} className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Number of Bins</label><select value={wwBins} onChange={e => setWwBins(e.target.value)} className={inputCls}><option value="">Select count</option>{FRACTION_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={wwDate} onChange={e => setWwDate(e.target.value)} className={inputCls} /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label><input type="text" value={wwRemarks} onChange={e => setWwRemarks(e.target.value)} placeholder="Optional notes" className={inputCls} /></div>
          </div>
          <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"><Plus className="w-4 h-4" />Add Daily Entry</button>
        </form>
        {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : dailyEntries.length === 0 ? <div className="text-center py-8 text-gray-500">No daily entries yet</div> : (
          <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200"><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Date</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Bins</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Recorded By</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Remarks</th><th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Action</th></tr></thead><tbody>
            {dailyEntries.map(entry => (<tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50 transition"><td className="py-2 px-3 text-sm text-gray-900">{new Date(entry.date).toLocaleDateString()}</td><td className="py-2 px-3 text-sm text-gray-900 font-medium">{entry.number_of_bins}</td><td className="py-2 px-3 text-sm text-gray-700">{entry.recorded_by}</td><td className="py-2 px-3 text-sm text-gray-600">{entry.remarks || '-'}</td><td className="py-2 px-3 text-right"><button onClick={() => deleteDailyEntry(entry.id)} className="p-1 text-gray-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4" /></button></td></tr>))}
          </tbody></table></div>
        )}
      </div>

      {/* Batch Loading & Harvesting */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><Layers className="w-5 h-5 text-blue-600" /></div><h2 className="text-xl font-bold text-gray-900">Batch Loading & Harvesting</h2></div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {(Object.keys(BIN_STATUS_LABELS) as BinStatus[]).map(status => {
            const colors = BIN_STATUS_COLORS[status];
            return <div key={status} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg} ${colors.text} text-xs font-medium`}><span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>{BIN_STATUS_LABELS[status]}</div>;
          })}
        </div>

        {/* Action bar */}
        {actionMode && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-blue-800">{actionMode === 'loading' ? 'Loading' : 'Harvesting'} Mode</span>
                <span className="text-sm text-gray-600">{selectedBins.size} bins selected</span>
                {actionMode === 'loading' && <input type="number" min="0" step="0.1" placeholder="Weight per bin (kg)" value={weightInput} onChange={e => setWeightInput(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40" />}
              </div>
              <div className="flex gap-2">
                <button onClick={executeAction} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium"><Check className="w-4 h-4" />Confirm {actionMode}</button>
                {actionMode === 'harvesting' && <button onClick={markCompleted} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition font-medium"><Check className="w-4 h-4" />Mark Completed</button>}
                <button onClick={() => { setActionMode(null); setSelectedBins(new Set()); }} className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition font-medium"><X className="w-4 h-4" />Cancel</button>
              </div>
            </div>
          </div>
        )}

        {!actionMode && (
          <div className="flex gap-2 mb-4">
            <button onClick={() => setActionMode('loading')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"><Package className="w-4 h-4" />Start Loading</button>
            <button onClick={() => setActionMode('harvesting')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"><Layers className="w-4 h-4" />Start Harvesting</button>
          </div>
        )}

        {batches.length === 0 ? <div className="text-center py-8 text-gray-500">No batches created for this community yet.</div> : (
          <div className="space-y-4">
            {batches.map(batch => {
              const batchBins = binsByBatch(batch.id);
              return (
                <div key={batch.id} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 bg-gray-50">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3"><h3 className="text-base font-semibold text-gray-900">{batch.batch_number || 'Untitled Batch'}</h3><span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${batch.status === 'loading' ? 'bg-blue-100 text-blue-800' : batch.status === 'harvesting' ? 'bg-green-100 text-green-800' : batch.status === 'maintenance' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>{batch.status}</span></div>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                        {batchBins.length > 0 && (Object.keys(BIN_STATUS_LABELS) as BinStatus[]).map(s => { const cnt = getStatusCount(batch.id, s); if (cnt === 0) return null; const colors = BIN_STATUS_COLORS[s]; return <span key={s} className={`px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>{BIN_STATUS_LABELS[s]}: {cnt}</span>; })}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-white">
                    {batchBins.length === 0 ? <p className="text-sm text-gray-500">No bins in this batch</p> : (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {batchBins.map(bin => {
                          const colors = BIN_STATUS_COLORS[bin.bin_status as BinStatus] ?? BIN_STATUS_COLORS.available;
                          const isSelected = selectedBins.has(bin.id);
                          const isSelectable = actionMode !== null;
                          return (
                            <button
                              key={bin.id}
                              onClick={() => isSelectable && toggleBinSelection(bin.id)}
                              disabled={!isSelectable}
                              className={`p-3 border-2 rounded-lg text-center transition ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : colors.card} ${isSelectable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
                            >
                              <p className="text-sm font-semibold text-gray-900">Bin {bin.bin_number ?? '?'}</p>
                              <p className="text-xs text-gray-600 mt-1">{BIN_STATUS_LABELS[bin.bin_status as BinStatus] ?? bin.bin_status}</p>
                              {bin.current_weight_kg > 0 && <p className="text-xs text-gray-500 mt-0.5">{bin.current_weight_kg} kg</p>}
                              {isSelected && <div className="mt-1"><Check className="w-4 h-4 text-blue-600 mx-auto" /></div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
