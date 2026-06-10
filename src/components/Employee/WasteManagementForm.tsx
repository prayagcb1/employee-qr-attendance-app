import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  ClipboardList, X, QrCode, Trash2, Plus, ChevronDown, ChevronUp,
  Package, Wrench, Leaf, AlertTriangle
} from 'lucide-react';
import { QRScanner } from '../Scanner/QRScanner';

interface WasteManagementFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ScannedBinInfo {
  binId: string;
  binCode: string;
  siteId: string;
  siteName: string;
}

interface LoadingEntry {
  binInfo: ScannedBinInfo | null;
  weightLoadedKg: string;
  wasteType: 'wet_waste' | 'dry_waste' | 'garden_waste' | 'food_waste';
  cocopeatKg: string;
  loadingDatetime: string;
  collectorName: string;
  remarks: string;
}

interface HarvestEntry {
  binInfo: ScannedBinInfo | null;
  compostHarvestedKg: string;
  harvestDate: string;
  compostQuality: 'good' | 'average' | 'poor';
  moistureLevel: 'low' | 'normal' | 'high';
  remarks: string;
}

interface MaintenanceEntry {
  binInfo: ScannedBinInfo | null;
  maintenanceType: 'cleaning' | 'aeration' | 'mixing' | 'repair' | 'temperature_check';
  status: 'completed' | 'pending';
  remarks: string;
}

type ScanTarget =
  | { section: 'loading'; index: number }
  | { section: 'harvest'; index: number }
  | { section: 'maintenance'; index: number };

const ISSUES_OPTIONS = [
  'Leachate', 'Smell', 'Product Damage', 'Flies',
  'Overflowing Bin', 'Excess Moisture', 'Dry Compost', 'Rodent Activity',
  'Maggots', 'Broken Bin', 'QR Code Missing', 'Temperature High',
  'Temperature Low', 'Mixed Waste Found', 'Other',
];

const WASTE_TYPE_LABELS: Record<string, string> = {
  wet_waste: 'Wet Waste',
  dry_waste: 'Dry Waste',
  garden_waste: 'Garden Waste',
  food_waste: 'Food Waste',
};

const nowDatetimeLocal = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const todayDate = () => new Date().toISOString().split('T')[0];

function makeLoadingEntry(collectorName: string): LoadingEntry {
  return {
    binInfo: null,
    weightLoadedKg: '',
    wasteType: 'wet_waste',
    cocopeatKg: '',
    loadingDatetime: nowDatetimeLocal(),
    collectorName,
    remarks: '',
  };
}

function makeHarvestEntry(): HarvestEntry {
  return {
    binInfo: null,
    compostHarvestedKg: '',
    harvestDate: todayDate(),
    compostQuality: 'good',
    moistureLevel: 'normal',
    remarks: '',
  };
}

function makeMaintenanceEntry(): MaintenanceEntry {
  return { binInfo: null, maintenanceType: 'cleaning', status: 'completed', remarks: '' };
}



interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  color: string;
  open: boolean;
  onToggle: () => void;
  badge?: number;
}

function SectionHeader({ icon, title, color, open, onToggle, badge }: SectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition ${color}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-semibold text-base">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-white bg-opacity-60 text-xs font-bold">{badge}</span>
        )}
      </div>
      {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
    </button>
  );
}

