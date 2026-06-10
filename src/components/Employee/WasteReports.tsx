import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart3, Package, Leaf, Wrench, AlertTriangle,
  ChevronDown, ChevronUp, Calendar, TrendingUp, Activity,
  Layers, Filter, RefreshCw, Download, FileSpreadsheet, FileText,
  FlaskConical, Upload, X, CheckCircle, AlertCircle, Eye, Trash2,
  Sparkles, Share2, Loader,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface WasteReportsProps {
  employeeId: string;
  role: string;
  initialSiteId?: string;
}

// ── DB types ──────────────────────────────────────────────────────────────────

interface BinRow {
  id: string;
  bin_code: string;
  bin_type: string;
  bin_status: string;
  capacity_kg: number | null;
  capacity_liters: number | null;
  current_weight_kg: number | null;
  location_details: string | null;
  active: boolean;
  sites: { id: string; name: string } | null;
}

interface LoadingRow {
  id: string;
  bin_id: string;
  bin_code: string;
  weight_loaded_kg: number;
  waste_type: string;
  loading_datetime: string;
  collector_name: string;
  remarks: string;
  site_id: string | null;
  sites: { name: string } | null;
}

interface HarvestRow {
  id: string;
  bin_id: string;
  bin_code: string;
  compost_harvested_kg: number;
  harvest_date: string;
  compost_quality: string;
  moisture_level: string;
  remarks: string;
  site_id: string | null;
  sites: { name: string } | null;
}

interface MaintenanceRow {
  id: string;
  bin_id: string;
  bin_code: string;
  maintenance_type: string;
  status: string;
  remarks: string;
  created_at: string;
  site_id: string | null;
  sites: { name: string } | null;
}

interface IssueRow {
  id: string;
  site_id: string;
  date: string;
  issues_identified: string[];
  community: string;
  recorded_by: string;
}

interface ConsumableRow {
  id: string;
  item_name: string;
  used: number;
  entry_date: string;
  sites: { name: string } | null;
}

