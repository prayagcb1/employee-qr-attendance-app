import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ClipboardList, Plus, Trash2, X, Layers, Package } from 'lucide-react';

interface Community {
  id: string;
  name: string;
  wet_waste_bin_size_liters: number;
  waste_density_kg_per_ltr: number;
  bins_per_batch: number;
}

interface Batch {
  id: string;
  community_id: string;
  batch_number: string;
  status: 'loading' | 'harvesting' | 'maintenance' | 'completed';
}

interface Bin {
  id: string;
  bin_code: string;
  site_id: string | null;
  bin_status: string;
  capacity_liters: number;
}

interface BatchBinAssignment {
  id: string;
  batch_id: string;
  bin_id: string;
  selected: boolean;
  bins: Bin | null;
}

interface DailyEntry {
  id: string;
  community_id: string;
  date: string;
  number_of_bins: number;
  recorded_by: string;
  remarks: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  loading: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-500' },
  harvesting: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-300', dot: 'bg-green-500' },
  maintenance: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300', dot: 'bg-orange-500' },
  completed: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-300', dot: 'bg-gray-400' },
};

const FRACTION_OPTIONS = ['0.5', '1', '1.25', '1.5', '1.75', '2', '2.5', '3', '3.5', '4', '5'];

const todayDate = () => new Date().toISOString().split('T')[0];

