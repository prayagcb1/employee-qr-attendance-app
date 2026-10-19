import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Download, Share2, Calendar, Package, Leaf, AlertTriangle, BarChart3 } from 'lucide-react';

interface Community {
  id: string;
  name: string;
  site_id: string | null;
  sites: { name: string } | null;
}

interface LoadingEntry {
  id: string;
  bin_code: string;
  waste_type: string;
  weight_loaded_kg: number;
  cocopeat_kg: number | null;
  loading_datetime: string;
  collector_name: string;
  remarks: string;
  form_id: string;
}

interface FormRecord {
  id: string;
  recorded_by: string;
  issues_identified: string[];
  remarks: string;
  created_at: string;
}

interface HarvestEntry {
  id: string;
  form_id: string;
  bin_code: string;
  compost_harvested_kg: number;
  harvest_date: string;
  compost_quality: string;
  moisture_level: string;
  remarks: string;
}

interface MaintenanceEntry {
  id: string;
  form_id: string;
  bin_code: string;
  maintenance_type: string;
  status: string;
  remarks: string;
}

const WASTE_TYPE_LABELS: Record<string, string> = {
  wet_waste: 'Wet Waste',
  dry_waste: 'Dry Waste',
  garden_waste: 'Garden Waste',
  food_waste: 'Food Waste',
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMondayOfWeek(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateInputValue(date);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function WeeklyReports() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(new Date().toISOString().slice(0, 10)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    loadingEntries: LoadingEntry[];
    forms: FormRecord[];
    harvestEntries: HarvestEntry[];
    maintenanceEntries: MaintenanceEntry[];
    community: Community;
  } | null>(null);

  useEffect(() => {
    const fetchCommunities = async () => {
      const { data } = await supabase
        .from('communities')
        .select('id, name, site_id, sites(name)')
        .order('name');
      setCommunities((data ?? []) as Community[]);
    };
    fetchCommunities();
  }, []);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReport(null);

    const community = communities.find(c => c.id === selectedCommunityId);
    if (!community) {
      setError('Please select a community.');
      setLoading(false);
      return;
    }
    if (!community.site_id) {
      setError('This community is not linked to a site.');
      setLoading(false);
      return;
    }

    try {
      const weekStartTs = `${weekStart}T00:00:00`;
      const weekEndTs = `${weekEnd}T23:59:59`;

      // Fetch loading entries for this site within the week
      const { data: loadingData, error: loadingErr } = await supabase
        .from('waste_loading_entries')
        .select('id, bin_code, waste_type, weight_loaded_kg, cocopeat_kg, loading_datetime, collector_name, remarks, form_id')
        .eq('site_id', community.site_id)
        .gte('loading_datetime', weekStartTs)
        .lte('loading_datetime', weekEndTs)
        .order('loading_datetime');

      if (loadingErr) throw loadingErr;

      const loadingEntries = (loadingData ?? []) as LoadingEntry[];
      const formIds = Array.from(new Set(loadingEntries.map(e => e.form_id).filter(Boolean)));

      // Fetch parent forms, harvest, and maintenance entries
      const [formsRes, harvestRes, maintenanceRes] = await Promise.all([
        formIds.length > 0
          ? supabase.from('waste_management_forms').select('id, recorded_by, issues_identified, remarks, created_at').in('id', formIds)
          : Promise.resolve({ data: [], error: null }),
        formIds.length > 0
          ? supabase.from('waste_harvest_entries').select('id, form_id, bin_code, compost_harvested_kg, harvest_date, compost_quality, moisture_level, remarks').in('form_id', formIds)
          : Promise.resolve({ data: [], error: null }),
        formIds.length > 0
          ? supabase.from('waste_maintenance_entries').select('id, form_id, bin_code, maintenance_type, status, remarks').in('form_id', formIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (formsRes.error || harvestRes.error || maintenanceRes.error) {
        throw formsRes.error || harvestRes.error || maintenanceRes.error;
      }

      const forms = ((formsRes.data ?? []) as FormRecord[]).map(f => ({
        ...f,
        issues_identified: typeof f.issues_identified === 'string' ? JSON.parse(f.issues_identified) : (f.issues_identified || []),
      }));

      setReport({
        loadingEntries,
        forms,
        harvestEntries: (harvestRes.data ?? []) as HarvestEntry[],
        maintenanceEntries: (maintenanceRes.data ?? []) as MaintenanceEntry[],
        community,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, [communities, selectedCommunityId, weekEnd, weekStart]);

  useEffect(() => {
    if (selectedCommunityId && communities.length > 0) {
      void generateReport();
    }
  }, [communities, generateReport, selectedCommunityId]);

  // Calculations
  const totalWetWasteKg = report ? report.loadingEntries.filter(e => e.waste_type === 'wet_waste').reduce((s, e) => s + (Number(e.weight_loaded_kg) || 0), 0) : 0;
  const totalCocopeat = report ? report.loadingEntries.reduce((s, e) => s + (Number(e.cocopeat_kg) || 0), 0) : 0;
  const uniqueBins = report ? new Set(report.loadingEntries.map(e => e.bin_code)).size : 0;
  const formCount = report ? report.forms.length : 0;

  const wasteByType = report ? report.loadingEntries.reduce((acc, e) => {
    acc[e.waste_type] = (acc[e.waste_type] ?? 0) + (Number(e.weight_loaded_kg) || 0);
    return acc;
  }, {} as Record<string, number>) : {};

  const dailyTotals = report ? report.loadingEntries.reduce((acc, e) => {
    const day = e.loading_datetime.slice(0, 10);
    acc[day] = (acc[day] ?? 0) + (Number(e.weight_loaded_kg) || 0);
    return acc;
  }, {} as Record<string, number>) : {};

  const allIssues = report ? report.forms.flatMap(f => f.issues_identified).filter(Boolean) : [];

  const downloadPDF = () => {
    if (!report) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 14;
    let y = margin;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Weekly Waste Management Report', margin, y); y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Community: ${report.community.name}`, margin, y); y += 5;
    doc.text(`Site: ${report.community.sites?.name ?? '—'}`, margin, y); y += 5;
    doc.text(`Week: ${formatDate(weekStart)} — ${formatDate(weekEnd)}`, margin, y); y += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y); y += 8;

    // Summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', margin, y); y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Form submissions: ${formCount}`, margin, y); y += 5;
    doc.text(`Unique bins loaded: ${uniqueBins}`, margin, y); y += 5;
    doc.text(`Total wet waste: ${totalWetWasteKg.toFixed(1)} kg`, margin, y); y += 5;
    doc.text(`Total cocopeat used: ${totalCocopeat.toFixed(1)} kg`, margin, y); y += 7;

    // Waste by type
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Waste Collected by Type', margin, y); y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    for (const [type, kg] of Object.entries(wasteByType)) {
      doc.text(`${WASTE_TYPE_LABELS[type] ?? formatLabel(type)}: ${kg.toFixed(1)} kg`, margin, y); y += 5;
    }
    y += 3;

    // Daily totals
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Collection Totals', margin, y); y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    for (const [day, kg] of Object.entries(dailyTotals).sort()) {
      doc.text(`${formatDate(day)}: ${kg.toFixed(1)} kg`, margin, y); y += 5;
    }
    y += 3;

    // Bin-wise table
    autoTable(doc, {
      startY: y,
      head: [['Bin', 'Type', 'Weight (kg)', 'Cocopeat (kg)', 'Loading Time', 'Collector']],
      body: report.loadingEntries.map(e => [
        e.bin_code,
        WASTE_TYPE_LABELS[e.waste_type] ?? formatLabel(e.waste_type),
        (Number(e.weight_loaded_kg) || 0).toFixed(1),
        e.cocopeat_kg ? (Number(e.cocopeat_kg)).toFixed(1) : '—',
        formatDateTime(e.loading_datetime),
        e.collector_name || '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
    });

    // Issues
    const afterTable = (doc as any).lastAutoTable?.finalY ?? y + 10;
    y = afterTable + 8;
    if (allIssues.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Issues Identified', margin, y); y += 5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      for (const issue of allIssues) {
        doc.text(`- ${issue}`, margin + 2, y); y += 5;
      }
    }

    // Harvest
    if (report.harvestEntries.length > 0) {
      y += 3;
      autoTable(doc, {
        startY: y,
        head: [['Bin', 'Compost (kg)', 'Date', 'Quality', 'Moisture']],
        body: report.harvestEntries.map(e => [
          e.bin_code,
          (Number(e.compost_harvested_kg) || 0).toFixed(1),
          e.harvest_date,
          formatLabel(e.compost_quality),
          formatLabel(e.moisture_level),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [234, 179, 8], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable?.finalY ?? y + 10;
      y += 8;
    }

    // Maintenance
    if (report.maintenanceEntries.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Bin', 'Type', 'Status', 'Remarks']],
        body: report.maintenanceEntries.map(e => [
          e.bin_code,
          formatLabel(e.maintenance_type),
          formatLabel(e.status),
          e.remarks || '—',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: margin, right: margin },
      });
    }

    doc.save(`weekly-report-${report.community.name}-${weekStart}.pdf`);
  };

  const shareReport = async () => {
    if (!report) return;
    downloadPDF();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Weekly Waste Report - ${report.community.name} (${formatDate(weekStart)} — ${formatDate(weekEnd)})`,
          text: `Weekly waste management report for ${report.community.name}. PDF has been downloaded.`,
        });
      } catch {
        // User cancelled or share failed — download fallback already triggered
      }
    }
  };

  const inputCls = 'px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Community</label>
            <select value={selectedCommunityId} onChange={e => setSelectedCommunityId(e.target.value)} className={inputCls + ' min-w-[180px]'}>
              <option value="">Select a community</option>
              {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Week Starting (Monday)</label>
            <input type="date" value={weekStart} onChange={e => setWeekStart(getMondayOfWeek(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Week Ending (Sunday)</label>
            <input type="date" value={weekEnd} disabled className={inputCls + ' bg-gray-50 text-gray-500'} />
          </div>
          <button
            onClick={generateReport}
            disabled={loading || !selectedCommunityId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {/* Report display */}
      {report && (
        <>
          {/* Report header */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Weekly Waste Management Report</h2>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                  <span><span className="font-medium">Community:</span> {report.community.name}</span>
                  <span><span className="font-medium">Site:</span> {report.community.sites?.name ?? '—'}</span>
                  <span><span className="font-medium">Week:</span> {formatDate(weekStart)} — {formatDate(weekEnd)}</span>
                  <span><span className="font-medium">Generated:</span> {new Date().toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadPDF} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition text-sm font-medium">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <button onClick={shareReport} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>
            </div>
          </div>

          {report.loadingEntries.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No waste collection data found for this community during the selected week.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">Submissions</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formCount}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                      <Package className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">Unique Bins</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{uniqueBins}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">Total Wet Waste</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{totalWetWasteKg.toFixed(1)} kg</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center">
                      <Leaf className="w-4 h-4 text-teal-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">Cocopeat Used</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{totalCocopeat.toFixed(1)} kg</p>
                </div>
              </div>

              {/* Waste by type */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Waste Collection by Type</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(wasteByType).map(([type, kg]) => (
                    <div key={type} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-500">{WASTE_TYPE_LABELS[type] ?? formatLabel(type)}</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{kg.toFixed(1)} kg</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily totals */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Daily Collection Totals</h3>
                {Object.keys(dailyTotals).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(dailyTotals).sort().map(([day, kg]) => (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-28 flex-shrink-0">{formatDate(day)}</span>
                        <div className="flex-1 bg-gray-100 rounded-lg h-6 overflow-hidden">
                          <div className="bg-green-500 h-full rounded-lg flex items-center justify-end pr-2" style={{ width: `${(kg / Math.max(...Object.values(dailyTotals), 1)) * 100}%`, minWidth: '2rem' }}>
                            <span className="text-xs font-semibold text-white">{kg.toFixed(1)} kg</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-500">No daily data</p>}
              </div>

              {/* Bin-wise details */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Bin-wise Waste Collection Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Bin</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Waste Type</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Weight (kg)</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Cocopeat (kg)</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Loading Time</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Collector</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.loadingEntries.map(entry => {
                        const form = report.forms.find(f => f.id === entry.form_id);
                        return (
                          <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                            <td className="py-2 px-3 text-sm font-medium text-gray-900">{entry.bin_code}</td>
                            <td className="py-2 px-3 text-sm text-gray-700">{WASTE_TYPE_LABELS[entry.waste_type] ?? formatLabel(entry.waste_type)}</td>
                            <td className="py-2 px-3 text-sm text-gray-900 font-semibold">{(Number(entry.weight_loaded_kg) || 0).toFixed(1)}</td>
                            <td className="py-2 px-3 text-sm text-gray-700">{entry.cocopeat_kg ? (Number(entry.cocopeat_kg)).toFixed(1) : '—'}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">{formatDateTime(entry.loading_datetime)}</td>
                            <td className="py-2 px-3 text-sm text-gray-700">{entry.collector_name || '—'}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">
                              {entry.remarks || '—'}
                              {form && <span className="block text-xs text-gray-400 mt-0.5">By: {form.recorded_by}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Harvest details */}
              {report.harvestEntries.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Leaf className="w-5 h-5 text-yellow-600" />Harvest Details</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Bin</th>
                          <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Compost (kg)</th>
                          <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Date</th>
                          <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Quality</th>
                          <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Moisture</th>
                          <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.harvestEntries.map(e => (
                          <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                            <td className="py-2 px-3 text-sm font-medium text-gray-900">{e.bin_code}</td>
                            <td className="py-2 px-3 text-sm text-gray-900 font-semibold">{(Number(e.compost_harvested_kg) || 0).toFixed(1)}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">{e.harvest_date}</td>
                            <td className="py-2 px-3 text-sm text-gray-700">{formatLabel(e.compost_quality)}</td>
                            <td className="py-2 px-3 text-sm text-gray-700">{formatLabel(e.moisture_level)}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">{e.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Maintenance details */}
              {report.maintenanceEntries.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-orange-600" />Maintenance Details</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Bin</th>
                          <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Type</th>
                          <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Status</th>
                          <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.maintenanceEntries.map(e => (
                          <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                            <td className="py-2 px-3 text-sm font-medium text-gray-900">{e.bin_code}</td>
                            <td className="py-2 px-3 text-sm text-gray-700">{formatLabel(e.maintenance_type)}</td>
                            <td className="py-2 px-3 text-sm text-gray-700">{formatLabel(e.status)}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">{e.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Issues */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-gray-600" />Issues Identified</h3>
                {allIssues.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {allIssues.map((issue, i) => (
                      <span key={i} className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">{issue}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No issues identified</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