interface BinStats {
  bin: BinRow;
  totalWasteKg: number;
  loadingCount: number;
  wasteByType: Record<string, number>;
  cocopeatKg: number;
  totalHarvestKg: number;
  harvestCount: number;
  lastHarvested: string | null;
  avgQuality: string;
  maintenanceCount: number;
  pendingMaintenance: number;
  lastMaintenance: string | null;
  maintenanceByType: Record<string, number>;
  fillPct: number | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WASTE_LABELS: Record<string, string> = {
  wet_waste: 'Wet Waste', dry_waste: 'Dry Waste',
  garden_waste: 'Garden Waste', food_waste: 'Food Waste',
};

const STATUS_STYLE: Record<string, string> = {
  empty: 'bg-gray-100 text-gray-700',
  under_process: 'bg-blue-100 text-blue-800',
  ready_for_harvest: 'bg-green-100 text-green-700',
  harvested: 'bg-yellow-100 text-yellow-800',
  maintenance_required: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  empty: 'Empty', under_process: 'Under Process',
  ready_for_harvest: 'Ready for Harvest', harvested: 'Harvested',
  maintenance_required: 'Maintenance Required',
};

const QUALITY_STYLE: Record<string, string> = {
  good: 'text-green-700', average: 'text-yellow-600', poor: 'text-red-600',
};

const MAINT_LABELS: Record<string, string> = {
  cleaning: 'Cleaning', aeration: 'Aeration', mixing: 'Mixing',
  repair: 'Repair', temperature_check: 'Temp Check',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function qualityScore(q: string) { return q === 'good' ? 3 : q === 'average' ? 2 : 1; }

function avgQualityLabel(harvests: HarvestRow[]) {
  if (!harvests.length) return '—';
  const avg = harvests.reduce((s, h) => s + qualityScore(h.compost_quality), 0) / harvests.length;
  return avg >= 2.5 ? 'Good' : avg >= 1.5 ? 'Average' : 'Poor';
}

function extractCocopeat(remarks: string): number {
  const m = remarks?.match(/Cocopeat added:\s*([\d.]+)\s*kg/i);
  return m ? parseFloat(m[1]) : 0;
}

function computeBinStats(bins: BinRow[], loading: LoadingRow[], harvest: HarvestRow[], maintenance: MaintenanceRow[]): BinStats[] {
  return bins.map(bin => {
    const bl = loading.filter(l => l.bin_id === bin.id);
    const bh = harvest.filter(h => h.bin_id === bin.id);
    const bm = maintenance.filter(m => m.bin_id === bin.id);
    const wasteByType: Record<string, number> = {};
    bl.forEach(l => { wasteByType[l.waste_type] = (wasteByType[l.waste_type] ?? 0) + l.weight_loaded_kg; });
    const maintenanceByType: Record<string, number> = {};
    bm.forEach(m => { maintenanceByType[m.maintenance_type] = (maintenanceByType[m.maintenance_type] ?? 0) + 1; });
    const totalWasteKg = bl.reduce((s, l) => s + l.weight_loaded_kg, 0);
    const cocopeatKg = bl.reduce((s, l) => s + extractCocopeat(l.remarks ?? ''), 0);
    const cap = bin.capacity_kg ?? (bin.capacity_liters ? bin.capacity_liters * 0.5 : null);
    return {
      bin, totalWasteKg, loadingCount: bl.length,
      wasteByType, cocopeatKg,
      totalHarvestKg: bh.reduce((s, h) => s + h.compost_harvested_kg, 0),
      harvestCount: bh.length,
      lastHarvested: bh[0]?.harvest_date ?? null,
      avgQuality: avgQualityLabel(bh),
      maintenanceCount: bm.length,
      pendingMaintenance: bm.filter(m => m.status === 'pending').length,
      lastMaintenance: bm[0]?.created_at ?? null,
      maintenanceByType,
      fillPct: cap && totalWasteKg > 0 ? Math.min(100, Math.round((totalWasteKg / cap) * 100)) : null,
    };
  });
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportXLSX(params: {
  binStats: BinStats[];
  loadingData: LoadingRow[];
  harvestData: HarvestRow[];
  maintenanceData: MaintenanceRow[];
  issuesData: IssueRow[];
  dateFrom: string;
  dateTo: string;
  siteName: string;
  selectedBinId: string;
}) {
  const { binStats, loadingData, harvestData, maintenanceData, issuesData, dateFrom, dateTo, siteName, selectedBinId } = params;
  const wb = XLSX.utils.book_new();
  const label = selectedBinId === 'all' ? 'All Bins' : (binStats.find(b => b.bin.id === selectedBinId)?.bin.bin_code ?? '');
  const scope = `${siteName} | ${label} | ${dateFrom} to ${dateTo}`;

  // Summary sheet
  const summaryRows = [
    ['Waste Management Report'],
    [scope],
    [],
    ['Metric', 'Value'],
    ['Total Bins', binStats.length],
    ['Total Waste Loaded (kg)', loadingData.reduce((s, l) => s + l.weight_loaded_kg, 0).toFixed(2)],
    ['Total Compost Harvested (kg)', harvestData.reduce((s, h) => s + h.compost_harvested_kg, 0).toFixed(2)],
    ['Total Cocopeat Used (kg)', loadingData.reduce((s, l) => s + extractCocopeat(l.remarks ?? ''), 0).toFixed(2)],
    ['Maintenance Entries', maintenanceData.length],
    ['Pending Maintenance', maintenanceData.filter(m => m.status === 'pending').length],
    ['Issues Reported', issuesData.reduce((s, f) => s + (f.issues_identified?.length ?? 0), 0)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

  // Per-bin sheet
  const binRows = [
    ['Bin Code', 'Type', 'Status', 'Location', 'Total Waste (kg)', 'Cocopeat (kg)', 'Total Compost (kg)', 'Harvests', 'Maintenance', 'Pending Maint', 'Avg Quality', 'Fill %'],
    ...binStats.map(bs => [
      bs.bin.bin_code, bs.bin.bin_type, STATUS_LABEL[bs.bin.bin_status] ?? bs.bin.bin_status,
      bs.bin.location_details ?? '', bs.totalWasteKg.toFixed(2), bs.cocopeatKg.toFixed(2),
      bs.totalHarvestKg.toFixed(2), bs.harvestCount, bs.maintenanceCount, bs.pendingMaintenance,
      bs.avgQuality, bs.fillPct !== null ? `${bs.fillPct}%` : '—',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(binRows), 'Per Bin');

  // Loading sheet
  const loadRows = [
    ['Bin Code', 'Site', 'Waste Type', 'Weight (kg)', 'Cocopeat (kg)', 'Collector', 'Date & Time', 'Remarks'],
    ...loadingData.map(l => [
      l.bin_code, l.sites?.name ?? '', WASTE_LABELS[l.waste_type] ?? l.waste_type,
      l.weight_loaded_kg, extractCocopeat(l.remarks ?? '').toFixed(2),
      l.collector_name, fmtDateTime(l.loading_datetime), l.remarks ?? '',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(loadRows), 'Loading Log');

  // Harvest sheet
  const hvRows = [
    ['Bin Code', 'Site', 'Compost (kg)', 'Quality', 'Moisture', 'Date', 'Remarks'],
    ...harvestData.map(h => [
      h.bin_code, h.sites?.name ?? '', h.compost_harvested_kg, h.compost_quality, h.moisture_level,
      fmtDate(h.harvest_date), h.remarks ?? '',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hvRows), 'Harvest Log');

  // Maintenance sheet
  const mtRows = [
    ['Bin Code', 'Site', 'Type', 'Status', 'Date', 'Remarks'],
    ...maintenanceData.map(m => [
      m.bin_code, m.sites?.name ?? '', MAINT_LABELS[m.maintenance_type] ?? m.maintenance_type,
      m.status, fmtDate(m.created_at), m.remarks ?? '',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mtRows), 'Maintenance Log');

  // Issues sheet
  const isRows = [
    ['Community', 'Date', 'Recorded By', 'Issues'],
    ...issuesData.map(f => [f.community, fmtDate(f.date), f.recorded_by, (f.issues_identified ?? []).join(', ')]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(isRows), 'Issues Log');

  XLSX.writeFile(wb, `waste-report_${label}_${dateFrom}_${dateTo}.xlsx`);
}

function exportPDF(params: {
  binStats: BinStats[];
  loadingData: LoadingRow[];
  harvestData: HarvestRow[];
  maintenanceData: MaintenanceRow[];
  issuesData: IssueRow[];
  dateFrom: string;
  dateTo: string;
  siteName: string;
  selectedBinId: string;
}) {
  const { binStats, loadingData, harvestData, maintenanceData, issuesData, dateFrom, dateTo, siteName, selectedBinId } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const label = selectedBinId === 'all' ? 'All Bins' : (binStats.find(b => b.bin.id === selectedBinId)?.bin.bin_code ?? '');

  const addHeader = (title: string) => {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Waste Management Report', 14, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`${siteName}  |  ${label}  |  ${dateFrom} to ${dateTo}`, 14, 21);
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 30);
  };

  // Page 1: Summary + Per-Bin
  addHeader('Summary');
  autoTable(doc, {
    startY: 34,
    head: [['Metric', 'Value']],
    body: [
      ['Total Bins', String(binStats.length)],
      ['Total Waste Loaded', `${loadingData.reduce((s, l) => s + l.weight_loaded_kg, 0).toFixed(2)} kg`],
      ['Total Compost Harvested', `${harvestData.reduce((s, h) => s + h.compost_harvested_kg, 0).toFixed(2)} kg`],
      ['Total Cocopeat Used', `${loadingData.reduce((s, l) => s + extractCocopeat(l.remarks ?? ''), 0).toFixed(2)} kg`],
      ['Maintenance Entries', String(maintenanceData.length)],
      ['Pending Maintenance', String(maintenanceData.filter(m => m.status === 'pending').length)],
      ['Issues Reported', String(issuesData.reduce((s, f) => s + (f.issues_identified?.length ?? 0), 0))],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
    columnStyles: { 0: { fontStyle: 'bold' } },
  });

  const afterSummary = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Per-Bin Summary', 14, afterSummary);
  autoTable(doc, {
    startY: afterSummary + 4,
    head: [['Bin', 'Type', 'Status', 'Waste (kg)', 'Compost (kg)', 'Cocopeat (kg)', 'Maint.', 'Fill']],
    body: binStats.map(bs => [
      bs.bin.bin_code, bs.bin.bin_type, STATUS_LABEL[bs.bin.bin_status] ?? bs.bin.bin_status,
      bs.totalWasteKg.toFixed(1), bs.totalHarvestKg.toFixed(1), bs.cocopeatKg.toFixed(1),
      `${bs.maintenanceCount} (${bs.pendingMaintenance} pend.)`,
      bs.fillPct !== null ? `${bs.fillPct}%` : '—',
    ]),
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [5, 150, 105] },
  });

  // Page 2: Loading log
  if (loadingData.length > 0) {
    doc.addPage();
    addHeader('Loading Log');
    autoTable(doc, {
      startY: 34,
      head: [['Bin', 'Site', 'Waste Type', 'Weight (kg)', 'Cocopeat (kg)', 'Collector', 'Date']],
      body: loadingData.map(l => [
        l.bin_code, l.sites?.name ?? '', WASTE_LABELS[l.waste_type] ?? l.waste_type,
        l.weight_loaded_kg.toFixed(1), extractCocopeat(l.remarks ?? '').toFixed(1),
        l.collector_name, fmtDateTime(l.loading_datetime),
      ]),
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [22, 163, 74] },
    });
  }

  // Page 3: Harvest + Maintenance
  if (harvestData.length > 0 || maintenanceData.length > 0) {
    doc.addPage();
    addHeader('Harvest Log');
    if (harvestData.length > 0) {
      autoTable(doc, {
        startY: 34,
        head: [['Bin', 'Site', 'Compost (kg)', 'Quality', 'Moisture', 'Date']],
        body: harvestData.map(h => [
          h.bin_code, h.sites?.name ?? '', h.compost_harvested_kg.toFixed(1),
          h.compost_quality, h.moisture_level, fmtDate(h.harvest_date),
        ]),
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [202, 138, 4] },
      });
    }
    if (maintenanceData.length > 0) {
      const y = harvestData.length > 0
        ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
        : 34;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Maintenance Log', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Bin', 'Site', 'Type', 'Status', 'Date', 'Remarks']],
        body: maintenanceData.map(m => [
          m.bin_code, m.sites?.name ?? '', MAINT_LABELS[m.maintenance_type] ?? m.maintenance_type,
          m.status, fmtDate(m.created_at), m.remarks ?? '',
        ]),
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [234, 88, 12] },
      });
    }
  }

  // Page 4: Issues
  if (issuesData.length > 0) {
    doc.addPage();
    addHeader('Issues Log');
    autoTable(doc, {
      startY: 34,
      head: [['Community', 'Date', 'Recorded By', 'Issues']],
      body: issuesData.map(f => [f.community, fmtDate(f.date), f.recorded_by, (f.issues_identified ?? []).join(', ')]),
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [220, 38, 38] },
    });
  }

  doc.save(`waste-report_${label}_${dateFrom}_${dateTo}.pdf`);
}

// ── Analytics helpers ─────────────────────────────────────────────────────────

interface DailyBinRow { date: string; wetWasteKg: number; cocopeatKg: number }

function computeDailyPerBin(loading: LoadingRow[]): Record<string, DailyBinRow[]> {
  const map: Record<string, Record<string, DailyBinRow>> = {};
  for (const l of loading) {
    if (!map[l.bin_code]) map[l.bin_code] = {};
    const day = l.loading_datetime.slice(0, 10);
    if (!map[l.bin_code][day]) map[l.bin_code][day] = { date: day, wetWasteKg: 0, cocopeatKg: 0 };
    if (l.waste_type === 'wet_waste') {
      map[l.bin_code][day].wetWasteKg += l.weight_loaded_kg;
      map[l.bin_code][day].cocopeatKg += extractCocopeat(l.remarks ?? '');
    }
  }
  const result: Record<string, DailyBinRow[]> = {};
  for (const binCode of Object.keys(map)) {
    result[binCode] = Object.values(map[binCode]).sort((a, b) => a.date.localeCompare(b.date));
  }
  return result;
}

interface BinCycleDuration {
  binCode: string;
  firstLoadDate: string;
  lastLoadDate: string;
  daysToFill: number;
  harvestDate: string | null;
  daysLoadingToHarvest: number | null;
  cycleStatus: string;
}

function computeBinCycles(loading: LoadingRow[], harvest: HarvestRow[], bins: BinRow[]): BinCycleDuration[] {
  const result: BinCycleDuration[] = [];
  const binCodes = [...new Set(loading.map(l => l.bin_code))];
  for (const binCode of binCodes) {
    const bl = loading.filter(l => l.bin_code === binCode).sort((a, b) => a.loading_datetime.localeCompare(b.loading_datetime));
    if (!bl.length) continue;
    const firstLoad = bl[0].loading_datetime.slice(0, 10);
    const lastLoad = bl[bl.length - 1].loading_datetime.slice(0, 10);
    const daysToFill = Math.max(0, Math.round((new Date(lastLoad).getTime() - new Date(firstLoad).getTime()) / 86400000));
    const bh = harvest.filter(h => h.bin_code === binCode).sort((a, b) => a.harvest_date.localeCompare(b.harvest_date));
    const harvestDate = bh[0]?.harvest_date ?? null;
    let daysLoadingToHarvest: number | null = null;
    if (harvestDate) {
      daysLoadingToHarvest = Math.max(0, Math.round((new Date(harvestDate).getTime() - new Date(firstLoad).getTime()) / 86400000));
    }
    const binStatus = bins.find(b => b.bin_code === binCode)?.bin_status ?? '';
    result.push({ binCode, firstLoadDate: firstLoad, lastLoadDate: lastLoad, daysToFill, harvestDate, daysLoadingToHarvest, cycleStatus: binStatus });
  }
  return result.sort((a, b) => a.binCode.localeCompare(b.binCode));
}

function exportAnalyticsXLSX(params: {
  dailyPerBin: Record<string, DailyBinRow[]>;
  binCycles: BinCycleDuration[];
  dateFrom: string;
  dateTo: string;
  siteName: string;
}) {
  const { dailyPerBin, binCycles, dateFrom, dateTo, siteName } = params;
  const wb = XLSX.utils.book_new();
  const scope = `${siteName} | ${dateFrom} to ${dateTo}`;

  // Sheet 1: Daily wet waste & cocopeat per bin
  const dailyRows: (string | number)[][] = [
    ['Analytics Report - Daily Wet Waste & Cocopeat per Bin'],
    [scope],
    [],
    ['Bin Code', 'Date', 'Wet Waste (kg)', 'Cocopeat Added (kg)'],
  ];
  for (const [binCode, rows] of Object.entries(dailyPerBin)) {
    for (const r of rows) {
      if (r.wetWasteKg > 0) {
        dailyRows.push([binCode, r.date, r.wetWasteKg, r.cocopeatKg]);
      }
    }
  }
  // Averages block
  dailyRows.push([], ['--- Averages per Bin ---'], ['Bin Code', 'Days Loaded', 'Avg Wet Waste/Day (kg)', 'Avg Cocopeat/Day (kg)']);
  for (const [binCode, rows] of Object.entries(dailyPerBin)) {
    const wetDays = rows.filter(r => r.wetWasteKg > 0);
    if (!wetDays.length) continue;
    const avgWet = wetDays.reduce((s, r) => s + r.wetWasteKg, 0) / wetDays.length;
    const avgCoco = wetDays.reduce((s, r) => s + r.cocopeatKg, 0) / wetDays.length;
    dailyRows.push([binCode, wetDays.length, Number(avgWet.toFixed(2)), Number(avgCoco.toFixed(2))]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyRows), 'Daily Wet Waste & Cocopeat');

  // Sheet 2: Bin cycle durations
  const cycleRows: (string | number)[][] = [
    ['Analytics Report - Bin Cycle Durations'],
    [scope],
    [],
    ['Bin Code', 'Status', 'First Load Date', 'Last Load Date', 'Days to Fill', 'Harvest Date', 'Days Loading to Harvest'],
    ...binCycles.map(c => [
      c.binCode,
      STATUS_LABEL[c.cycleStatus] ?? c.cycleStatus,
      c.firstLoadDate,
      c.lastLoadDate,
      c.daysToFill,
      c.harvestDate ?? 'Not harvested',
      c.daysLoadingToHarvest !== null ? c.daysLoadingToHarvest : 'N/A',
    ]),
  ];
  if (binCycles.length > 1) {
    const avgFill = binCycles.reduce((s, b) => s + b.daysToFill, 0) / binCycles.length;
    const withHarvest = binCycles.filter(b => b.daysLoadingToHarvest !== null);
    const avgHarvest = withHarvest.length
      ? withHarvest.reduce((s, b) => s + b.daysLoadingToHarvest!, 0) / withHarvest.length
      : null;
    cycleRows.push(
      [],
      ['--- Averages ---'],
      ['Avg Days to Fill', Number(avgFill.toFixed(1))],
      ['Avg Days Loading to Harvest', avgHarvest !== null ? Number(avgHarvest.toFixed(1)) : 'N/A'],
    );
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cycleRows), 'Bin Cycle Durations');

  XLSX.writeFile(wb, `analytics_${siteName.replace(/\s+/g, '_')}_${dateFrom}_${dateTo}.xlsx`);
}

// ── Upload helpers ────────────────────────────────────────────────────────────

interface UploadedBinRef { bin_id: string; bin_code: string; site_id: string; site_name: string }

interface UploadLoadingRow {
  row: number;
  site_name: string;
  bin_code: string;
  date: string;
  waste_type: string;
  weight_kg: number;
  cocopeat_kg: number;
  collector_name: string;
  remarks: string;
  errors: string[];
  resolved: UploadedBinRef | null;
}

interface UploadHarvestRow {
  row: number;
  site_name: string;
  bin_code: string;
  harvest_date: string;
  compost_kg: number;
  quality: string;
  moisture: string;
  remarks: string;
  errors: string[];
  resolved: UploadedBinRef | null;
}

function downloadTemplate(bins: BinRow[]) {
  const wb = XLSX.utils.book_new();

  // Loading sheet
  const loadSheet = XLSX.utils.aoa_to_sheet([
    ['Loading Data — fill one row per bin per day'],
    [],
    ['Site Name', 'Bin Code', 'Date (YYYY-MM-DD)', 'Waste Type', 'Weight Loaded (kg)', 'Cocopeat Added (kg)', 'Collector Name', 'Remarks'],
    ...bins.filter(b => b.sites).map(b => [b.sites!.name, b.bin_code, '', 'wet_waste', '', '', '', '']),
  ]);
  XLSX.utils.book_append_sheet(wb, loadSheet, 'Loading Data');

  // Harvest sheet
  const hvSheet = XLSX.utils.aoa_to_sheet([
    ['Harvest Data — fill one row per bin harvest'],
    [],
    ['Site Name', 'Bin Code', 'Harvest Date (YYYY-MM-DD)', 'Compost Harvested (kg)', 'Quality (good/average/poor)', 'Moisture (low/normal/high)', 'Remarks'],
    ...bins.filter(b => b.sites).map(b => [b.sites!.name, b.bin_code, '', '', 'good', 'normal', '']),
  ]);
  XLSX.utils.book_append_sheet(wb, hvSheet, 'Harvest Data');

  // Reference sheet
  const refSheet = XLSX.utils.aoa_to_sheet([
    ['Valid Waste Types', 'Valid Quality Values', 'Valid Moisture Values'],
    ['wet_waste', 'good', 'low'],
    ['dry_waste', 'average', 'normal'],
    ['garden_waste', 'poor', 'high'],
    ['food_waste', '', ''],
  ]);
  XLSX.utils.book_append_sheet(wb, refSheet, 'Valid Values');

  XLSX.writeFile(wb, 'waste_upload_template.xlsx');
}

const VALID_WASTE_TYPES = ['wet_waste', 'dry_waste', 'garden_waste', 'food_waste'];
const VALID_QUALITY = ['good', 'average', 'poor'];
const VALID_MOISTURE = ['low', 'normal', 'high'];

function excelDateToString(val: unknown): string {
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const mm = String(d.m).padStart(2, '0');
      const dd = String(d.d).padStart(2, '0');
      return `${d.y}-${mm}-${dd}`;
    }
  }
  return String(val ?? '').trim();
}

