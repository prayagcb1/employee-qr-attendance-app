import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Leaf, TrendingUp, Calendar } from 'lucide-react';

interface Community {
  id: string;
  name: string;
}

interface DailyEntry {
  date: string;
  number_of_bins: number;
  community_id: string;
  communities: { name: string } | null;
}

interface CocopeatEntry {
  id: string;
  date: string;
  quantity_kg: number;
  bin_code: string;
  community_id: string;
  communities: { name: string } | null;
}

interface CocopeatByBin {
  bin_code: string;
  total_kg: number;
  entries: number;
}

export function AnalyticsDashboard() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [cocopeatEntries, setCocopeatEntries] = useState<CocopeatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCommunities();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedCommunity, dateFrom, dateTo]);

  const fetchCommunities = async () => {
    const { data } = await supabase.from('communities').select('id, name').eq('active', true).order('name');
    setCommunities((data ?? []) as Community[]);
  };

  const fetchData = async () => {
    setLoading(true);

    let wwQuery = supabase.from('daily_wet_waste_entries')
      .select('date, number_of_bins, community_id, communities(name)')
      .order('date', { ascending: false }) as any;

    let ccQuery = supabase.from('cocopeat_usage_entries')
      .select('id, date, quantity_kg, bin_code, community_id, communities(name)')
      .order('date', { ascending: false }) as any;

    if (selectedCommunity !== 'all') {
      wwQuery = wwQuery.eq('community_id', selectedCommunity);
      ccQuery = ccQuery.eq('community_id', selectedCommunity);
    }
    if (dateFrom) {
      wwQuery = wwQuery.gte('date', dateFrom);
      ccQuery = ccQuery.gte('date', dateFrom);
    }
    if (dateTo) {
      wwQuery = wwQuery.lte('date', dateTo);
      ccQuery = ccQuery.lte('date', dateTo);
    }

    const [wwRes, ccRes] = await Promise.all([wwQuery.limit(100), ccQuery.limit(100)]);

    if (wwRes.error || ccRes.error) {
      setError(wwRes.error?.message || ccRes.error?.message);
      setDailyEntries([]);
      setCocopeatEntries([]);
      setLoading(false);
      return;
    }

    setDailyEntries((wwRes.data ?? []) as DailyEntry[]);
    setCocopeatEntries((ccRes.data ?? []) as CocopeatEntry[]);
    setError(null);
    setLoading(false);
  };

  // Aggregate wet waste by date
  const wetWasteByDate = dailyEntries.reduce((acc, entry) => {
    const dateKey = entry.date;
    if (!acc[dateKey]) acc[dateKey] = { date: dateKey, totalBins: 0, communityName: entry.communities?.name || '' };
    acc[dateKey].totalBins += entry.number_of_bins;
    return acc;
  }, {} as Record<string, { date: string; totalBins: number; communityName: string }>);

  const wetWasteChart = Object.values(wetWasteByDate).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  const maxBins = Math.max(...wetWasteChart.map(d => d.totalBins), 1);

  // Aggregate cocopeat by bin
  const cocopeatByBin = cocopeatEntries.reduce((acc, entry) => {
    const key = entry.bin_code || 'Unassigned';
    if (!acc[key]) acc[key] = { bin_code: key, total_kg: 0, entries: 0 };
    acc[key].total_kg += entry.quantity_kg;
    acc[key].entries += 1;
    return acc;
  }, {} as Record<string, CocopeatByBin>);

  const cocopeatBins = Object.values(cocopeatByBin).sort((a, b) => b.total_kg - a.total_kg);
  const maxCocopeat = Math.max(...cocopeatBins.map(b => b.total_kg), 1);

  // Totals
  const totalBins = dailyEntries.reduce((sum, e) => sum + e.number_of_bins, 0);
  const totalCocopeat = cocopeatEntries.reduce((sum, e) => sum + e.quantity_kg, 0);
  const avgBinsPerDay = wetWasteChart.length > 0 ? (totalBins / wetWasteChart.length).toFixed(1) : '0';

  const inputCls = 'px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Community</label>
            <select value={selectedCommunity} onChange={e => setSelectedCommunity(e.target.value)} className={inputCls + ' min-w-[180px]'}>
              <option value="all">All Communities</option>
              {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Total Wet Waste Bins</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalBins}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center">
              <Leaf className="w-4 h-4 text-teal-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Total Cocopeat Used</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalCocopeat} kg</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Avg Bins / Day</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{avgBinsPerDay}</p>
        </div>
      </div>

      {/* Wet waste chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <BarChart className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Wet Waste Bins - Daily Trend</h2>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : wetWasteChart.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No wet waste data for the selected filters</div>
        ) : (
          <div className="space-y-2">
            {wetWasteChart.map(d => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-24 flex-shrink-0">{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <div className="flex-1 bg-gray-100 rounded-lg h-7 overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-lg flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${(d.totalBins / maxBins) * 100}%`, minWidth: '2rem' }}
                  >
                    <span className="text-xs font-semibold text-white">{d.totalBins}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cocopeat by bin */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
            <Leaf className="w-5 h-5 text-teal-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Cocopeat Usage by Bin</h2>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : cocopeatBins.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No cocopeat usage recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Bin Code</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Total Cocopeat (kg)</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Entries</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Usage</th>
                </tr>
              </thead>
              <tbody>
                {cocopeatBins.map(bin => (
                  <tr key={bin.bin_code} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-2 px-3 text-sm font-medium text-gray-900">{bin.bin_code}</td>
                    <td className="py-2 px-3 text-sm text-gray-900 font-semibold">{bin.total_kg} kg</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{bin.entries}</td>
                    <td className="py-2 px-3">
                      <div className="bg-gray-100 rounded-lg h-5 overflow-hidden w-32">
                        <div className="bg-teal-500 h-full rounded-lg" style={{ width: `${(bin.total_kg / maxCocopeat) * 100}%` }}></div>
                      </div>
                    </td>
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
