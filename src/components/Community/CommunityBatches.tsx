import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Layers, Package, X, Wrench, History, ChevronDown, ChevronUp } from 'lucide-react';
import { BIN_STATUS_LABELS, BIN_STATUS_COLORS, MAINTENANCE_ISSUE_TYPES, MAINTENANCE_STATUS_LABELS, MAINTENANCE_STATUS_COLORS, type BinStatus } from '../../lib/binStatus';
import type { PermissionConfig } from '../../lib/communityPermissions';

interface Batch {
  id: string;
  community_id: string;
  batch_number: string;
  status: 'loading' | 'harvesting' | 'maintenance' | 'completed';
  start_date: string | null;
  expected_harvest_date: string | null;
  created_at: string;
}

interface Bin {
  id: string;
  bin_code: string;
  bin_status: string;
  capacity_liters: number;
  current_weight_kg: number;
  bin_number: number | null;
  notes: string;
  last_activity: string | null;
}

interface MaintenanceRecord {
  id: string;
  bin_id: string;
  issue_type: string;
  issue_description: string;
  resolution_description: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export function CommunityBatches({ communityId, permissions }: { communityId: string; permissions: PermissionConfig }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Maintenance form
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintForm, setMaintForm] = useState({ issue_type: 'broken_handle', issue_description: '' });

  // Bin status change
  const [showStatusChange, setShowStatusChange] = useState(false);

  useEffect(() => { fetchBatches(); }, [communityId]);