export function WasteManagementForm({ onClose, onSuccess }: WasteManagementFormProps) {
  const { employee } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null);

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedSiteName, setSelectedSiteName] = useState('');
  const [sitesList, setSitesList] = useState<{id: string; name: string}[]>([]);

  useEffect(() => {
    supabase.from('sites').select('id, name').eq('active', true).order('name')
      .then(({ data }) => setSitesList((data ?? []) as {id: string; name: string}[]));
  }, []);

  const handleSiteSelect = (siteId: string, siteName: string) => {
    setSelectedSiteId(siteId);
    setSelectedSiteName(siteName);
    // Reset all scanned bins if site changes
    setLoadingEntries([makeLoadingEntry(employee?.full_name ?? '')]);
    setHarvestEntries([makeHarvestEntry()]);
    setMaintenanceEntries([makeMaintenanceEntry()]);
    setError('');
  };

  // Section open/close
  const [openSections, setOpenSections] = useState({
    loading: true,
    harvest: false,
    maintenance: false,
    issues: false,
  });

  // Entries
  const [loadingEntries, setLoadingEntries] = useState<LoadingEntry[]>([
    makeLoadingEntry(employee?.full_name ?? ''),
  ]);
  const [harvestEntries, setHarvestEntries] = useState<HarvestEntry[]>([makeHarvestEntry()]);
  const [maintenanceEntries, setMaintenanceEntries] = useState<MaintenanceEntry[]>([makeMaintenanceEntry()]);
  const [issuesIdentified, setIssuesIdentified] = useState<string[]>([]);
  const [otherIssue, setOtherIssue] = useState('');
  const [generalRemarks, setGeneralRemarks] = useState('');

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const openScannerFor = (target: ScanTarget) => {
    setScanTarget(target);
    setShowScanner(true);
  };

  const handleScan = async (qrData: string) => {
    setShowScanner(false);
    if (!scanTarget) return;

    try {
      const { data: binData, error: binError } = await supabase
        .from('bins')
        .select('id, bin_code, site_id, sites(id, name)')
        .eq('qr_code_data', qrData)
        .maybeSingle();

      if (binError || !binData) {
        setError('Invalid bin QR code. Please try again.');
        return;
      }

      const siteInfo = binData.sites as any;

      if (selectedSiteId && binData.site_id !== selectedSiteId) {
        setError(`This bin belongs to a different site. Please scan only bins from "${selectedSiteName}".`);
        return;
      }

      if (!selectedSiteId) {
        setSelectedSiteId(binData.site_id);
        setSelectedSiteName(siteInfo.name);
      }

      const binInfo: ScannedBinInfo = {
        binId: binData.id,
        binCode: binData.bin_code,
        siteId: binData.site_id,
        siteName: siteInfo.name,
      };

      if (scanTarget.section === 'loading') {
        setLoadingEntries(prev => {
          const updated = [...prev];
          updated[scanTarget.index] = { ...updated[scanTarget.index], binInfo };
          return updated;
        });
      } else if (scanTarget.section === 'harvest') {
        setHarvestEntries(prev => {
          const updated = [...prev];
          updated[scanTarget.index] = { ...updated[scanTarget.index], binInfo };
          return updated;
        });
      } else if (scanTarget.section === 'maintenance') {
        setMaintenanceEntries(prev => {
          const updated = [...prev];
          updated[scanTarget.index] = { ...updated[scanTarget.index], binInfo };
          return updated;
        });
      }

      setError('');
    } catch {
      setError('Failed to process QR code. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!employee) {
      setError('Employee information not found.');
      setLoading(false);
      return;
    }

    const hasLoading = loadingEntries.some(e => e.binInfo && e.weightLoadedKg);
    const hasHarvest = harvestEntries.some(e => e.binInfo && e.compostHarvestedKg);
    const hasMaintenance = maintenanceEntries.some(e => e.binInfo);
    if (!hasLoading && !hasHarvest && !hasMaintenance) {
      setError('Please fill in at least one section (Loading, Harvest, Maintenance, or Temperature) with a scanned bin.');
      setLoading(false);
      return;
    }

    if (!selectedSiteId) {
      setError('No site detected. Please scan a bin to set the site.');
      setLoading(false);
      return;
    }

    const today = todayDate();

    // Check duplicate form for site today
    const { data: existingForm } = await supabase
      .from('waste_management_forms')
      .select('id')
      .eq('site_id', selectedSiteId)
      .eq('date', today)
      .maybeSingle();

    if (existingForm) {
      setError('A waste form has already been submitted for this site today.');
      setLoading(false);
      return;
    }

    // Build issues array
    const issuesArray = [...issuesIdentified];
    if (issuesIdentified.includes('Other') && otherIssue.trim()) {
      issuesArray.push(otherIssue.trim());
    }

    // Insert parent form
    const { data: formRecord, error: formError } = await supabase
      .from('waste_management_forms')
      .insert({
        employee_id: employee.id,
        community: selectedSiteName,
        date: today,
        recorded_by: employee.full_name,
        waste_segregated: true,
        total_bins_50kg: loadingEntries.filter(e => e.binInfo).length,
        issues_identified: issuesArray,
        workflow_stage: hasLoading ? 'start_loaded' : hasHarvest ? 'harvest' : 'start_loaded',
        scanned_bins: [
          ...loadingEntries.filter(e => e.binInfo).map(e => ({ binCode: e.binInfo!.binCode, binId: e.binInfo!.binId, siteId: e.binInfo!.siteId, siteName: e.binInfo!.siteName })),
          ...harvestEntries.filter(e => e.binInfo).map(e => ({ binCode: e.binInfo!.binCode, binId: e.binInfo!.binId, siteId: e.binInfo!.siteId, siteName: e.binInfo!.siteName })),
        ],
        site_id: selectedSiteId,
        composter_status: {
          start_loaded: loadingEntries.filter(e => e.binInfo).map(e => e.binInfo!.binCode),
          harvest: harvestEntries.filter(e => e.binInfo).map(e => e.binInfo!.binCode),
        },
        remarks: generalRemarks,
      })
      .select('id')
      .single();

    if (formError || !formRecord) {
      setError('Failed to submit form. Please try again.');
      setLoading(false);
      return;
    }

    const formId = formRecord.id;
    const errors: string[] = [];

    // Insert loading entries
    const validLoading = loadingEntries.filter(e => e.binInfo && e.weightLoadedKg);
    if (validLoading.length > 0) {
      const { error: le } = await supabase.from('waste_loading_entries').insert(
        validLoading.map(e => {
          const cocopeatNote = e.wasteType === 'wet_waste' && e.cocopeatKg
            ? `Cocopeat added: ${e.cocopeatKg} kg${e.remarks ? '. ' + e.remarks : ''}`
            : e.remarks;
          return {
            form_id: formId,
            employee_id: employee.id,
            site_id: selectedSiteId,
            bin_id: e.binInfo!.binId,
            bin_code: e.binInfo!.binCode,
            weight_loaded_kg: parseFloat(e.weightLoadedKg),
            waste_type: e.wasteType,
            loading_datetime: new Date(e.loadingDatetime).toISOString(),
            collector_name: e.collectorName || employee.full_name,
            remarks: cocopeatNote,
          };
        })
      );
      if (le) errors.push('Loading entries');
    }

    // Insert cocopeat consumables for wet waste bins
    const cocopeatEntries = validLoading.filter(e => e.wasteType === 'wet_waste' && e.cocopeatKg);
    if (cocopeatEntries.length > 0) {
      await supabase.from('waste_consumables_entries').insert(
        cocopeatEntries.map(e => ({
          form_id: formId,
          employee_id: employee.id,
          site_id: selectedSiteId,
          item_name: 'Cocopeat',
          opening_stock: parseFloat(e.cocopeatKg),
          used: parseFloat(e.cocopeatKg),
          entry_date: today,
        }))
      );
    }

    // Insert harvest entries
    const validHarvest = harvestEntries.filter(e => e.binInfo && e.compostHarvestedKg);
    if (validHarvest.length > 0) {
      const { error: he } = await supabase.from('waste_harvest_entries').insert(
        validHarvest.map(e => ({
          form_id: formId,
          employee_id: employee.id,
          site_id: selectedSiteId,
          bin_id: e.binInfo!.binId,
          bin_code: e.binInfo!.binCode,
          compost_harvested_kg: parseFloat(e.compostHarvestedKg),
          harvest_date: e.harvestDate,
          compost_quality: e.compostQuality,
          moisture_level: e.moistureLevel,
          remarks: e.remarks,
        }))
      );
      if (he) errors.push('Harvest entries');
    }

    // Insert maintenance entries
    const validMaintenance = maintenanceEntries.filter(e => e.binInfo);
    if (validMaintenance.length > 0) {
      const { error: me } = await supabase.from('waste_maintenance_entries').insert(
        validMaintenance.map(e => ({
          form_id: formId,
          employee_id: employee.id,
          site_id: selectedSiteId,
          bin_id: e.binInfo!.binId,
          bin_code: e.binInfo!.binCode,
          maintenance_type: e.maintenanceType,
          status: e.status,
          remarks: e.remarks,
        }))
      );
      if (me) errors.push('Maintenance entries');
    }

    setLoading(false);

    if (errors.length > 0) {
      setError(`Form submitted but some sections failed to save: ${errors.join(', ')}. Please contact support.`);
    } else {
      onSuccess();
      onClose();
    }
  };

  const toggleIssue = (issue: string) => {
    setIssuesIdentified(prev =>
      prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
    );
  };

  // Loading section helpers
  const updateLoading = <K extends keyof LoadingEntry>(idx: number, key: K, val: LoadingEntry[K]) => {
    setLoadingEntries(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [key]: val };
      return updated;
    });
  };

  const updateHarvest = <K extends keyof HarvestEntry>(idx: number, key: K, val: HarvestEntry[K]) => {
    setHarvestEntries(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [key]: val };
      return updated;
    });
  };

  const updateMaintenance = <K extends keyof MaintenanceEntry>(idx: number, key: K, val: MaintenanceEntry[K]) => {
    setMaintenanceEntries(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [key]: val };
      return updated;
    });
  };

  const inputCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 text-sm';
  const selectCls = inputCls;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-2 sm:p-4">
        <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-2xl my-2 sm:my-6 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 bg-white border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Waste Management Form</h2>
                {selectedSiteName && (
                  <p className="text-xs text-green-700 font-medium">{selectedSiteName}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-3 sm:p-5 space-y-3">

            {/* ── SITE SELECTOR ── */}
            {sitesList.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <label className="block text-xs font-semibold text-blue-800 mb-2">Select Site</label>
                <div className="flex flex-wrap gap-2">
                  {sitesList.map(site => (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => handleSiteSelect(site.id, site.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        selectedSiteId === site.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50'
                      }`}
                    >
                      {site.name}
                    </button>
                  ))}
                </div>
                {!selectedSiteId && (
                  <p className="text-xs text-blue-600 mt-2">Select a site or scan a bin QR to detect site automatically.</p>
                )}
              </div>
            )}

            {/* ── LOADING SECTION ── */}
            <div className="rounded-xl overflow-hidden border border-green-200">
              <SectionHeader
                icon={<Package className="w-5 h-5 text-green-700" />}
                title="Loading"
                color="bg-green-50 border-green-200 text-green-900"
                open={openSections.loading}
                onToggle={() => toggleSection('loading')}
                badge={loadingEntries.filter(e => e.binInfo).length}
              />
              {openSections.loading && (
                <div className="bg-white p-4 space-y-4">
                  {loadingEntries.map((entry, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Bin {idx + 1}</span>
                        {loadingEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setLoadingEntries(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Bin QR */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openScannerFor({ section: 'loading', index: idx })}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                        >
                          <QrCode className="w-4 h-4" />
                          {entry.binInfo ? 'Rescan' : 'Scan Bin QR'}
                        </button>
                        {entry.binInfo && (
                          <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-semibold">
                            {entry.binInfo.binCode}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Weight Loaded (kg)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={entry.weightLoadedKg}
                            onChange={e => updateLoading(idx, 'weightLoadedKg', e.target.value)}
                            className={inputCls}
                            placeholder="0.0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Waste Type</label>
                          <select
                            value={entry.wasteType}
                            onChange={e => updateLoading(idx, 'wasteType', e.target.value as LoadingEntry['wasteType'])}
                            className={selectCls}
                          >
                            {Object.entries(WASTE_TYPE_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {entry.wasteType === 'wet_waste' && (
                        <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-teal-800 mb-1">Cocopeat Added (kg)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={entry.cocopeatKg}
                              onChange={e => updateLoading(idx, 'cocopeatKg', e.target.value)}
                              className={inputCls + ' border-teal-300 focus:ring-teal-400'}
                              placeholder="0.0"
                            />
                          </div>
                          <div className="text-xs text-teal-700 font-medium pt-5 flex-shrink-0">
                            mixed with wet waste
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Loading Date & Time</label>
                        <input
                          type="datetime-local"
                          value={entry.loadingDatetime}
                          onChange={e => updateLoading(idx, 'loadingDatetime', e.target.value)}
                          className={inputCls}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Collector Name</label>
                        <input
                          type="text"
                          value={entry.collectorName}
                          onChange={e => updateLoading(idx, 'collectorName', e.target.value)}
                          className={inputCls}
                          placeholder="Collector name"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Remarks</label>
                        <input
                          type="text"
                          value={entry.remarks}
                          onChange={e => updateLoading(idx, 'remarks', e.target.value)}
                          className={inputCls}
                          placeholder="Optional remarks"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setLoadingEntries(prev => [...prev, makeLoadingEntry(employee?.full_name ?? '')])}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-green-400 text-green-700 rounded-xl hover:bg-green-50 transition text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Bin
                  </button>
                </div>
              )}
            </div>

            {/* ── HARVEST SECTION ── */}
            <div className="rounded-xl overflow-hidden border border-yellow-200">
              <SectionHeader
                icon={<Leaf className="w-5 h-5 text-yellow-700" />}
                title="Harvest"
                color="bg-yellow-50 border-yellow-200 text-yellow-900"
                open={openSections.harvest}
                onToggle={() => toggleSection('harvest')}
                badge={harvestEntries.filter(e => e.binInfo).length}
              />
              {openSections.harvest && (
                <div className="bg-white p-4 space-y-4">
                  {harvestEntries.map((entry, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Harvest {idx + 1}</span>
                        {harvestEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setHarvestEntries(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openScannerFor({ section: 'harvest', index: idx })}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                        >
                          <QrCode className="w-4 h-4" />
                          {entry.binInfo ? 'Rescan' : 'Scan Bin QR'}
                        </button>
                        {entry.binInfo && (
                          <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-semibold">
                            {entry.binInfo.binCode}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Compost Harvested (kg)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={entry.compostHarvestedKg}
                            onChange={e => updateHarvest(idx, 'compostHarvestedKg', e.target.value)}
                            className={inputCls}
                            placeholder="0.0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Harvest Date</label>
                          <input
                            type="date"
                            value={entry.harvestDate}
                            onChange={e => updateHarvest(idx, 'harvestDate', e.target.value)}
                            className={inputCls}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Compost Quality</label>
                          <div className="flex gap-1.5">
                            {(['good', 'average', 'poor'] as const).map(q => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => updateHarvest(idx, 'compostQuality', q)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                                  entry.compostQuality === q
                                    ? q === 'good' ? 'bg-green-500 text-white' : q === 'average' ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Moisture Level</label>
                          <div className="flex gap-1.5">
                            {(['low', 'normal', 'high'] as const).map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => updateHarvest(idx, 'moistureLevel', m)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                                  entry.moistureLevel === m ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Remarks</label>
                        <input
                          type="text"
                          value={entry.remarks}
                          onChange={e => updateHarvest(idx, 'remarks', e.target.value)}
                          className={inputCls}
                          placeholder="Optional remarks"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setHarvestEntries(prev => [...prev, makeHarvestEntry()])}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-yellow-400 text-yellow-700 rounded-xl hover:bg-yellow-50 transition text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Harvest
                  </button>
                </div>
              )}
            </div>

            {/* ── MAINTENANCE SECTION ── */}
            <div className="rounded-xl overflow-hidden border border-orange-200">
              <SectionHeader
                icon={<Wrench className="w-5 h-5 text-orange-700" />}
                title="Maintenance"
                color="bg-orange-50 border-orange-200 text-orange-900"
                open={openSections.maintenance}
                onToggle={() => toggleSection('maintenance')}
                badge={maintenanceEntries.filter(e => e.binInfo).length}
              />
              {openSections.maintenance && (
                <div className="bg-white p-4 space-y-4">
                  {maintenanceEntries.map((entry, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Maintenance {idx + 1}</span>
                        {maintenanceEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setMaintenanceEntries(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openScannerFor({ section: 'maintenance', index: idx })}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                        >
                          <QrCode className="w-4 h-4" />
                          {entry.binInfo ? 'Rescan' : 'Scan Bin QR'}
                        </button>
                        {entry.binInfo && (
                          <span className="px-3 py-1.5 bg-orange-100 text-orange-800 rounded-lg text-sm font-semibold">
                            {entry.binInfo.binCode}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Maintenance Type</label>
                        <div className="flex flex-wrap gap-1.5">
                          {(['cleaning', 'aeration', 'mixing', 'repair', 'temperature_check'] as const).map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => updateMaintenance(idx, 'maintenanceType', t)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                                entry.maintenanceType === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {t.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                        <div className="flex gap-2">
                          {(['completed', 'pending'] as const).map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateMaintenance(idx, 'status', s)}
                              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition ${
                                entry.status === s
                                  ? s === 'completed' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Remarks</label>
                        <input
                          type="text"
                          value={entry.remarks}
                          onChange={e => updateMaintenance(idx, 'remarks', e.target.value)}
                          className={inputCls}
                          placeholder="Optional remarks"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setMaintenanceEntries(prev => [...prev, makeMaintenanceEntry()])}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-orange-400 text-orange-700 rounded-xl hover:bg-orange-50 transition text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Maintenance Entry
                  </button>
                </div>
              )}
            </div>

            {/* ── ISSUES SECTION ── */}
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <SectionHeader
                icon={<AlertTriangle className="w-5 h-5 text-gray-600" />}
                title="Issues Identified"
                color="bg-gray-50 border-gray-200 text-gray-900"
                open={openSections.issues}
                onToggle={() => toggleSection('issues')}
                badge={issuesIdentified.length}
              />
              {openSections.issues && (
                <div className="bg-white p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {ISSUES_OPTIONS.map(issue => (
                      <button
                        key={issue}
                        type="button"
                        onClick={() => toggleIssue(issue)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                          issuesIdentified.includes(issue)
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {issue}
                      </button>
                    ))}
                  </div>
                  {issuesIdentified.includes('Other') && (
                    <input
                      type="text"
                      value={otherIssue}
                      onChange={e => setOtherIssue(e.target.value)}
                      placeholder="Describe the issue"
                      className={inputCls}
                    />
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">General Remarks</label>
                    <textarea
                      value={generalRemarks}
                      onChange={e => setGeneralRemarks(e.target.value)}
                      rows={2}
                      className={inputCls + ' resize-none'}
                      placeholder="Any additional notes or observations"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Form'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => { setShowScanner(false); setScanTarget(null); }}
        />
      )}
    </div>
  );
}