export function DailyMonitoring() {
  const { employee } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [assignments, setAssignments] = useState<BatchBinAssignment[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wet waste entry form
  const [wwBins, setWwBins] = useState('');
  const [wwDate, setWwDate] = useState(todayDate());
  const [wwRemarks, setWwRemarks] = useState('');

  // Batch management
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [showBinPicker, setShowBinPicker] = useState<string | null>(null);

  useEffect(() => {
    fetchCommunities();
  }, []);

  useEffect(() => {
    if (selectedCommunity) {
      fetchCommunityData(selectedCommunity);
    }
  }, [selectedCommunity]);

  const fetchCommunities = async () => {
    const { data, error: err } = await supabase.from('communities').select('*').eq('active', true).order('name');
    if (err) { setError(err.message); setLoading(false); return; }
    setCommunities((data ?? []) as Community[]);
    if (data && data.length > 0 && !selectedCommunity) {
      setSelectedCommunity((data[0] as { id: string }).id);
    }
    setLoading(false);
  };

  const fetchCommunityData = async (communityId: string) => {
    setLoading(true);
    const [batchesRes, binsRes, dailyRes] = await Promise.all([
      supabase.from('community_batches').select('*').eq('community_id', communityId).order('created_at', { ascending: false }),
      supabase.from('bins').select('id, bin_code, site_id, bin_status, capacity_liters').order('bin_code'),
      supabase.from('daily_wet_waste_entries').select('*').eq('community_id', communityId).order('date', { ascending: false }).limit(30),
    ]);

    if (batchesRes.error || binsRes.error || dailyRes.error) {
      setError(batchesRes.error?.message || binsRes.error?.message || dailyRes.error?.message || null);
      setLoading(false);
      return;
    }

    const batchList = (batchesRes.data ?? []) as Batch[];
    const binList = (binsRes.data ?? []) as Bin[];
    setBatches(batchList);
    setBins(binList);
    setDailyEntries((dailyRes.data ?? []) as DailyEntry[]);

    // Fetch assignments for all batches
    if (batchList.length > 0) {
      const { data: assignData, error: assignErr } = await supabase
        .from('batch_bin_assignments')
        .select('*, bins(id, bin_code, site_id, bin_status, capacity_liters)')
        .in('batch_id', batchList.map(b => b.id));
      if (assignErr) { setError(assignErr.message); setLoading(false); return; }
      setAssignments((assignData ?? []) as BatchBinAssignment[]);
    } else {
      setAssignments([]);
    }

    setError(null);
    setLoading(false);
  };

  const submitWetWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !selectedCommunity || !wwBins) { setError('Please fill in all required fields.'); return; }

    const { error: err } = await supabase.from('daily_wet_waste_entries').insert({
      community_id: selectedCommunity,
      date: wwDate,
      number_of_bins: parseFloat(wwBins),
      employee_id: employee.id,
      recorded_by: employee.full_name,
      remarks: wwRemarks.trim(),
    });

    if (err) { setError(err.message); return; }
    setWwBins('');
    setWwRemarks('');
    fetchCommunityData(selectedCommunity);
  };

  const deleteDailyEntry = async (id: string) => {
    if (!confirm('Delete this daily entry?')) return;
    const { error: err } = await supabase.from('daily_wet_waste_entries').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    if (selectedCommunity) fetchCommunityData(selectedCommunity);
  };

  const toggleBinSelection = async (assignmentId: string, currentSelected: boolean) => {
    const { error: err } = await supabase
      .from('batch_bin_assignments')
      .update({ selected: !currentSelected })
      .eq('id', assignmentId);
    if (err) { setError(err.message); return; }
    if (selectedCommunity) fetchCommunityData(selectedCommunity);
  };

  const addBinToBatch = async (batchId: string, binId: string) => {
    const { error: err } = await supabase.from('batch_bin_assignments').insert({
      batch_id: batchId,
      bin_id: binId,
      selected: true,
    });
    if (err) { setError(err.message); return; }
    if (selectedCommunity) fetchCommunityData(selectedCommunity);
  };

  const removeBinFromBatch = async (assignmentId: string) => {
    const { error: err } = await supabase.from('batch_bin_assignments').delete().eq('id', assignmentId);
    if (err) { setError(err.message); return; }
    if (selectedCommunity) fetchCommunityData(selectedCommunity);
  };

  const updateBatchStatus = async (batch: Batch, status: Batch['status']) => {
    const { error: err } = await supabase.from('community_batches').update({ status }).eq('id', batch.id);
    if (err) { setError(err.message); return; }
    if (selectedCommunity) fetchCommunityData(selectedCommunity);
  };

  const community = communities.find(c => c.id === selectedCommunity);
  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  const binsForBatch = (batchId: string) => assignments.filter(a => a.batch_id === batchId);
  const assignedBinIds = new Set(assignments.map(a => a.bin_id));
  const availableBins = bins.filter(b => !assignedBinIds.has(b.id));

  return (
    <div className="space-y-4">
      {/* Community selector */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-semibold text-gray-700">Select Community:</label>
          <select
            value={selectedCommunity || ''}
            onChange={e => setSelectedCommunity(e.target.value || null)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[200px]"
          >
            {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {community && (
            <div className="flex flex-wrap gap-3 text-xs text-gray-600">
              <span className="px-2 py-1 bg-blue-50 rounded">Bin: {community.wet_waste_bin_size_liters}L</span>
              <span className="px-2 py-1 bg-teal-50 rounded">Density: {community.waste_density_kg_per_ltr} kg/L</span>
              <span className="px-2 py-1 bg-indigo-50 rounded">Batch: {community.bins_per_batch} bins</span>
            </div>
          )}
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {/* Daily Wet Waste Entry */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Daily Wet Waste Monitoring</h2>
        </div>

        <form onSubmit={submitWetWaste} className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Bins</label>
              <select value={wwBins} onChange={e => setWwBins(e.target.value)} className={inputCls}>
                <option value="">Select count</option>
                {FRACTION_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">Supports fractions (0.5, 1.25, etc.)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={wwDate} onChange={e => setWwDate(e.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <input type="text" value={wwRemarks} onChange={e => setWwRemarks(e.target.value)} placeholder="Optional notes" className={inputCls} />
            </div>
          </div>
          <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm">
            <Plus className="w-4 h-4" />Add Daily Entry
          </button>
        </form>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : dailyEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No daily entries yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Bins</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Recorded By</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Remarks</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {dailyEntries.map(entry => (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-2 px-3 text-sm text-gray-900">{new Date(entry.date).toLocaleDateString()}</td>
                    <td className="py-2 px-3 text-sm text-gray-900 font-medium">{entry.number_of_bins}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.recorded_by}</td>
                    <td className="py-2 px-3 text-sm text-gray-600">{entry.remarks || '-'}</td>
                    <td className="py-2 px-3 text-right">
                      <button onClick={() => deleteDailyEntry(entry.id)} className="p-1 text-gray-400 hover:text-red-600 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch Management */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Layers className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Batch Loading & Harvesting</h2>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg} ${colors.text} text-xs font-medium capitalize`}>
              <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
              {status}
            </div>
          ))}
        </div>

        {batches.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No batches created for this community yet. Create batches in Community Management.</div>
        ) : (
          <div className="space-y-3">
            {batches.map(batch => {
              const batchBins = binsForBatch(batch.id);
              const colors = STATUS_COLORS[batch.status];
              const isExpanded = expandedBatch === batch.id;
              return (
                <div key={batch.id} className={`border-2 rounded-lg overflow-hidden ${colors.border}`}>
                  <div className={`p-4 ${colors.bg}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${colors.dot}`}></span>
                        <h3 className="text-base font-semibold text-gray-900">{batch.batch_number || 'Untitled Batch'}</h3>
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text} border ${colors.border} capitalize`}>
                          {batch.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={batch.status}
                          onChange={e => updateBatchStatus(batch, e.target.value as Batch['status'])}
                          className="px-2 py-1 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 cursor-pointer"
                        >
                          <option value="loading">Loading</option>
                          <option value="harvesting">Harvesting</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button
                          onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}
                          className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition"
                        >
                          {isExpanded ? 'Hide Bins' : `Show Bins (${batchBins.length})`}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                          <Package className="w-4 h-4" />Bins in Batch ({batchBins.length})
                        </h4>
                        {availableBins.length > 0 && (
                          <button
                            onClick={() => setShowBinPicker(showBinPicker === batch.id ? null : batch.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition font-medium"
                          >
                            <Plus className="w-3 h-3" />Add Bin to Batch
                          </button>
                        )}
                      </div>

                      {showBinPicker === batch.id && availableBins.length > 0 && (
                        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Available bins (not assigned to any batch):</p>
                          <div className="flex flex-wrap gap-2">
                            {availableBins.map(bin => (
                              <button
                                key={bin.id}
                                onClick={() => addBinToBatch(batch.id, bin.id)}
                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition"
                              >
                                {bin.bin_code}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {batchBins.length === 0 ? (
                        <p className="text-sm text-gray-500">No bins assigned to this batch yet.</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {batchBins.map(assignment => (
                            <div
                              key={assignment.id}
                              className={`p-3 border rounded-lg text-center transition ${
                                assignment.selected
                                  ? 'bg-white border-gray-300'
                                  : 'bg-gray-100 border-gray-200 opacity-50'
                              }`}
                            >
                              <p className="text-sm font-medium text-gray-900">{assignment.bins?.bin_code || 'Unknown'}</p>
                              <div className="flex items-center justify-center gap-1.5 mt-2">
                                <button
                                  onClick={() => toggleBinSelection(assignment.id, assignment.selected)}
                                  className={`px-2 py-0.5 text-xs font-medium rounded transition ${
                                    assignment.selected
                                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                  }`}
                                >
                                  {assignment.selected ? 'Selected' : 'Deselected'}
                                </button>
                                <button
                                  onClick={() => removeBinFromBatch(assignment.id)}
                                  className="p-0.5 text-gray-400 hover:text-red-600 transition"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 text-xs text-gray-500">
                        Selected: {batchBins.filter(a => a.selected).length} / {batchBins.length} bins
                        {community && ` (Batch target: ${community.bins_per_batch} bins)`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