  const fetchBatches = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('community_batches')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setBatches((data ?? []) as Batch[]);
    setError(null);
    setLoading(false);
  };

  const fetchBinsForBatch = async (batchId: string) => {
    const { data, error: err } = await supabase
      .from('bins')
      .select('id, bin_code, bin_status, capacity_liters, current_weight_kg, bin_number, notes, last_activity')
      .eq('batch_id', batchId)
      .order('bin_number', { ascending: true });
    if (err) { setError(err.message); return; }
    setBins((data ?? []) as Bin[]);
  };

  const fetchMaintenanceHistory = async (binId: string) => {
    const { data, error: err } = await supabase
      .from('bin_maintenance_history')
      .select('*')
      .eq('bin_id', binId)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); return; }
    setMaintenanceRecords((data ?? []) as MaintenanceRecord[]);
  };

  const toggleBatch = (batchId: string) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      setBins([]);
      return;
    }
    setExpandedBatch(batchId);
    fetchBinsForBatch(batchId);
  };

  const openBinDetails = (bin: Bin) => {
    setSelectedBin(bin);
    fetchMaintenanceHistory(bin.id);
    setShowMaintenanceForm(false);
    setShowStatusChange(false);
  };

  const updateBinStatus = async (bin: Bin, status: BinStatus) => {
    const { error: err } = await supabase.from('bins').update({
      bin_status: status,
      last_activity: new Date().toISOString(),
    }).eq('id', bin.id);
    if (err) { setError(err.message); return; }

    await supabase.from('bin_status_history').insert({
      bin_id: bin.id,
      old_status: bin.bin_status,
      new_status: status,
      changed_by_type: 'community_user',
    } as any);

    if (expandedBatch) fetchBinsForBatch(expandedBatch);
    setSelectedBin(null);
    setShowStatusChange(false);
  };

  const submitMaintenance = async (bin: Bin) => {
    if (!maintForm.issue_description.trim()) { setError('Please describe the issue.'); return; }

    const { error: err } = await supabase.from('bin_maintenance_history').insert({
      bin_id: bin.id,
      issue_type: maintForm.issue_type,
      issue_description: maintForm.issue_description.trim(),
      status: 'open',
      reported_by_type: 'community_user',
    } as any);

    if (err) { setError(err.message); return; }

    // Set bin to maintenance status
    await supabase.from('bins').update({
      bin_status: 'maintenance',
      last_activity: new Date().toISOString(),
    }).eq('id', bin.id);

    await supabase.from('bin_status_history').insert({
      bin_id: bin.id,
      old_status: bin.bin_status,
      new_status: 'maintenance',
      changed_by_type: 'community_user',
      reason: maintForm.issue_description.trim(),
    } as any);

    setMaintForm({ issue_type: 'broken_handle', issue_description: '' });
    setShowMaintenanceForm(false);
    fetchMaintenanceHistory(bin.id);
    if (expandedBatch) fetchBinsForBatch(expandedBatch);
  };

  const resolveMaintenance = async (record: MaintenanceRecord) => {
    const { error: err } = await supabase.from('bin_maintenance_history').update({
      status: 'resolved',
      resolution_description: 'Issue resolved',
      resolved_at: new Date().toISOString(),
    }).eq('id', record.id);
    if (err) { setError(err.message); return; }

    // Set bin back to available
    if (selectedBin) {
      await supabase.from('bins').update({
        bin_status: 'available',
        last_activity: new Date().toISOString(),
      }).eq('id', selectedBin.id);
      await supabase.from('bin_status_history').insert({
        bin_id: selectedBin.id,
        old_status: 'maintenance',
        new_status: 'available',
        changed_by_type: 'community_user',
        reason: 'Maintenance resolved',
      } as any);
    }

    if (selectedBin) fetchMaintenanceHistory(selectedBin.id);
    if (expandedBatch) fetchBinsForBatch(expandedBatch);
  };

  const getStatusCount = (status: string) => {
    return bins.filter(b => b.bin_status === status).length;
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm';

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Layers className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Batch Status</h2>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading batches...</div>
        ) : batches.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No batches created yet</div>
        ) : (
          <div className="space-y-3">
            {batches.map(batch => {
              const isExpanded = expandedBatch === batch.id;
              return (
                <div key={batch.id} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleBatch(batch.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold text-gray-900">{batch.batch_number || 'Untitled Batch'}</h3>
                        <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 capitalize">{batch.status}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {batch.start_date && <span className="text-xs text-gray-500">Start: {new Date(batch.start_date).toLocaleDateString()}</span>}
                        {batch.expected_harvest_date && <span className="text-xs text-gray-500">Harvest: {new Date(batch.expected_harvest_date).toLocaleDateString()}</span>}
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-gray-50 border-t border-gray-200">
                      {/* Bin status summary */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {bins.length > 0 && Object.entries(BIN_STATUS_LABELS).map(([status, label]) => {
                          const count = getStatusCount(status);
                          if (count === 0) return null;
                          const colors = BIN_STATUS_COLORS[status as BinStatus];
                          return (
                            <div key={status} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg} ${colors.text} text-xs font-medium`}>
                              <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
                              {label}: {count}
                            </div>
                          );
                        })}
                        {bins.length === 0 && <p className="text-sm text-gray-500">No bins in this batch</p>}
                      </div>

                      {/* Bin grid */}
                      {bins.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {bins.map(bin => {
                            const colors = BIN_STATUS_COLORS[bin.bin_status as BinStatus] ?? BIN_STATUS_COLORS.available;
                            return (
                              <button
                                key={bin.id}
                                onClick={() => openBinDetails(bin)}
                                className={`p-3 border-2 rounded-lg text-center transition hover:shadow-md ${colors.card}`}
                              >
                                <p className="text-sm font-semibold text-gray-900">{bin.bin_code}</p>
                                <p className="text-xs text-gray-600 mt-1">{bin.bin_status && BIN_STATUS_LABELS[bin.bin_status as BinStatus] || 'Unknown'}</p>
                                {bin.current_weight_kg > 0 && <p className="text-xs text-gray-500 mt-0.5">{bin.current_weight_kg} kg</p>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bin detail modal */}
      {selectedBin && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center p-2 sm:p-4">
            <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-lg my-2 sm:my-6 overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{selectedBin.bin_code}</h2>
                    <p className="text-xs text-gray-600">Bin #{selectedBin.bin_number ?? '-'} - {selectedBin.capacity_liters}L</p>
                  </div>
                </div>
                <button onClick={() => setSelectedBin(null)} className="text-gray-400 hover:text-gray-600 transition p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Current status */}
                <div className="p-3 bg-white border border-gray-200 rounded-lg">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Current Status</p>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${BIN_STATUS_COLORS[selectedBin.bin_status as BinStatus]?.bg ?? ''} ${BIN_STATUS_COLORS[selectedBin.bin_status as BinStatus]?.text ?? ''}`}>
                      {BIN_STATUS_LABELS[selectedBin.bin_status as BinStatus] ?? selectedBin.bin_status}
                    </span>
                    {selectedBin.current_weight_kg > 0 && <span className="text-sm text-gray-600">{selectedBin.current_weight_kg} kg</span>}
                  </div>
                  {selectedBin.last_activity && <p className="text-xs text-gray-500 mt-2">Last activity: {new Date(selectedBin.last_activity).toLocaleString()}</p>}
                  {selectedBin.notes && <p className="text-xs text-gray-600 mt-2">Notes: {selectedBin.notes}</p>}
                </div>

                {/* Status change */}
                {permissions.canManageBatches && (
                  <div className="p-3 bg-white border border-gray-200 rounded-lg">
                    <button
                      onClick={() => setShowStatusChange(!showStatusChange)}
                      className="w-full flex items-center justify-between text-sm font-semibold text-gray-700"
                    >
                      Change Status
                      <ChevronDown className={`w-4 h-4 transition ${showStatusChange ? 'rotate-180' : ''}`} />
                    </button>
                    {showStatusChange && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(Object.keys(BIN_STATUS_LABELS) as BinStatus[]).map(status => {
                          const colors = BIN_STATUS_COLORS[status];
                          return (
                            <button
                              key={status}
                              onClick={() => updateBinStatus(selectedBin, status)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${colors.bg} ${colors.text} hover:opacity-80`}
                            >
                              {BIN_STATUS_LABELS[status]}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Maintenance */}
                {permissions.canManageMaintenance && (
                  <div className="p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Wrench className="w-4 h-4" />Maintenance</p>
                      <button
                        onClick={() => setShowMaintenanceForm(!showMaintenanceForm)}
                        className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
                      >
                        {showMaintenanceForm ? 'Cancel' : '+ Report Issue'}
                      </button>
                    </div>

                    {showMaintenanceForm && (
                      <div className="mb-3 space-y-2">
                        <select value={maintForm.issue_type} onChange={e => setMaintForm({ ...maintForm, issue_type: e.target.value })} className={inputCls}>
                          {MAINTENANCE_ISSUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <input type="text" placeholder="Describe the issue" value={maintForm.issue_description} onChange={e => setMaintForm({ ...maintForm, issue_description: e.target.value })} className={inputCls} />
                        <button onClick={() => submitMaintenance(selectedBin)} className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm font-medium">Report Issue</button>
                      </div>
                    )}

                    {maintenanceRecords.length > 0 ? (
                      <div className="space-y-2">
                        {maintenanceRecords.map(rec => (
                          <div key={rec.id} className="p-2 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-700">{MAINTENANCE_ISSUE_TYPES.find(t => t.value === rec.issue_type)?.label ?? rec.issue_type}</span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${MAINTENANCE_STATUS_COLORS[rec.status] ?? ''}`}>{MAINTENANCE_STATUS_LABELS[rec.status] ?? rec.status}</span>
                            </div>
                            <p className="text-xs text-gray-600">{rec.issue_description}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(rec.created_at).toLocaleDateString()}</p>
                            {rec.status !== 'resolved' && permissions.canManageMaintenance && (
                              <button onClick={() => resolveMaintenance(rec)} className="mt-1 text-xs text-green-600 font-medium hover:text-green-700">Mark Resolved</button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 flex items-center gap-1"><History className="w-3 h-3" />No maintenance history</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
