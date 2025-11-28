import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Calendar, User, MapPin, Trash2, Scale, Box } from 'lucide-react';

interface WasteForm {
  id: string;
  created_at: string;
  unit: string;
  bin_type: string;
  no_of_bins: number;
  weight: number;
  remarks: string | null;
  employees: {
    full_name: string;
    employee_code: string;
  };
  sites: {
    name: string;
    address: string;
  };
}

export function WasteFormsView() {
  const [forms, setForms] = useState<WasteForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    fetchForms();
  }, [filter]);

  const fetchForms = async () => {
    setLoading(true);

    let query = supabase
      .from('waste_forms')
      .select(`
        id,
        created_at,
        unit,
        bin_type,
        no_of_bins,
        weight,
        remarks,
        employees!inner (
          full_name,
          employee_code
        ),
        sites!inner (
          name,
          address
        )
      `)
      .order('created_at', { ascending: false });

    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('created_at', today.toISOString());
    } else if (filter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (filter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      query = query.gte('created_at', monthAgo.toISOString());
    }

    const { data, error } = await query;

    if (!error && data) {
      setForms(data);
    }
    setLoading(false);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getBinTypeLabel = (binType: string) => {
    const labels: { [key: string]: string } = {
      'dry_waste': 'Dry Waste',
      'wet_waste': 'Wet Waste',
      'rejected_waste': 'Rejected Waste',
      'sanitary_waste': 'Sanitary Waste',
      'e_waste': 'E-Waste',
      'compost': 'Compost',
    };
    return labels[binType] || binType;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold text-gray-900">Waste Management Forms</h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'today'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'week'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setFilter('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'month'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading forms...</div>
      ) : forms.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p>No waste management forms found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {forms.map((form) => (
            <div
              key={form.id}
              className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-start gap-2 mb-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{form.sites.name}</h3>
                      <p className="text-sm text-gray-600">{form.sites.address}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <User className="w-4 h-4" />
                    <span>{form.employees.full_name} ({form.employees.employee_code})</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(form.created_at)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-gray-700">Bin Type</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {getBinTypeLabel(form.bin_type)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-medium text-gray-700">Bins</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {form.no_of_bins}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-orange-600" />
                        <span className="text-xs font-medium text-gray-700">Weight</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {form.weight} {form.unit}
                      </span>
                    </div>
                  </div>

                  {form.remarks && (
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-xs font-medium text-gray-700 mb-1">Remarks</p>
                      <p className="text-sm text-gray-900">{form.remarks}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
