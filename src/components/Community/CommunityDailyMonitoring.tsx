import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import type { PermissionConfig } from '../../lib/communityPermissions';

interface DailyEntry {
  id: string;
  date: string;
  number_of_bins: number;
  recorded_by: string;
  remarks: string;
}

const FRACTION_OPTIONS = ['0.5', '1', '1.25', '1.5', '1.75', '2', '2.5', '3', '3.5', '4', '5'];
const todayDate = () => new Date().toISOString().split('T')[0];

export function CommunityDailyMonitoring({ communityId, permissions }: { communityId: string; permissions: PermissionConfig }) {
  const { communityUser } = useAuth();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wwBins, setWwBins] = useState('');
  const [wwDate, setWwDate] = useState(todayDate());
  const [wwRemarks, setWwRemarks] = useState('');

  useEffect(() => { fetchEntries(); }, [communityId]);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('daily_wet_waste_entries')
      .select('*')
      .eq('community_id', communityId)
      .order('date', { ascending: false })
      .limit(30);
    if (err) setError(err.message);
    else setEntries((data ?? []) as DailyEntry[]);
    setError(null);
    setLoading(false);
  };

  const submitWetWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!communityUser || !wwBins) { setError('Please fill in all required fields.'); return; }

    const { error: err } = await supabase.from('daily_wet_waste_entries').insert({
      community_id: communityId,
      date: wwDate,
      number_of_bins: parseFloat(wwBins),
      employee_id: null as any,
      recorded_by: communityUser.name,
      remarks: wwRemarks.trim(),
    } as any);

    if (err) { setError(err.message); return; }
    setWwBins('');
    setWwRemarks('');
    fetchEntries();
  };

  const deleteDailyEntry = async (id: string) => {
    if (!permissions.canEdit) return;
    if (!confirm('Delete this daily entry?')) return;
    const { error: err } = await supabase.from('daily_wet_waste_entries').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    fetchEntries();
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm';

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Daily Wet Waste Monitoring</h2>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {permissions.canEdit && (
        <form onSubmit={submitWetWaste} className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Bins</label>
              <select value={wwBins} onChange={e => setWwBins(e.target.value)} className={inputCls}>
                <option value="">Select count</option>
                {FRACTION_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
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
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : entries.length === 0 ? (
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
                {permissions.canEdit && <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Action</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="py-2 px-3 text-sm text-gray-900">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="py-2 px-3 text-sm text-gray-900 font-medium">{entry.number_of_bins}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">{entry.recorded_by}</td>
                  <td className="py-2 px-3 text-sm text-gray-600">{entry.remarks || '-'}</td>
                  {permissions.canEdit && (
                    <td className="py-2 px-3 text-right">
                      <button onClick={() => deleteDailyEntry(entry.id)} className="p-1 text-gray-400 hover:text-red-600 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