function parseUploadFile(file: File, bins: BinRow[]): Promise<{ loading: UploadLoadingRow[]; harvest: UploadHarvestRow[] }> {
  const binLookup = new Map<string, UploadedBinRef>();
  for (const b of bins) {
    if (!b.sites) continue;
    const key = `${b.sites.name.toLowerCase()}||${b.bin_code.toLowerCase()}`;
    binLookup.set(key, { bin_id: b.id, bin_code: b.bin_code, site_id: b.sites.id, site_name: b.sites.name });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        const loadingRows: UploadLoadingRow[] = [];
        const harvestRows: UploadHarvestRow[] = [];

        // Parse Loading sheet
        const loadSheet = wb.Sheets['Loading Data'];
        if (loadSheet) {
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(loadSheet, { header: 1, defval: '' }) as unknown[][];
          for (let i = 3; i < rows.length; i++) {
            const r = rows[i] as unknown[];
            const site_name = String(r[0] ?? '').trim();
            const bin_code = String(r[1] ?? '').trim();
            const date = excelDateToString(r[2]);
            const waste_type = String(r[3] ?? '').trim().toLowerCase();
            const weight_kg = parseFloat(String(r[4] ?? '')) || 0;
            const cocopeat_kg = parseFloat(String(r[5] ?? '')) || 0;
            const collector_name = String(r[6] ?? '').trim();
            const remarks = String(r[7] ?? '').trim();

            if (!site_name && !bin_code && !date) continue;

            const errors: string[] = [];
            if (!site_name) errors.push('Site Name required');
            if (!bin_code) errors.push('Bin Code required');
            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Date must be YYYY-MM-DD');
            if (!VALID_WASTE_TYPES.includes(waste_type)) errors.push(`Invalid waste type: "${waste_type}"`);
            if (!weight_kg || weight_kg <= 0) errors.push('Weight must be > 0');
            if (!collector_name) errors.push('Collector Name required');

            const key = `${site_name.toLowerCase()}||${bin_code.toLowerCase()}`;
            const resolved = binLookup.get(key) ?? null;
            if (!resolved && site_name && bin_code) errors.push(`Bin "${bin_code}" not found in site "${site_name}"`);

            loadingRows.push({ row: i + 1, site_name, bin_code, date, waste_type, weight_kg, cocopeat_kg, collector_name, remarks, errors, resolved });
          }
        }

        // Parse Harvest sheet
        const hvSheet = wb.Sheets['Harvest Data'];
        if (hvSheet) {
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(hvSheet, { header: 1, defval: '' }) as unknown[][];
          for (let i = 3; i < rows.length; i++) {
            const r = rows[i] as unknown[];
            const site_name = String(r[0] ?? '').trim();
            const bin_code = String(r[1] ?? '').trim();
            const harvest_date = excelDateToString(r[2]);
            const compost_kg = parseFloat(String(r[3] ?? '')) || 0;
            const quality = String(r[4] ?? '').trim().toLowerCase();
            const moisture = String(r[5] ?? '').trim().toLowerCase();
            const remarks = String(r[6] ?? '').trim();

            if (!site_name && !bin_code && !harvest_date) continue;

            const errors: string[] = [];
            if (!site_name) errors.push('Site Name required');
            if (!bin_code) errors.push('Bin Code required');
            if (!harvest_date || !/^\d{4}-\d{2}-\d{2}$/.test(harvest_date)) errors.push('Date must be YYYY-MM-DD');
            if (!compost_kg || compost_kg <= 0) errors.push('Compost kg must be > 0');
            if (!VALID_QUALITY.includes(quality)) errors.push(`Invalid quality: "${quality}"`);
            if (!VALID_MOISTURE.includes(moisture)) errors.push(`Invalid moisture: "${moisture}"`);

            const key = `${site_name.toLowerCase()}||${bin_code.toLowerCase()}`;
            const resolved = binLookup.get(key) ?? null;
            if (!resolved && site_name && bin_code) errors.push(`Bin "${bin_code}" not found in site "${site_name}"`);

            harvestRows.push({ row: i + 1, site_name, bin_code, harvest_date, compost_kg, quality, moisture, remarks, errors, resolved });
          }
        }

        resolve({ loading: loadingRows, harvest: harvestRows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Small UI pieces ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-xs font-semibold opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

function FillBar({ pct, color = 'bg-green-500' }: { pct: number; color?: string }) {
  return (
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function BinCard({ stats, loading, harvest, maintenance }: {
  stats: BinStats;
  loading: LoadingRow[];
  harvest: HarvestRow[];
  maintenance: MaintenanceRow[];
}) {
  const [open, setOpen] = useState(false);
  const { bin } = stats;
  const binLoading = loading.filter(l => l.bin_id === bin.id);
  const binHarvest = harvest.filter(h => h.bin_id === bin.id);
  const binMaint = maintenance.filter(m => m.bin_id === bin.id);
  const fillColor = stats.fillPct !== null
    ? stats.fillPct >= 90 ? 'bg-red-500' : stats.fillPct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
    : 'bg-gray-300';

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full text-left p-4 hover:bg-gray-50 transition">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-gray-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-900 text-sm">{bin.bin_code}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[bin.bin_status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[bin.bin_status] ?? bin.bin_status}
                </span>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs capitalize">{bin.bin_type}</span>
              </div>
              {bin.location_details && <p className="text-xs text-gray-400 mt-0.5 truncate">{bin.location_details}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500">Loaded</p>
              <p className="text-sm font-bold text-gray-800">{stats.totalWasteKg.toFixed(1)} kg</p>
            </div>
            {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
        {stats.fillPct !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Fill Level</span><span>{stats.fillPct}%</span>
            </div>
            <FillBar pct={stats.fillPct} color={fillColor} />
          </div>
        )}
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs text-green-700 font-semibold">Loaded</p>
              <p className="text-lg font-bold text-green-900">{stats.totalWasteKg.toFixed(1)}<span className="text-xs font-normal ml-1">kg</span></p>
              <p className="text-xs text-green-600">{stats.loadingCount} entries</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-3">
              <p className="text-xs text-yellow-700 font-semibold">Harvested</p>
              <p className="text-lg font-bold text-yellow-900">{stats.totalHarvestKg.toFixed(1)}<span className="text-xs font-normal ml-1">kg</span></p>
              <p className="text-xs text-yellow-600">{stats.harvestCount} entries</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-xs text-orange-700 font-semibold">Maintenance</p>
              <p className="text-lg font-bold text-orange-900">{stats.maintenanceCount}</p>
              <p className={`text-xs font-semibold ${stats.pendingMaintenance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.pendingMaintenance > 0 ? `${stats.pendingMaintenance} pending` : 'All done'}
              </p>
            </div>
          </div>

          {stats.cocopeatKg > 0 && (
            <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-xl">
              <span className="text-sm font-semibold text-teal-800">Cocopeat Added</span>
              <span className="text-sm font-bold text-teal-900">{stats.cocopeatKg.toFixed(1)} kg</span>
            </div>
          )}

          {Object.keys(stats.wasteByType).length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Waste Type Breakdown</p>
              <div className="space-y-1.5">
                {Object.entries(stats.wasteByType).map(([type, kg]) => {
                  const pct = stats.totalWasteKg > 0 ? Math.round((kg / stats.totalWasteKg) * 100) : 0;
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-600 font-medium">{WASTE_LABELS[type] ?? type}</span>
                        <span className="text-gray-500">{kg.toFixed(1)} kg ({pct}%)</span>
                      </div>
                      <FillBar pct={pct} color="bg-blue-400" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.harvestCount > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Harvest Summary</p>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div className="bg-gray-50 rounded-lg p-2">
                  <span className="text-gray-500">Avg Quality</span>
                  <p className={`font-bold mt-0.5 ${QUALITY_STYLE[stats.avgQuality.toLowerCase()] ?? 'text-gray-800'}`}>{stats.avgQuality}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <span className="text-gray-500">Last Harvest</span>
                  <p className="font-bold text-gray-800 mt-0.5">{stats.lastHarvested ? fmtDate(stats.lastHarvested) : '—'}</p>
                </div>
              </div>
              <div className="space-y-1">
                {binHarvest.map(h => (
                  <div key={h.id} className="flex items-center justify-between py-1.5 px-2 bg-yellow-50 rounded-lg text-xs">
                    <span className="text-gray-700 font-medium">{fmtDate(h.harvest_date)}</span>
                    <span className="text-yellow-800 font-semibold">{h.compost_harvested_kg} kg</span>
                    <span className={`font-semibold capitalize ${QUALITY_STYLE[h.compost_quality] ?? ''}`}>{h.compost_quality}</span>
                    <span className="text-gray-500 capitalize">{h.moisture_level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.maintenanceCount > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Maintenance History</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {Object.entries(stats.maintenanceByType).map(([type, count]) => (
                  <span key={type} className="px-2 py-1 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800 font-medium">
                    {MAINT_LABELS[type] ?? type}: {count}
                  </span>
                ))}
              </div>
              <div className="space-y-1">
                {binMaint.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-orange-50 rounded-lg text-xs">
                    <span className="text-gray-700 font-medium capitalize">{m.maintenance_type.replace('_', ' ')}</span>
                    <span className={`font-semibold capitalize ${m.status === 'completed' ? 'text-green-700' : 'text-red-600'}`}>{m.status}</span>
                    <span className="text-gray-500">{fmtDate(m.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.loadingCount > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Loading Log</p>
              <div className="space-y-1">
                {binLoading.map(l => (
                  <div key={l.id} className="py-1.5 px-2 bg-green-50 rounded-lg text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">{WASTE_LABELS[l.waste_type] ?? l.waste_type}</span>
                      <span className="font-bold text-green-800">{l.weight_loaded_kg} kg</span>
                      <span className="text-gray-500">{fmtDateTime(l.loading_datetime)}</span>
                    </div>
                    {l.remarks && <p className="text-gray-400 mt-0.5 truncate">{l.remarks}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type TabType = 'overview' | 'bins' | 'loading' | 'harvest' | 'maintenance' | 'issues' | 'analytics';

export function WasteReports({ employeeId, role, initialSiteId }: WasteReportsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [fetching, setFetching] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // all raw data
  const [allBins, setAllBins] = useState<BinRow[]>([]);
  const [allLoading, setAllLoading] = useState<LoadingRow[]>([]);
  const [allHarvest, setAllHarvest] = useState<HarvestRow[]>([]);
  const [allMaintenance, setAllMaintenance] = useState<MaintenanceRow[]>([]);
  const [issuesData, setIssuesData] = useState<IssueRow[]>([]);
  const [consumablesData, setConsumablesData] = useState<ConsumableRow[]>([]);

  // Bin scope selector
  const [selectedBinId, setSelectedBinId] = useState<string>('all');
  const [binFilter, setBinFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  // Excel upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadLoading, setUploadLoading] = useState<UploadLoadingRow[]>([]);
  const [uploadHarvest, setUploadHarvestRows] = useState<UploadHarvestRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF upload + analytics state
  interface PdfRecord { id: string; file_name: string; storage_path: string; file_size_bytes: number; description: string; uploaded_at: string; site_id: string | null }
  interface PdfAnalyticsEntry { label: string; value: string | number; unit?: string }
  interface PdfAnalyticsSection { title: string; entries: PdfAnalyticsEntry[] }
  interface PdfAnalyticsResult {
    title: string;
    summary: string;
    keyMetrics: { label: string; value: string; highlight?: boolean }[];
    sections: PdfAnalyticsSection[];
    tables: { headers: string[]; rows: string[][] }[];
    rawText?: string;
    error?: string;
  }
  const [pdfList, setPdfList] = useState<PdfRecord[]>([]);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfDescription, setPdfDescription] = useState('');
  const [showPdfUploadForm, setShowPdfUploadForm] = useState(false);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [analyzingPdfId, setAnalyzingPdfId] = useState<string | null>(null);
  const [pdfAnalyticsResult, setPdfAnalyticsResult] = useState<PdfAnalyticsResult | null>(null);
  const [analysisPdfRecord, setAnalysisPdfRecord] = useState<PdfRecord | null>(null);

  const isSupervisor = ['field_supervisor', 'manager', 'admin'].includes(role);

  const [sitesList, setSitesList] = useState<{id: string; name: string}[]>([]);
  const [siteFilter, setSiteFilter] = useState<string>(initialSiteId ?? 'all');

  const fetchSites = useCallback(async () => {
    const { data } = await supabase.from('sites').select('id, name').eq('active', true).order('name');
    setSitesList((data ?? []) as {id: string; name: string}[]);
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  const fetchAll = useCallback(async () => {
    setFetching(true);

    let binsQ = supabase.from('bins')
      .select('id, bin_code, bin_type, bin_status, capacity_kg, capacity_liters, current_weight_kg, location_details, active, sites(id, name)')
      .eq('active', true);
    if (siteFilter !== 'all') binsQ = (binsQ as any).eq('site_id', siteFilter);

    let ldQ = supabase.from('waste_loading_entries')
      .select('id, bin_id, bin_code, weight_loaded_kg, waste_type, loading_datetime, collector_name, remarks, site_id, sites(name)')
      .gte('loading_datetime', `${dateFrom}T00:00:00`)
      .lte('loading_datetime', `${dateTo}T23:59:59`)
      .order('loading_datetime', { ascending: false });
    if (siteFilter !== 'all') ldQ = (ldQ as any).eq('site_id', siteFilter);

    let hvQ = supabase.from('waste_harvest_entries')
      .select('id, bin_id, bin_code, compost_harvested_kg, harvest_date, compost_quality, moisture_level, remarks, site_id, sites(name)')
      .gte('harvest_date', dateFrom).lte('harvest_date', dateTo)
      .order('harvest_date', { ascending: false });
    if (siteFilter !== 'all') hvQ = (hvQ as any).eq('site_id', siteFilter);

    let mtQ = supabase.from('waste_maintenance_entries')
      .select('id, bin_id, bin_code, maintenance_type, status, remarks, created_at, site_id, sites(name)')
      .gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`)
      .order('created_at', { ascending: false });
    if (siteFilter !== 'all') mtQ = (mtQ as any).eq('site_id', siteFilter);

    let isQ = (supabase.from('waste_management_forms') as any)
      .select('id, site_id, date, issues_identified, community, recorded_by')
      .gte('date', dateFrom).lte('date', dateTo)
      .not('issues_identified', 'eq', '[]')
      .order('date', { ascending: false });
    if (siteFilter !== 'all') isQ = isQ.eq('site_id', siteFilter);

    let csQ = supabase.from('waste_consumables_entries')
      .select('id, item_name, used, entry_date, sites(name)')
      .gte('entry_date', dateFrom).lte('entry_date', dateTo)
      .order('entry_date', { ascending: false });
    if (siteFilter !== 'all') csQ = (csQ as any).eq('site_id', siteFilter);

    const [binsRes, ldRes, hvRes, mtRes, isRes, csRes] = await Promise.all([
      binsQ, ldQ, hvQ, mtQ, isQ, csQ,
    ]);

    const bins = (binsRes.data ?? []) as BinRow[];
    const ld = (ldRes.data ?? []) as LoadingRow[];
    const hv = (hvRes.data ?? []) as HarvestRow[];
    const mt = (mtRes.data ?? []) as MaintenanceRow[];

    if (!isSupervisor) {
      const activeBinIds = new Set([
        ...ld.map(l => l.bin_id), ...hv.map(h => h.bin_id), ...mt.map(m => m.bin_id),
      ].filter(Boolean));
      setAllBins(bins.filter(b => activeBinIds.has(b.id)));
    } else {
      setAllBins(bins);
    }
    setAllLoading(ld);
    setAllHarvest(hv);
    setAllMaintenance(mt);

    // issues_identified is stored as a JSON string in the DB — parse it back to array
    const parsedIssues = ((isRes.data ?? []) as any[]).map(f => ({
      ...f,
      issues_identified: (() => {
        try {
          if (!f.issues_identified) return [];
          const val = typeof f.issues_identified === 'string'
            ? JSON.parse(f.issues_identified)
            : f.issues_identified;
          return Array.isArray(val) ? val.filter(Boolean) : [];
        } catch { return []; }
      })(),
    })) as IssueRow[];
    setIssuesData(parsedIssues);

    setConsumablesData((csRes.data ?? []) as ConsumableRow[]);
    setFetching(false);
  }, [dateFrom, dateTo, isSupervisor, siteFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchPdfs = useCallback(async () => {
    const { data } = await supabase
      .from('analytics_pdf_uploads')
      .select('id, file_name, storage_path, file_size_bytes, description, uploaded_at, site_id')
      .order('uploaded_at', { ascending: false });
    setPdfList((data ?? []) as PdfRecord[]);
  }, []);

  useEffect(() => { fetchPdfs(); }, [fetchPdfs]);

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingPdfFile(file);
    setPdfDescription('');
    setShowPdfUploadForm(true);
    setPdfError('');
    e.target.value = '';
  };

  const handlePdfUpload = async () => {
    if (!pendingPdfFile) return;
    setPdfUploading(true);
    setPdfError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPdfError('Not authenticated.'); setPdfUploading(false); return; }

    const ext = pendingPdfFile.name.split('.').pop();
    const storagePath = `${user.id}/${Date.now()}_${pendingPdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: storageErr } = await supabase.storage
      .from('analytics-reports')
      .upload(storagePath, pendingPdfFile, { contentType: 'application/pdf' });

    if (storageErr) { setPdfError(storageErr.message); setPdfUploading(false); return; }

    const { error: dbErr } = await supabase.from('analytics_pdf_uploads').insert({
      employee_id: user.id,
      file_name: pendingPdfFile.name,
      storage_path: storagePath,
      file_size_bytes: pendingPdfFile.size,
      description: pdfDescription.trim(),
    });

    if (dbErr) { setPdfError(dbErr.message); setPdfUploading(false); return; }

    setPdfUploading(false);
    setShowPdfUploadForm(false);
    setPendingPdfFile(null);
    setPdfDescription('');
    fetchPdfs();
    void ext;
  };

  const handlePdfView = async (record: PdfRecord) => {
    const { data } = await supabase.storage
      .from('analytics-reports')
      .createSignedUrl(record.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handlePdfDelete = async (record: PdfRecord) => {
    if (!confirm(`Delete "${record.file_name}"?`)) return;
    await supabase.storage.from('analytics-reports').remove([record.storage_path]);
    await supabase.from('analytics_pdf_uploads').delete().eq('id', record.id);
    fetchPdfs();
  };

  const handleAnalyzePdf = async (record: PdfRecord) => {
    setAnalyzingPdfId(record.id);
    setPdfAnalyticsResult(null);
    setAnalysisPdfRecord(record);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-pdf-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ storage_path: record.storage_path }),
        }
      );
      const data: PdfAnalyticsResult = await res.json();
      setPdfAnalyticsResult(data);
    } catch (err) {
      setPdfAnalyticsResult({ title: 'Error', summary: '', keyMetrics: [], sections: [], tables: [], error: String(err) });
    } finally {
      setAnalyzingPdfId(null);
    }
  };

  const shareAnalyticsAsExcel = (result: PdfAnalyticsResult, record: PdfRecord) => {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryRows: (string | number)[][] = [
      [result.title || record.file_name],
      ['Source file:', record.file_name],
      ['Generated:', new Date().toLocaleString()],
      [],
      ['Summary'],
      [result.summary],
      [],
    ];
    if (result.keyMetrics.length > 0) {
      summaryRows.push(['Key Metrics', '']);
      result.keyMetrics.forEach(m => summaryRows.push([m.label, m.value]));
      summaryRows.push([]);
    }
    result.sections.forEach(sec => {
      summaryRows.push([sec.title]);
      sec.entries.forEach(e => summaryRows.push([e.label, String(e.value), e.unit ?? '']));
      summaryRows.push([]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Analytics Summary');

    // One sheet per table
    result.tables.forEach((tbl, i) => {
      if (!tbl.headers.length) return;
      const rows = [tbl.headers, ...tbl.rows];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `Table ${i + 1}`);
    });

    const safe = record.file_name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    XLSX.writeFile(wb, `analytics_${safe}.xlsx`);
  };

  const shareAnalyticsAsPdf = (result: PdfAnalyticsResult, record: PdfRecord) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 15;
    let y = margin;

    const addText = (text: string, size: number, bold = false, color = '#111111') => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(color);
      const lines = doc.splitTextToSize(text, 180);
      if (y + lines.length * size * 0.45 > 280) { doc.addPage(); y = margin; }
      doc.text(lines, margin, y);
      y += lines.length * size * 0.45 + 2;
    };

    // Header
    doc.setFillColor('#1a1a2e');
    doc.rect(0, 0, 210, 28, 'F');
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor('#ffffff');
    doc.text(result.title || 'PDF Analytics Report', margin, 14);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Source: ${record.file_name}  |  Generated: ${new Date().toLocaleDateString()}`, margin, 22);
    y = 36;

    // Summary
    addText('Summary', 13, true, '#1a1a2e');
    addText(result.summary, 10, false, '#333333');
    y += 4;

    // Key metrics table
    if (result.keyMetrics.length > 0) {
      addText('Key Metrics', 12, true, '#1a1a2e');
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: result.keyMetrics.map(m => [m.label, m.value]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [26, 26, 46], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        margin: { left: margin, right: margin },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    // Sections
    result.sections.forEach(sec => {
      if (!sec.entries.length) return;
      addText(sec.title, 11, true, '#1a1a2e');
      autoTable(doc, {
        startY: y,
        head: [['Field', 'Value', 'Unit']],
        body: sec.entries.map(e => [e.label, String(e.value), e.unit ?? '']),
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [60, 90, 60], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 252, 248] },
        margin: { left: margin, right: margin },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    });

    // Tables
    result.tables.forEach((tbl, i) => {
      if (!tbl.headers.length) return;
      addText(`Table ${i + 1}`, 11, true, '#1a1a2e');
      autoTable(doc, {
        startY: y,
        head: [tbl.headers],
        body: tbl.rows,
        styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
        headStyles: { fillColor: [26, 26, 46], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        margin: { left: margin, right: margin },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    });

    const safe = record.file_name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    doc.save(`analytics_${safe}.pdf`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadDone(false);
    try {
      const allBinsForUpload = (await supabase.from('bins').select('id, bin_code, site_id, active, sites(id, name)').eq('active', true)).data as BinRow[] ?? [];
      const { loading, harvest } = await parseUploadFile(file, allBinsForUpload);
      setUploadLoading(loading);
      setUploadHarvestRows(harvest);
      setShowUpload(true);
    } catch {
      setUploadError('Failed to read file. Please ensure it is a valid .xlsx file.');
    }
    e.target.value = '';
  };

  const handleUploadConfirm = async () => {
    setUploading(true);
    setUploadError('');
    const validLoading = uploadLoading.filter(r => r.errors.length === 0 && r.resolved);
    const validHarvest = uploadHarvest.filter(r => r.errors.length === 0 && r.resolved);
    const errors: string[] = [];

    if (validLoading.length > 0) {
      const { error } = await supabase.from('waste_loading_entries').insert(
        validLoading.map(r => {
          const cocopeatNote = r.waste_type === 'wet_waste' && r.cocopeat_kg > 0
            ? `Cocopeat added: ${r.cocopeat_kg} kg${r.remarks ? '. ' + r.remarks : ''}`
            : r.remarks;
          return {
            employee_id: employeeId,
            site_id: r.resolved!.site_id,
            bin_id: r.resolved!.bin_id,
            bin_code: r.resolved!.bin_code,
            weight_loaded_kg: r.weight_kg,
            waste_type: r.waste_type,
            loading_datetime: new Date(`${r.date}T08:00:00`).toISOString(),
            collector_name: r.collector_name,
            remarks: cocopeatNote || '',
          };
        })
      );
      if (error) errors.push(`Loading entries: ${error.message}`);
    }

    if (validHarvest.length > 0) {
      const { error } = await supabase.from('waste_harvest_entries').insert(
        validHarvest.map(r => ({
          employee_id: employeeId,
          site_id: r.resolved!.site_id,
          bin_id: r.resolved!.bin_id,
          bin_code: r.resolved!.bin_code,
          compost_harvested_kg: r.compost_kg,
          harvest_date: r.harvest_date,
          compost_quality: r.quality,
          moisture_level: r.moisture,
          remarks: r.remarks || '',
        }))
      );
      if (error) errors.push(`Harvest entries: ${error.message}`);
    }

    setUploading(false);
    if (errors.length > 0) {
      setUploadError(errors.join(' | '));
    } else {
      setUploadDone(true);
      fetchAll();
    }
  };

  // ── Filtered data based on bin selection ──────────────────────────────────

  const scopedBins = selectedBinId === 'all' ? allBins : allBins.filter(b => b.id === selectedBinId);
  const scopedLoading = selectedBinId === 'all' ? allLoading : allLoading.filter(l => l.bin_id === selectedBinId);
  const scopedHarvest = selectedBinId === 'all' ? allHarvest : allHarvest.filter(h => h.bin_id === selectedBinId);
  const scopedMaintenance = selectedBinId === 'all' ? allMaintenance : allMaintenance.filter(m => m.bin_id === selectedBinId);

  const binStats = computeBinStats(scopedBins, scopedLoading, scopedHarvest, scopedMaintenance);

  // Site name from first bin
  const siteName = allBins[0]?.sites?.name ?? 'Site';

  // Aggregates
  const totalWaste = scopedLoading.reduce((s, l) => s + l.weight_loaded_kg, 0);
  const totalCompost = scopedHarvest.reduce((s, h) => s + h.compost_harvested_kg, 0);
  const totalCocopeat = consumablesData.filter(c => c.item_name === 'Cocopeat').reduce((s, c) => s + c.used, 0);
  const pendingMaint = scopedMaintenance.filter(m => m.status === 'pending').length;
  const totalIssues = issuesData.reduce((s, f) => s + (f.issues_identified?.length ?? 0), 0);

  const wasteByType: Record<string, number> = {};
  scopedLoading.forEach(l => { wasteByType[l.waste_type] = (wasteByType[l.waste_type] ?? 0) + l.weight_loaded_kg; });

  const issueFrequency: Record<string, number> = {};
  issuesData.forEach(f => { (f.issues_identified ?? []).forEach(i => { issueFrequency[i] = (issueFrequency[i] ?? 0) + 1; }); });

  const maintenanceByType: Record<string, number> = {};
  scopedMaintenance.forEach(m => { maintenanceByType[m.maintenance_type] = (maintenanceByType[m.maintenance_type] ?? 0) + 1; });

  // Per-bin tab filters
  const filteredBinStats = binStats.filter(bs => {
    const matchCode = !binFilter || bs.bin.bin_code.toLowerCase().includes(binFilter.toLowerCase());
    const matchStatus = !statusFilter || bs.bin.bin_status === statusFilter;
    return matchCode && matchStatus;
  });

  const exportParams = {
    binStats, loadingData: scopedLoading, harvestData: scopedHarvest,
    maintenanceData: scopedMaintenance, issuesData,
    dateFrom, dateTo, siteName, selectedBinId,
  };

  const dailyPerBin = computeDailyPerBin(scopedLoading);
  const binCycles = computeBinCycles(scopedLoading, scopedHarvest, scopedBins);

  const TABS: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { key: 'analytics', label: 'Analytics', icon: <FlaskConical className="w-3.5 h-3.5" /> },
    { key: 'bins', label: 'Per-Bin', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'loading', label: 'Loading', icon: <Package className="w-3.5 h-3.5" /> },
    { key: 'harvest', label: 'Harvest', icon: <Leaf className="w-3.5 h-3.5" /> },
    { key: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-3.5 h-3.5" /> },
    { key: 'issues', label: 'Issues', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">

      {/* ── Control bar ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
        {/* Row 0: site filter */}
        {sitesList.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Site</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setSiteFilter('all'); setSelectedBinId('all'); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                  siteFilter === 'all'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                All Sites
              </button>
              {sitesList.map(site => (
                <button
                  key={site.id}
                  onClick={() => { setSiteFilter(site.id); setSelectedBinId('all'); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                    siteFilter === site.id
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {site.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Row 1: bin selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Scope</label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedBinId('all')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                selectedBinId === 'all'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              All Bins ({allBins.length})
            </button>
            {allBins.map(bin => (
              <button
                key={bin.id}
                onClick={() => setSelectedBinId(bin.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                  selectedBinId === bin.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Package className="w-3 h-3" />
                {bin.bin_code}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: date filters + export */}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <button onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
            {fetching ? 'Loading…' : 'Apply'}
          </button>

          {/* Export button */}
          <div className="relative ml-auto">
            <button
              onClick={() => setShowExportMenu(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition"
            >
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                <button
                  onClick={() => { exportXLSX(exportParams); setShowExportMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-sm text-gray-700"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  Download as XLSX
                </button>
                <button
                  onClick={() => { exportPDF(exportParams); setShowExportMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-sm text-gray-700 border-t border-gray-100"
                >
                  <FileText className="w-4 h-4 text-red-600" />
                  Download as PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scope label */}
      {selectedBinId !== 'all' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-medium">
          <Package className="w-3.5 h-3.5" />
          Showing report for bin: <strong>{allBins.find(b => b.id === selectedBinId)?.bin_code}</strong>
          <button onClick={() => setSelectedBinId('all')} className="ml-auto underline text-blue-600 hover:text-blue-800">
            View all bins
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 flex-nowrap">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
              activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Waste Collected" value={`${totalWaste.toFixed(1)} kg`}
              sub={`${scopedLoading.length} loading entries`} color="bg-green-50 border-green-200 text-green-900" />
            <StatCard label="Total Compost Produced" value={`${totalCompost.toFixed(1)} kg`}
              sub={`${scopedHarvest.length} harvests`} color="bg-yellow-50 border-yellow-200 text-yellow-900" />
            <StatCard label="Cocopeat Used" value={`${totalCocopeat.toFixed(1)} kg`}
              sub="added to wet waste" color="bg-teal-50 border-teal-200 text-teal-900" />
            <StatCard label="Bins in Scope" value={scopedBins.length}
              sub={`${binStats.filter(b => b.loadingCount > 0).length} active this period`}
              color="bg-blue-50 border-blue-200 text-blue-900" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Maintenance Pending" value={pendingMaint}
              sub={`${scopedMaintenance.length} total entries`}
              color={pendingMaint > 0 ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-gray-50 border-gray-200 text-gray-900'} />
            <StatCard label="Issues Reported" value={totalIssues}
              sub={`${issuesData.length} form(s)`}
              color={totalIssues > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-gray-50 border-gray-200 text-gray-900'} />
          </div>

          {scopedBins.length > 0 && selectedBinId === 'all' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-500" />Bin Status Distribution
              </p>
              <div className="space-y-2">
                {Object.entries(STATUS_LABEL).map(([status, label]) => {
                  const count = scopedBins.filter(b => b.bin_status === status).length;
                  if (!count) return null;
                  const pct = Math.round((count / scopedBins.length) * 100);
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-medium text-gray-700">{label}</span>
                        <span className="text-gray-500">{count} bins ({pct}%)</span>
                      </div>
                      <FillBar pct={pct} color={
                        status === 'empty' ? 'bg-gray-400' : status === 'under_process' ? 'bg-blue-400' :
                        status === 'ready_for_harvest' ? 'bg-green-400' : status === 'harvested' ? 'bg-yellow-400' : 'bg-red-400'
                      } />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {totalWaste > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-500" />Waste Type Breakdown
              </p>
              <div className="space-y-2">
                {Object.entries(wasteByType).sort((a, b) => b[1] - a[1]).map(([type, kg]) => {
                  const pct = Math.round((kg / totalWaste) * 100);
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-medium text-gray-700">{WASTE_LABELS[type] ?? type}</span>
                        <span className="text-gray-500">{kg.toFixed(1)} kg ({pct}%)</span>
                      </div>
                      <FillBar pct={pct} color="bg-green-400" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {Object.keys(issueFrequency).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-gray-500" />Top Issues
              </p>
              <div className="space-y-1.5">
                {Object.entries(issueFrequency).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([issue, count]) => (
                  <div key={issue} className="flex items-center justify-between py-1.5 px-3 bg-red-50 rounded-lg">
                    <span className="text-xs font-medium text-gray-800">{issue}</span>
                    <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded-full text-xs font-bold">{count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scopedMaintenance.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-gray-500" />Maintenance by Type
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(maintenanceByType).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                    <span className="text-xs font-medium text-orange-800">{MAINT_LABELS[type] ?? type}</span>
                    <span className="text-xs font-bold text-orange-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">

          {/* Action bar */}
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => downloadTemplate(allBins)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition cursor-pointer">
                <Upload className="w-4 h-4" />
                Upload Excel
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </label>
              <label className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 transition cursor-pointer">
                <FileText className="w-4 h-4" />
                Upload PDF
                <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfFileChange} />
              </label>
            </div>
            <button
              onClick={() => exportAnalyticsXLSX({ dailyPerBin, binCycles, dateFrom, dateTo, siteName })}
              className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export to Excel
            </button>
          </div>
          {uploadError && !showUpload && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {uploadError}
            </div>
          )}

          {/* PDF upload form */}
          {showPdfUploadForm && pendingPdfFile && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-gray-800">{pendingPdfFile.name}</span>
                  <span className="text-xs text-gray-400">({(pendingPdfFile.size / 1024).toFixed(0)} KB)</span>
                </div>
                <button onClick={() => { setShowPdfUploadForm(false); setPendingPdfFile(null); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={pdfDescription}
                onChange={e => setPdfDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              {pdfError && (
                <p className="text-xs text-red-700 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{pdfError}</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setShowPdfUploadForm(false); setPendingPdfFile(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={handlePdfUpload} disabled={pdfUploading}
                  className="flex-1 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 transition disabled:opacity-50">
                  {pdfUploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          )}

          {/* PDF list */}
          {pdfList.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-600" />
                <p className="text-sm font-bold text-gray-800">Uploaded Reports ({pdfList.length})</p>
              </div>
              <div className="divide-y divide-gray-100">
                {pdfList.map(pdf => (
                  <div key={pdf.id} className="flex items-center gap-3 px-4 py-3">
                    <FileText className="w-8 h-8 text-red-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{pdf.file_name}</p>
                      {pdf.description && <p className="text-xs text-gray-500 truncate">{pdf.description}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(pdf.file_size_bytes / 1024).toFixed(0)} KB · {fmtDate(pdf.uploaded_at)}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleAnalyzePdf(pdf)}
                        disabled={analyzingPdfId === pdf.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800 transition disabled:opacity-60"
                        title="Analyze with AI">
                        {analyzingPdfId === pdf.id
                          ? <Loader className="w-3.5 h-3.5 animate-spin" />
                          : <Sparkles className="w-3.5 h-3.5" />}
                        Analyze
                      </button>
                      <button onClick={() => handlePdfView(pdf)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View PDF">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handlePdfDelete(pdf)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 1 & 2: Daily wet waste + cocopeat per bin */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <Package className="w-4 h-4 text-green-600" />
              <p className="text-sm font-bold text-gray-800">Wet Waste &amp; Cocopeat per Day per Bin</p>
            </div>
            {Object.keys(dailyPerBin).length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No wet waste loading data in this period.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {Object.entries(dailyPerBin).map(([binCode, rows]) => {
                  const wetDays = rows.filter(r => r.wetWasteKg > 0);
                  if (!wetDays.length) return null;
                  const avgWet = wetDays.reduce((s, r) => s + r.wetWasteKg, 0) / wetDays.length;
                  const avgCoco = wetDays.reduce((s, r) => s + r.cocopeatKg, 0) / wetDays.length;
                  const maxWet = Math.max(...wetDays.map(r => r.wetWasteKg));
                  return (
                    <div key={binCode} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-bold">{binCode}</span>
                          <span className="text-xs text-gray-500">{wetDays.length} day(s) loaded</span>
                        </div>
                        <div className="flex gap-3 text-xs text-right">
                          <div>
                            <p className="text-gray-400">Avg wet/day</p>
                            <p className="font-bold text-green-700">{avgWet.toFixed(1)} kg</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Avg cocopeat/day</p>
                            <p className="font-bold text-teal-700">{avgCoco.toFixed(1)} kg</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {wetDays.map(row => (
                          <div key={row.date} className="flex items-center gap-2 text-xs">
                            <span className="w-24 text-gray-500 flex-shrink-0">{fmtDate(row.date)}</span>
                            <div className="flex-1 space-y-1">
                              <div>
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-gray-600">Wet Waste</span>
                                  <span className="font-semibold text-green-700">{row.wetWasteKg.toFixed(1)} kg</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-400 rounded-full" style={{ width: `${maxWet > 0 ? Math.round((row.wetWasteKg / maxWet) * 100) : 0}%` }} />
                                </div>
                              </div>
                              {row.cocopeatKg > 0 && (
                                <div>
                                  <div className="flex justify-between mb-0.5">
                                    <span className="text-teal-600">Cocopeat Added</span>
                                    <span className="font-semibold text-teal-700">{row.cocopeatKg.toFixed(1)} kg</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-teal-400 rounded-full" style={{ width: `${maxWet > 0 ? Math.round((row.cocopeatKg / maxWet) * 100) : 0}%` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3 & 4: Bin cycle durations */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-bold text-gray-800">Bin Cycle Durations</p>
            </div>
            {binCycles.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No loading data in this period.</div>
            ) : (
              <>
                {/* Summary averages */}
                {binCycles.length > 1 && (
                  <div className="grid grid-cols-2 gap-px bg-gray-100 border-b border-gray-200">
                    <div className="bg-blue-50 px-4 py-3 text-center">
                      <p className="text-xs text-blue-600 font-semibold">Avg Days to Fill</p>
                      <p className="text-xl font-bold text-blue-900">
                        {(binCycles.reduce((s, b) => s + b.daysToFill, 0) / binCycles.length).toFixed(0)}
                        <span className="text-xs font-normal ml-1">days</span>
                      </p>
                    </div>
                    <div className="bg-amber-50 px-4 py-3 text-center">
                      <p className="text-xs text-amber-600 font-semibold">Avg Loading → Harvest</p>
                      {(() => {
                        const withHarvest = binCycles.filter(b => b.daysLoadingToHarvest !== null);
                        return withHarvest.length > 0 ? (
                          <p className="text-xl font-bold text-amber-900">
                            {(withHarvest.reduce((s, b) => s + b.daysLoadingToHarvest!, 0) / withHarvest.length).toFixed(0)}
                            <span className="text-xs font-normal ml-1">days</span>
                          </p>
                        ) : <p className="text-sm text-amber-600 font-medium mt-1">No harvests yet</p>;
                      })()}
                    </div>
                  </div>
                )}
                <div className="divide-y divide-gray-100">
                  {binCycles.map(cycle => (
                    <div key={cycle.binCode} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold">{cycle.binCode}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[cycle.cycleStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABEL[cycle.cycleStatus] ?? cycle.cycleStatus}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-right flex-wrap justify-end">
                          <div>
                            <p className="text-gray-400">First Load</p>
                            <p className="font-semibold text-gray-700">{fmtDate(cycle.firstLoadDate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Last Load</p>
                            <p className="font-semibold text-gray-700">{fmtDate(cycle.lastLoadDate)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="bg-blue-50 rounded-lg px-3 py-2 text-center">
                          <p className="text-xs text-blue-600">Days to Fill</p>
                          <p className="text-lg font-bold text-blue-900">{cycle.daysToFill}</p>
                          <p className="text-xs text-blue-500">first → last load</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg px-3 py-2 text-center">
                          <p className="text-xs text-amber-600">Loading → Harvest</p>
                          {cycle.daysLoadingToHarvest !== null ? (
                            <>
                              <p className="text-lg font-bold text-amber-900">{cycle.daysLoadingToHarvest}</p>
                              <p className="text-xs text-amber-500">{fmtDate(cycle.harvestDate!)}</p>
                            </>
                          ) : (
                            <p className="text-sm font-medium text-amber-600 mt-1">Not harvested</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* ── UPLOAD PREVIEW MODAL ── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Upload Preview</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Review rows before saving. Rows with errors will be skipped.</p>
                </div>
                <button onClick={() => { setShowUpload(false); setUploadDone(false); setUploadError(''); }}
                  className="p-1 text-gray-400 hover:text-gray-600 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">

                {uploadDone ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                    <p className="text-base font-bold text-gray-900">Data uploaded successfully!</p>
                    <p className="text-sm text-gray-500">
                      {uploadLoading.filter(r => r.errors.length === 0).length} loading +{' '}
                      {uploadHarvest.filter(r => r.errors.length === 0).length} harvest rows saved.
                    </p>
                    <button
                      onClick={() => { setShowUpload(false); setUploadDone(false); }}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    {uploadError && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        {uploadError}
                      </div>
                    )}

                    {/* Summary counts */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Loading rows', total: uploadLoading.length, valid: uploadLoading.filter(r => r.errors.length === 0).length, color: 'green' },
                        { label: 'Harvest rows', total: uploadHarvest.length, valid: uploadHarvest.filter(r => r.errors.length === 0).length, color: 'yellow' },
                        { label: 'Load errors', total: uploadLoading.filter(r => r.errors.length > 0).length, valid: 0, color: 'red' },
                        { label: 'Harvest errors', total: uploadHarvest.filter(r => r.errors.length > 0).length, valid: 0, color: 'red' },
                      ].map(s => (
                        <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color === 'red' ? 'bg-red-50 border-red-200' : s.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                          <p className={`text-lg font-bold ${s.color === 'red' ? 'text-red-800' : s.color === 'yellow' ? 'text-yellow-800' : 'text-green-800'}`}>{s.total}</p>
                          <p className={`text-xs font-medium ${s.color === 'red' ? 'text-red-600' : s.color === 'yellow' ? 'text-yellow-600' : 'text-green-600'}`}>{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Loading rows table */}
                    {uploadLoading.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Loading Data ({uploadLoading.length} rows)</p>
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                  {['Row', 'Site', 'Bin', 'Date', 'Type', 'Weight (kg)', 'Cocopeat (kg)', 'Collector', 'Status'].map(h => (
                                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {uploadLoading.map(r => (
                                  <tr key={r.row} className={r.errors.length > 0 ? 'bg-red-50' : 'bg-white'}>
                                    <td className="px-3 py-2 text-gray-400">{r.row}</td>
                                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.site_name || '—'}</td>
                                    <td className="px-3 py-2 font-semibold text-gray-800">{r.bin_code || '—'}</td>
                                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.date || '—'}</td>
                                    <td className="px-3 py-2 text-gray-600">{r.waste_type || '—'}</td>
                                    <td className="px-3 py-2 font-semibold text-green-700">{r.weight_kg > 0 ? r.weight_kg : '—'}</td>
                                    <td className="px-3 py-2 text-teal-700">{r.cocopeat_kg > 0 ? r.cocopeat_kg : '—'}</td>
                                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.collector_name || '—'}</td>
                                    <td className="px-3 py-2">
                                      {r.errors.length === 0
                                        ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">Valid</span>
                                        : <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold" title={r.errors.join(', ')}>Error</span>
                                      }
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {uploadLoading.some(r => r.errors.length > 0) && (
                            <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-1">
                              {uploadLoading.filter(r => r.errors.length > 0).map(r => (
                                <p key={r.row} className="text-xs text-red-700"><span className="font-bold">Row {r.row}:</span> {r.errors.join(' · ')}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Harvest rows table */}
                    {uploadHarvest.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Harvest Data ({uploadHarvest.length} rows)</p>
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                  {['Row', 'Site', 'Bin', 'Harvest Date', 'Compost (kg)', 'Quality', 'Moisture', 'Status'].map(h => (
                                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {uploadHarvest.map(r => (
                                  <tr key={r.row} className={r.errors.length > 0 ? 'bg-red-50' : 'bg-white'}>
                                    <td className="px-3 py-2 text-gray-400">{r.row}</td>
                                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.site_name || '—'}</td>
                                    <td className="px-3 py-2 font-semibold text-gray-800">{r.bin_code || '—'}</td>
                                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.harvest_date || '—'}</td>
                                    <td className="px-3 py-2 font-semibold text-yellow-700">{r.compost_kg > 0 ? r.compost_kg : '—'}</td>
                                    <td className="px-3 py-2 capitalize text-gray-600">{r.quality || '—'}</td>
                                    <td className="px-3 py-2 capitalize text-gray-600">{r.moisture || '—'}</td>
                                    <td className="px-3 py-2">
                                      {r.errors.length === 0
                                        ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">Valid</span>
                                        : <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold" title={r.errors.join(', ')}>Error</span>
                                      }
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {uploadHarvest.some(r => r.errors.length > 0) && (
                            <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-1">
                              {uploadHarvest.filter(r => r.errors.length > 0).map(r => (
                                <p key={r.row} className="text-xs text-red-700"><span className="font-bold">Row {r.row}:</span> {r.errors.join(' · ')}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {uploadLoading.length === 0 && uploadHarvest.length === 0 && (
                      <div className="py-8 text-center text-gray-400 text-sm">No data rows found in the uploaded file. Please use the template.</div>
                    )}
                  </>
                )}
              </div>

              {!uploadDone && (uploadLoading.length > 0 || uploadHarvest.length > 0) && (
                <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => { setShowUpload(false); setUploadError(''); }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUploadConfirm}
                    disabled={uploading || (uploadLoading.every(r => r.errors.length > 0) && uploadHarvest.every(r => r.errors.length > 0))}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Saving…' : `Save ${uploadLoading.filter(r => r.errors.length === 0).length + uploadHarvest.filter(r => r.errors.length === 0).length} Valid Row(s)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PDF ANALYTICS RESULT MODAL ── */}
      {pdfAnalyticsResult && analysisPdfRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 overflow-hidden">

              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200" style={{ background: '#1a1a2e' }}>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-green-400" />
                    {pdfAnalyticsResult.title || analysisPdfRecord.file_name}
                  </h2>
                  <p className="text-xs text-gray-300 mt-0.5">{analysisPdfRecord.file_name}</p>
                </div>
                <button onClick={() => { setPdfAnalyticsResult(null); setAnalysisPdfRecord(null); }}
                  className="p-1 text-gray-400 hover:text-white transition mt-0.5">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
                {pdfAnalyticsResult.error ? (
                  <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Analysis failed</p>
                      <p className="mt-1 text-xs">{pdfAnalyticsResult.error}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    {pdfAnalyticsResult.summary && (
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Summary</p>
                        <p className="text-sm text-gray-800 leading-relaxed">{pdfAnalyticsResult.summary}</p>
                      </div>
                    )}

                    {/* Key metrics */}
                    {pdfAnalyticsResult.keyMetrics.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Key Metrics</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {pdfAnalyticsResult.keyMetrics.map((m, i) => (
                            <div key={i} className={`rounded-xl border p-3 text-center ${m.highlight ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                              <p className={`text-base font-bold ${m.highlight ? 'text-green-800' : 'text-gray-800'}`}>{m.value}</p>
                              <p className={`text-xs mt-0.5 ${m.highlight ? 'text-green-600' : 'text-gray-500'}`}>{m.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sections */}
                    {pdfAnalyticsResult.sections.map((sec, si) => (
                      sec.entries.length > 0 && (
                        <div key={si}>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{sec.title}</p>
                          <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                              <tbody className="divide-y divide-gray-100">
                                {sec.entries.map((e, ei) => (
                                  <tr key={ei} className={ei % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-2.5 text-gray-500 w-1/2">{e.label}</td>
                                    <td className="px-4 py-2.5 font-semibold text-gray-800">{String(e.value)}{e.unit ? ` ${e.unit}` : ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    ))}

                    {/* Tables */}
                    {pdfAnalyticsResult.tables.map((tbl, ti) => (
                      tbl.headers.length > 0 && (
                        <div key={ti}>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Table {ti + 1}</p>
                          <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                  <tr>
                                    {tbl.headers.map((h, hi) => (
                                      <th key={hi} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {tbl.rows.map((row, ri) => (
                                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                      {row.map((cell, ci) => (
                                        <td key={ci} className="px-3 py-2 text-gray-700">{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )
                    ))}

                    {pdfAnalyticsResult.keyMetrics.length === 0 && pdfAnalyticsResult.sections.length === 0 && pdfAnalyticsResult.tables.length === 0 && (
                      <div className="py-8 text-center text-gray-400 text-sm">
                        No structured data could be extracted from this document.
                        {pdfAnalyticsResult.rawText && (
                          <details className="mt-4 text-left">
                            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">Show raw extracted text</summary>
                            <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200">{pdfAnalyticsResult.rawText}</pre>
                          </details>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer — share buttons */}
              {!pdfAnalyticsResult.error && (
                <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => shareAnalyticsAsExcel(pdfAnalyticsResult, analysisPdfRecord)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Share as Excel
                  </button>
                  <button
                    onClick={() => shareAnalyticsAsPdf(pdfAnalyticsResult, analysisPdfRecord)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition"
                  >
                    <Share2 className="w-4 h-4" />
                    Share as PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PER-BIN ── */}
      {activeTab === 'bins' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg flex-1 min-w-32">
              <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input type="text" value={binFilter} onChange={e => setBinFilter(e.target.value)}
                placeholder="Search bin code…"
                className="text-xs flex-1 outline-none bg-transparent text-gray-800 placeholder-gray-400" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white text-gray-700 focus:ring-2 focus:ring-blue-500">
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {filteredBinStats.length === 0
            ? <Empty label="No bins found for this period." />
            : filteredBinStats.map(bs => (
                <BinCard key={bs.bin.id} stats={bs}
                  loading={scopedLoading} harvest={scopedHarvest} maintenance={scopedMaintenance} />
              ))
          }
        </div>
      )}

      {/* ── LOADING LOG ── */}
      {activeTab === 'loading' && (
        <div className="space-y-2">
          {scopedLoading.length === 0 ? <Empty label="No loading entries in this period." /> : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500">
                  <span>Bin</span><span>Site</span><span>Waste Type</span><span className="text-right">Weight</span><span className="text-right">Date</span>
                </div>
                {scopedLoading.map(l => (
                  <div key={l.id} className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-gray-100 last:border-0 items-center text-xs">
                    <span className="font-semibold text-gray-800">{l.bin_code}</span>
                    <span className="text-gray-500 truncate">{l.sites?.name ?? '—'}</span>
                    <span className="text-gray-700">{WASTE_LABELS[l.waste_type] ?? l.waste_type}</span>
                    <span className="text-right font-bold text-green-700">{l.weight_loaded_kg} kg</span>
                    <span className="text-right text-gray-400">{fmtDate(l.loading_datetime)}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 text-right px-1">
                Total: <strong>{totalWaste.toFixed(1)} kg</strong> across {scopedLoading.length} entries
              </div>
            </>
          )}
        </div>
      )}

      {/* ── HARVEST LOG ── */}
      {activeTab === 'harvest' && (
        <div className="space-y-2">
          {scopedHarvest.length === 0 ? <Empty label="No harvest entries in this period." /> : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500">
                  <span>Bin</span><span>Site</span><span>Quality</span><span>Moisture</span><span className="text-right">Compost</span>
                </div>
                {scopedHarvest.map(h => (
                  <div key={h.id} className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-gray-100 last:border-0 items-center text-xs">
                    <span className="font-semibold text-gray-800">{h.bin_code}</span>
                    <span className="text-gray-500 truncate">{h.sites?.name ?? '—'}</span>
                    <span className={`font-semibold capitalize ${QUALITY_STYLE[h.compost_quality] ?? 'text-gray-700'}`}>{h.compost_quality}</span>
                    <span className="capitalize text-gray-600">{h.moisture_level}</span>
                    <span className="text-right font-bold text-yellow-700">{h.compost_harvested_kg} kg</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 text-right px-1">
                Total: <strong>{totalCompost.toFixed(1)} kg</strong> across {scopedHarvest.length} harvests
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MAINTENANCE LOG ── */}
      {activeTab === 'maintenance' && (
        <div className="space-y-2">
          {scopedMaintenance.length === 0 ? <Empty label="No maintenance entries in this period." /> : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500">
                <span>Bin</span><span>Site</span><span className="col-span-2">Type</span><span>Status</span>
              </div>
              {scopedMaintenance.map(m => (
                <div key={m.id} className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-gray-100 last:border-0 items-center text-xs">
                  <span className="font-semibold text-gray-800">{m.bin_code}</span>
                  <span className="text-gray-500 truncate">{m.sites?.name ?? '—'}</span>
                  <span className="col-span-2 capitalize text-gray-700">{m.maintenance_type.replace('_', ' ')}</span>
                  <span className={`font-semibold capitalize ${m.status === 'completed' ? 'text-green-700' : 'text-red-600'}`}>{m.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ISSUES LOG ── */}
      {activeTab === 'issues' && (
        <div className="space-y-2">
          {issuesData.length === 0 ? <Empty label="No issues reported in this period." /> : (
            <>
              {Object.keys(issueFrequency).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Issue Frequency</p>
                  <div className="space-y-1.5">
                    {Object.entries(issueFrequency).sort((a, b) => b[1] - a[1]).map(([issue, count]) => {
                      const max = Math.max(...Object.values(issueFrequency));
                      return (
                        <div key={issue}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-medium text-gray-700">{issue}</span>
                            <span className="text-gray-500">{count}×</span>
                          </div>
                          <FillBar pct={Math.round((count / max) * 100)} color="bg-red-400" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {issuesData.map(f => (
                  <div key={f.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <button type="button"
                      onClick={() => setExpandedIssues(prev => {
                        const s = new Set(prev);
                        s.has(f.id) ? s.delete(f.id) : s.add(f.id);
                        return s;
                      })}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">{f.community}</p>
                          <p className="text-xs text-gray-500">{fmtDate(f.date)} · {f.recorded_by}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                          {f.issues_identified?.length ?? 0} issues
                        </span>
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </button>
                    {expandedIssues.has(f.id) && (
                      <div className="border-t border-gray-100 px-4 py-3 flex flex-wrap gap-1.5">
                        {(f.issues_identified ?? []).map((issue, i) => (
                          <span key={i} className="px-2 py-1 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
                            {issue}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <p className="text-gray-400 text-sm">{label}</p>
    </div>
  );
}
