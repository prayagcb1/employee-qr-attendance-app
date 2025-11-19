import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ClipboardList, X, QrCode, Trash2 } from 'lucide-react';
import { QRScanner } from '../Scanner/QRScanner';

interface WasteManagementFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ScannedBin {
  binCode: string;
  binId: string;
  siteId: string;
  siteName: string;
}

const ISSUES_OPTIONS = [
  'Lechate',
  'Smell',
  'Product Damage',
  'Flies',
  'Other',
];

const REMARKS_OPTIONS = [
  'Harvesting Next week',
  'Issues Reporting',
  'Other',
];

const WORKFLOW_STAGES = [
  { value: 'start_loaded', label: 'Start Loaded' },
  { value: 'harvest', label: 'Harvest' },
];

export function WasteManagementForm({ onClose, onSuccess }: WasteManagementFormProps) {
  const { employee } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanningForStage, setScanningForStage] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedSiteName, setSelectedSiteName] = useState<string>('');

  const [scannedBinsByStage, setScannedBinsByStage] = useState<{
    start_loaded: ScannedBin[];
    harvest: ScannedBin[];
  }>({
    start_loaded: [],
    harvest: [],
  });

  const [formData, setFormData] = useState({
    waste_segregated: '',
    total_bins_50kg: '',
    issues_identified: [] as string[],
    other_issue: '',
    remarks: '',
    other_remark: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!employee) {
      setError('Employee information not found');
      setLoading(false);
      return;
    }

    const allScannedBins = [
      ...scannedBinsByStage.start_loaded,
      ...scannedBinsByStage.harvest,
    ];

    if (allScannedBins.length === 0) {
      setError('Please scan at least one bin');
      setLoading(false);
      return;
    }

    const issuesArray = [...formData.issues_identified];
    if (formData.other_issue.trim()) {
      issuesArray.push(formData.other_issue.trim());
    }

    const remarksText = formData.remarks === 'Other' && formData.other_remark.trim()
      ? formData.other_remark.trim()
      : formData.remarks;

    let workflowStage = '';
    if (scannedBinsByStage.start_loaded.length > 0) workflowStage = 'start_loaded';
    if (scannedBinsByStage.harvest.length > 0) workflowStage = 'harvest';

    const { error: submitError } = await supabase
      .from('waste_management_forms')
      .insert({
        employee_id: employee.id,
        community: selectedSiteName,
        date: new Date().toISOString().split('T')[0],
        recorded_by: employee.full_name,
        waste_segregated: formData.waste_segregated === 'yes',
        total_bins_50kg: parseInt(formData.total_bins_50kg),
        issues_identified: issuesArray,
        workflow_stage: workflowStage,
        scanned_bins: allScannedBins,
        site_id: selectedSiteId,
        composter_status: {
          start_loaded: scannedBinsByStage.start_loaded.map(b => b.binCode),
          harvest: scannedBinsByStage.harvest.map(b => b.binCode),
        },
        remarks: remarksText,
      });

    if (submitError) {
      setError('Failed to submit form. Please try again.');
      setLoading(false);
    } else {
      onSuccess();
      onClose();
    }
  };

  const toggleIssue = (issue: string) => {
    setFormData((prev) => ({
      ...prev,
      issues_identified: prev.issues_identified.includes(issue)
        ? prev.issues_identified.filter((i) => i !== issue)
        : [...prev.issues_identified, issue],
    }));
  };

  const openScannerForStage = (stage: string) => {
    setScanningForStage(stage);
    setShowScanner(true);
  };

  const handleScan = async (qrData: string) => {
    setShowScanner(false);

    if (!scanningForStage) return;

    try {
      const { data: binData, error: binError } = await supabase
        .from('bins')
        .select(`
          id,
          bin_code,
          site_id,
          sites (
            id,
            name
          )
        `)
        .eq('qr_code_data', qrData)
        .maybeSingle();

      if (binError || !binData) {
        setError('Invalid bin QR code');
        return;
      }

      if (selectedSiteId && binData.site_id !== selectedSiteId) {
        setError(`This bin belongs to a different site. Please scan only bins from ${selectedSiteName}`);
        return;
      }

      const allScannedBins = [
        ...scannedBinsByStage.start_loaded,
        ...scannedBinsByStage.harvest,
      ];

      if (allScannedBins.some(b => b.binId === binData.id)) {
        setError('This bin has already been scanned');
        return;
      }

      const siteInfo = binData.sites as any;

      if (!selectedSiteId) {
        setSelectedSiteId(binData.site_id);
        setSelectedSiteName(siteInfo.name);
      }

      const newBin: ScannedBin = {
        binCode: binData.bin_code,
        binId: binData.id,
        siteId: binData.site_id,
        siteName: siteInfo.name,
      };

      setScannedBinsByStage(prev => ({
        ...prev,
        [scanningForStage]: [...prev[scanningForStage as keyof typeof prev], newBin],
      }));

      setError('');
    } catch (err) {
      setError('Failed to process QR code');
    }
  };

  const removeBin = (stage: string, index: number) => {
    setScannedBinsByStage(prev => ({
      ...prev,
      [stage]: prev[stage as keyof typeof prev].filter((_, i) => i !== index),
    }));

    const allBins = [
      ...scannedBinsByStage.start_loaded,
      ...scannedBinsByStage.harvest,
    ];

    if (allBins.length === 0) {
      setSelectedSiteId(null);
      setSelectedSiteName('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-2 sm:p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-2 sm:my-8">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <h2 className="text-base sm:text-xl font-bold text-gray-900">Waste Management Form</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {selectedSiteName && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  Site: <span className="font-bold">{selectedSiteName}</span>
                </p>
              </div>
            )}

            <div className="space-y-4">
              {WORKFLOW_STAGES.map((stage) => (
                <div key={stage.value} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">{stage.label}</h3>
                    <button
                      type="button"
                      onClick={() => openScannerForStage(stage.value)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                    >
                      <QrCode className="w-4 h-4" />
                      Scan
                    </button>
                  </div>

                  {scannedBinsByStage[stage.value as keyof typeof scannedBinsByStage].length > 0 && (
                    <div className="space-y-2">
                      {scannedBinsByStage[stage.value as keyof typeof scannedBinsByStage].map((bin, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                          <span className="text-sm text-green-900 font-medium">{bin.binCode}</span>
                          <button
                            type="button"
                            onClick={() => removeBin(stage.value, index)}
                            className="text-red-600 hover:text-red-800 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Is the waste received segregated? <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, waste_segregated: 'yes' })}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                    formData.waste_segregated === 'yes'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, waste_segregated: 'no' })}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                    formData.waste_segregated === 'no'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Total Number of Bins - 50 L <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.total_bins_50kg}
                onChange={(e) => setFormData({ ...formData, total_bins_50kg: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              >
                <option value="">Select number</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Any issue identified
              </label>
              <div className="flex flex-wrap gap-2">
                {ISSUES_OPTIONS.map((issue) => (
                  <button
                    key={issue}
                    type="button"
                    onClick={() => toggleIssue(issue)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      formData.issues_identified.includes(issue)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {issue}
                  </button>
                ))}
              </div>
              {formData.issues_identified.includes('Other') && (
                <input
                  type="text"
                  value={formData.other_issue}
                  onChange={(e) => setFormData({ ...formData, other_issue: e.target.value })}
                  placeholder="Please specify the issue"
                  className="mt-2 w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Remarks <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              >
                <option value="">Select remarks</option>
                {REMARKS_OPTIONS.map((remark) => (
                  <option key={remark} value={remark}>
                    {remark}
                  </option>
                ))}
              </select>
              {formData.remarks === 'Other' && (
                <input
                  type="text"
                  value={formData.other_remark}
                  onChange={(e) => setFormData({ ...formData, other_remark: e.target.value })}
                  placeholder="Please specify your remarks"
                  className="mt-2 w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2 sm:gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 rounded-lg text-gray-700 text-sm sm:text-base font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
          onClose={() => {
            setShowScanner(false);
            setScanningForStage(null);
          }}
        />
      )}
    </div>
  );
}
