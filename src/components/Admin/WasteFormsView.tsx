import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ClipboardList, Calendar, User, ChevronDown, ChevronUp, Filter, X, Trash2 } from 'lucide-react';

interface ScannedBin {
  binCode: string;
  binId: string;
  siteId: string;
  siteName: string;
}

interface WasteForm {
  id: string;
  employee_id: string;
  community: string;
  date: string;
  recorded_by: string;
  waste_segregated: boolean;
  total_bins_50kg: number;
  issues_identified: string[];
  composter_status: Record<string, string>;
  workflow_stage: string;
  scanned_bins: ScannedBin[];
  remarks: string;
  created_at: string;
  employees: {
    full_name: string;
    employee_code: string;
  };
}

export function WasteFormsView() {
  const [forms, setForms] = useState<WasteForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedForm, setExpandedForm] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    community: '',
    dateFrom: '',
    dateTo: '',
    recordedBy: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    setLoading(true);

    let query = supabase
      .from('waste_management_forms')
      .select(`
        *,
        employees (
          full_name,
          employee_code
        )
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.community) {
      query = query.eq('community', filters.community);
    }
    if (filters.dateFrom) {
      query = query.gte('date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('date', filters.dateTo);
    }
    if (filters.recordedBy) {
      query = query.eq('recorded_by', filters.recordedBy);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching waste forms:', fetchError);
      setError(`Failed to load waste forms: ${fetchError.message}`);
      setForms([]);
    } else if (data) {
      try {
        const normalizedData = data.map(form => ({
          ...form,
          issues_identified: typeof form.issues_identified === 'string'
            ? JSON.parse(form.issues_identified)
            : (form.issues_identified || []),
          composter_status: typeof form.composter_status === 'string'
            ? JSON.parse(form.composter_status)
            : (form.composter_status || {}),
          scanned_bins: typeof form.scanned_bins === 'string'
            ? JSON.parse(form.scanned_bins)
            : (form.scanned_bins || [])
        }));
        setForms(normalizedData);
        setError(null);
      } catch (err) {
        console.error('Error normalizing data:', err);
        setError('Failed to process waste forms data');
        setForms([]);
      }
    } else {
      setForms([]);
      setError(null);
    }
    setLoading(false);
  };

  const clearFilters = () => {
    setFilters({
      community: '',
      dateFrom: '',
      dateTo: '',
      recordedBy: '',
    });
  };

  const hasActiveFilters = filters.community || filters.dateFrom || filters.dateTo || filters.recordedBy;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleExpanded = (formId: string) => {
    setExpandedForm(expandedForm === formId ? null : formId);
  };

  const handleDelete = async (formId: string, community: string) => {
    if (!confirm(`Are you sure you want to delete the waste form for ${community}?\n\nThis action cannot be undone.`)) {
      return;
    }

    const { error } = await supabase
      .from('waste_management_forms')
      .delete()
      .eq('id', formId);

    if (error) {
      alert(`Failed to delete form: ${error.message}`);
    } else {
      alert('Form deleted successfully');
      fetchForms();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Waste Management Forms</h2>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              {Object.values(filters).filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Community</label>
              <input
                type="text"
                value={filters.community}
                onChange={(e) => setFilters({ ...filters, community: e.target.value })}
                placeholder="Filter by community"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recorded By</label>
              <input
                type="text"
                value={filters.recordedBy}
                onChange={(e) => setFilters({ ...filters, recordedBy: e.target.value })}
                placeholder="Filter by recorder"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={fetchForms}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Apply Filters
            </button>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  clearFilters();
                  fetchForms();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <p className="font-medium">Error:</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading forms...</div>
      ) : forms.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {error ? 'Unable to load forms' : 'No forms submitted yet'}
        </div>
      ) : (
        <div className="space-y-4">
          {forms.map((form) => (
            <div
              key={form.id}
              className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition"
            >
              <button
                onClick={() => toggleExpanded(form.id)}
                className="w-full p-4 text-left hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{form.community || 'N/A'}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded whitespace-nowrap">
                          {formatDate(form.date)}
                        </span>
                        {form.workflow_stage && (
                          <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-medium rounded whitespace-nowrap">
                            {form.workflow_stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded whitespace-nowrap ${
                          form.waste_segregated
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {form.waste_segregated ? 'Segregated' : 'Not Segregated'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1 truncate">
                        <User className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{form.employees.full_name} ({form.employees.employee_code})</span>
                      </span>
                      <span className="truncate">Recorded by: {form.recorded_by}</span>
                      <span className="whitespace-nowrap">Bins: {form.total_bins_50kg}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {expandedForm === form.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </button>

              {expandedForm === form.id && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  {form.scanned_bins && form.scanned_bins.length > 0 && (
                    <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                      <p className="text-sm font-semibold text-gray-900 mb-4">
                        Scanned Bins - {form.scanned_bins[0]?.siteName || form.community}
                      </p>

                      <div className="space-y-4">
                        {form.composter_status?.start_loaded && form.composter_status.start_loaded.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-2">Start Loaded</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {form.composter_status.start_loaded.map((binCode: string, idx: number) => (
                                <div
                                  key={idx}
                                  className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-center"
                                >
                                  <p className="text-sm font-medium text-blue-900">{binCode}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {form.composter_status?.harvest && form.composter_status.harvest.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-2">Harvest</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {form.composter_status.harvest.map((binCode: string, idx: number) => (
                                <div
                                  key={idx}
                                  className="px-3 py-2 bg-green-50 border border-green-200 rounded text-center"
                                >
                                  <p className="text-sm font-medium text-green-900">{binCode}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-sm font-semibold text-gray-800 mb-2">Issues Identified</p>
                      {form.issues_identified.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {form.issues_identified.map((issue) => (
                            <span
                              key={issue}
                              className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded"
                            >
                              {issue}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">No issues identified</p>
                      )}
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-sm font-semibold text-gray-800 mb-2">Remarks</p>
                      <p className="text-sm text-gray-900">{form.remarks}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Submitted: {formatDateTime(form.created_at)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDelete(form.id, form.community)}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition font-medium flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Form
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
