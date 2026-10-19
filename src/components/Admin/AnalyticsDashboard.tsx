import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Leaf, TrendingUp, Calendar } from 'lucide-react';

interface Community {
  id: string;
  name: string;
  site_id: string | null;
}

interface LoadingEntry {
  id: string;
  bin_code: string;
  waste_type: string;
  weight_loaded_kg: number;
  cocopeat_kg: number | null;
  loading_datetime: string;
  site_id: string | null;
}

interface DailyTotal {
  date: string;
  totalKg: number;
  binCount: number;
}

export function AnalyticsDashboard() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loadingEntries, setLoadingEntries] = useState<LoadingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCommunities();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedCommunity, dateFrom, dateTo, communities]);

  const fetchCommunities = async () => {
    const { data, error: communitiesError } = await supabase.from('communities').select('id, name, site_id').order('name');
    if (communitiesError) {
      setError(communitiesError.message);
      return;
    }
    setCommunities((data ?? []) as Community[]);
  };

  const fetchData = async () => {
    setLoading(true);

    let query = supabase
      .from('waste_loading_entries')
      .select('id, bin_code, waste_type, weight_loaded_kg, cocopeat_kg, loading_datetime, site_id')
      .order('loading_datetime', { ascending: false });

    if (selectedCommunity !== 'all') {
      const community = communities.find(c => c.id === selectedCommunity);
      if (community?.site_id) {
        query = query.eq('site_id', community.site_id);
      } else {
        setLoadingEntries([]);
        setLoading(false);
        return;
      }
    }
    if (dateFrom) {
      query = query.gte('loading_datetime', `${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      query = query.lte('loading_datetime', `${dateTo}T23:59:59`);
    }

    const { data, error: fetchError } = await query.limit(500);

    if (fetchError) {
      setError(fetchError.message);
      setLoadingEntries([]);
      setLoading(false);
      return;
    }

    setLoadingEntries((data ?? []) as LoadingEntry[]);
    setError(null);
    setLoading(false);
  };

  // Filter wet waste entries
  const wetWasteEntries = loadingEntries.filter(e => e.waste_type === 'wet_waste');

  // Aggregate wet waste by date
  const wetWasteByDate = wetWasteEntries.reduce((acc, entry) => {
    const dateKey = entry.loading_datetime.slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = { date: dateKey, totalKg: 0, binCount: 0 };
    acc[dateKey].totalKg += Number(entry.weight_loaded_kg) || 0;
    acc[dateKey].binCount += 1;
    return acc;
  }, {} as Record<string, DailyTotal>);

  const wetWasteChart = Object.values(wetWasteByDate).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  const maxWetWaste = Math.max(...wetWasteChart.map(d => d.totalKg), 1);

  // Aggregate cocopeat by bin
  const cocopeatByBin = loadingEntries
    .filter(e => e.cocopeat_kg !== null && e.cocopeat_kg > 0)
    .reduce((acc, entry) => {
      const key = entry.bin_code || 'Unassigned';
      if (!acc[key]) acc[key] = { bin_code: key, total_kg: 0, entries: 0 };
      acc[key].total_kg += Number(entry.cocopeat_kg) || 0;
      acc[key].entries += 1;
      return acc;
    }, {} as Record<string, { bin_code: string; total_kg: number; entries: number }>);

  const cocopeatBins = Object.values(cocopeatByBin).sort((a, b) => b.total_kg - a.total_kg);
  const maxCocopeat = Math.max(...cocopeatBins.map(b => b.total_kg), 1);

  // Totals
  const totalWetWasteKg = wetWasteEntries.reduce((sum, e) => sum + (Number(e.weight_loaded_kg) || 0), 0);
  const totalCocopeat = loadingEntries.reduce((sum, e) => sum + (Number(e.cocopeat_kg) || 0), 0);
  const uniqueDates = new Set(wetWasteEntries.map(e => e.loading_datetime.slice(0, 10)));
  const avgBinsPerDay = uniqueDates.size > 0 ? (wetWasteEntries.length / uniqueDates.size).toFixed(1) : '0';

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
            <span className="text-sm font-medium text-gray-600">Total Wet Waste</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalWetWasteKg.toFixed(1)} kg</p>
          <p className="text-xs text-gray-500 mt-1">{wetWasteEntries.length} bin loads</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center">
              <Leaf className="w-4 h-4 text-teal-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Total Cocopeat Used</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalCocopeat.toFixed(1)} kg</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Avg Bins / Day</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{avgBinsPerDay}</p>
          <p className="text-xs text-gray-500 mt-1">{uniqueDates.size} active days</p>
        </div>
      </div>

      {/* Wet waste chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <BarChart className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Wet Waste - Daily Trend</h2>
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
                    style={{ width: `${(d.totalKg / maxWetWaste) * 100}%`, minWidth: '2rem' }}
                  >
                    <span className="text-xs font-semibold text-white">{d.totalKg.toFixed(1)} kg</span>
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
          <div className="text-center py-8 text-gray-500">No cocopeat usage recorded for the selected filters</div>
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
                    <td className="py-2 px-3 text-sm text-gray-900 font-semibold">{bin.total_kg.toFixed(1)} kg</td>
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
