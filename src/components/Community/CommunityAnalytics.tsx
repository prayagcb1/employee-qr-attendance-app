import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Leaf, TrendingUp, Calendar } from 'lucide-react';

interface DailyEntry {
  date: string;
  number_of_bins: number;
}

interface CocopeatEntry {
  id: string;
  date: string;
  quantity_kg: number;
  bin_code: string;
}

export function CommunityAnalytics({ communityId }: { communityId: string }) {
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [cocopeatEntries, setCocopeatEntries] = useState<CocopeatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, [communityId]);

  const fetchData = async () => {
    setLoading(true);
    const [wwRes, ccRes] = await Promise.all([
      supabase.from('daily_wet_waste_entries').select('date, number_of_bins').eq('community_id', communityId).order('date', { ascending: false }).limit(30),
      supabase.from('cocopeat_usage_entries').select('id, date, quantity_kg, bin_code').eq('community_id', communityId).order('date', { ascending: false }).limit(50),
    ]);

    if (wwRes.error || ccRes.error) {
      setError(wwRes.error?.message || ccRes.error?.message || null);
    } else {
      setDailyEntries((wwRes.data ?? []) as DailyEntry[]);
      setCocopeatEntries((ccRes.data ?? []) as CocopeatEntry[]);
      setError(null);
    }
    setLoading(false);
  };

  const wetWasteByDate = dailyEntries.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = 0;
    acc[entry.date] += entry.number_of_bins;
    return acc;
  }, {} as Record<string, number>);

  const wetWasteChart = Object.entries(wetWasteByDate)
    .map(([date, totalBins]) => ({ date, totalBins }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);
  const maxBins = Math.max(...wetWasteChart.map(d => d.totalBins), 1);

  const cocopeatByBin = cocopeatEntries.reduce((acc, entry) => {
    const key = entry.bin_code || 'Unassigned';
    if (!acc[key]) acc[key] = { total_kg: 0, entries: 0 };
    acc[key].total_kg += entry.quantity_kg;
    acc[key].entries += 1;
    return acc;
  }, {} as Record<string, { total_kg: number; entries: number }>);

  const cocopeatBins = Object.entries(cocopeatByBin)
    .map(([bin_code, v]) => ({ bin_code, ...v }))
    .sort((a, b) => b.total_kg - a.total_kg);
  const maxCocopeat = Math.max(...cocopeatBins.map(b => b.total_kg), 1);

  const totalBins = dailyEntries.reduce((sum, e) => sum + e.number_of_bins, 0);
  const totalCocopeat = cocopeatEntries.reduce((sum, e) => sum + e.quantity_kg, 0);
  const avgBinsPerDay = wetWasteChart.length > 0 ? (totalBins / wetWasteChart.length).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center"><TrendingUp className="w-4 h-4 text-green-600" /></div>
            <span className="text-sm font-medium text-gray-600">Total Wet Waste Bins</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalBins}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center"><Leaf className="w-4 h-4 text-teal-600" /></div>
            <span className="text-sm font-medium text-gray-600">Total Cocopeat Used</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalCocopeat} kg</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center"><Calendar className="w-4 h-4 text-blue-600" /></div>
            <span className="text-sm font-medium text-gray-600">Avg Bins / Day</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{avgBinsPerDay}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center"><BarChart className="w-5 h-5 text-green-600" /></div>
          <h2 className="text-xl font-bold text-gray-900">Wet Waste Bins - Daily Trend</h2>
        </div>
        {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : wetWasteChart.length === 0 ? <div className="text-center py-8 text-gray-500">No data available</div> : (
          <div className="space-y-2">
            {wetWasteChart.map(d => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-24 flex-shrink-0">{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <div className="flex-1 bg-gray-100 rounded-lg h-7 overflow-hidden">
                  <div className="bg-green-500 h-full rounded-lg flex items-center justify-end pr-2 transition-all" style={{ width: `${(d.totalBins / maxBins) * 100}%`, minWidth: '2rem' }}>
                    <span className="text-xs font-semibold text-white">{d.totalBins}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center"><Leaf className="w-5 h-5 text-teal-600" /></div>
          <h2 className="text-xl font-bold text-gray-900">Cocopeat Usage by Bin</h2>
        </div>
        {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : cocopeatBins.length === 0 ? <div className="text-center py-8 text-gray-500">No cocopeat usage recorded</div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Bin Code</th>
                <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Total (kg)</th>
                <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Entries</th>
                <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Usage</th>
              </tr></thead>
              <tbody>
                {cocopeatBins.map(bin => (
                  <tr key={bin.bin_code} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-2 px-3 text-sm font-medium text-gray-900">{bin.bin_code}</td>
                    <td className="py-2 px-3 text-sm text-gray-900 font-semibold">{bin.total_kg} kg</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{bin.entries}</td>
                    <td className="py-2 px-3"><div className="bg-gray-100 rounded-lg h-5 overflow-hidden w-32"><div className="bg-teal-500 h-full rounded-lg" style={{ width: `${(bin.total_kg / maxCocopeat) * 100}%` }}></div></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
