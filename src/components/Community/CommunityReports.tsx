import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Download } from 'lucide-react';

interface DailyEntry { date: string; number_of_bins: number; recorded_by: string; remarks: string; }
interface BatchInfo { id: string; batch_number: string; status: string; start_date: string | null; expected_harvest_date: string | null; }

export function CommunityReports({ communityId }: { communityId: string }) {
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, [communityId]);

  const fetchAll = async () => {
    setLoading(true);
    const [wwRes, batchRes] = await Promise.all([
      supabase.from('daily_wet_waste_entries').select('date, number_of_bins, recorded_by, remarks').eq('community_id', communityId).order('date', { ascending: false }).limit(60),
      supabase.from('community_batches').select('*').eq('community_id', communityId).order('created_at', { ascending: false }),
    ]);
    if (wwRes.error || batchRes.error) { setError(wwRes.error?.message || batchRes.error?.message || null); }
    else { setDailyEntries((wwRes.data ?? []) as DailyEntry[]); setBatches((batchRes.data ?? []) as BatchInfo[]); setError(null); }
    setLoading(false);
  };

  const totalBins = dailyEntries.reduce((s, e) => s + e.number_of_bins, 0);

  const exportCSV = () => {
    const rows = [['Date', 'Number of Bins', 'Recorded By', 'Remarks'], ...dailyEntries.map(e => [e.date, String(e.number_of_bins), e.recorded_by, e.remarks])];
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `daily-wet-waste-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><FileText className="w-5 h-5 text-blue-600" /></div>
            <h2 className="text-xl font-bold text-gray-900">Reports</h2>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"><Download className="w-4 h-4" />Export CSV</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Total Entries</p><p className="text-2xl font-bold text-gray-900">{dailyEntries.length}</p></div>
          <div className="p-4 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Total Bins</p><p className="text-2xl font-bold text-gray-900">{totalBins}</p></div>
          <div className="p-4 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Total Batches</p><p className="text-2xl font-bold text-gray-900">{batches.length}</p></div>
        </div>

        <h3 className="text-sm font-semibold text-gray-800 mb-3">Daily Wet Waste Entries</h3>
        {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : dailyEntries.length === 0 ? <div className="text-center py-8 text-gray-500">No entries</div> : (
          <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200"><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Date</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Bins</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Recorded By</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Remarks</th></tr></thead><tbody>
            {dailyEntries.map((e, i) => (<tr key={i} className="border-b border-gray-100"><td className="py-2 px-3 text-sm text-gray-900">{new Date(e.date).toLocaleDateString()}</td><td className="py-2 px-3 text-sm text-gray-900 font-medium">{e.number_of_bins}</td><td className="py-2 px-3 text-sm text-gray-700">{e.recorded_by}</td><td className="py-2 px-3 text-sm text-gray-600">{e.remarks || '-'}</td></tr>))}
          </tbody></table></div>
        )}
      </div>
    </div>
  );
}
