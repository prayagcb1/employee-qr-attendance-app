import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import QRCodeLib from 'qrcode';
import jsPDF from 'jspdf';
import { Plus, Trash2, CreditCard as Edit, QrCode, Download, Printer, X, ChevronDown, ChevronUp, Package, MapPin, CheckSquare, Square, RefreshCw, ArrowLeft, Save, AlertCircle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Site {
  id: string;
  name: string;
  address: string;
  bins?: [{ count: number }];
}

interface Bin {
  id: string;
  site_id: string;
  bin_code: string;
  bin_type: string;
  capacity_kg: number | null;
  capacity_liters: number | null;
  qr_code_data: string;
  location_details: string | null;
  bin_status: string;
  active: boolean;
}

const BIN_TYPES = [
  { value: 'wet_waste', label: 'Wet Waste', color: '#16a34a' },
  { value: 'dry_waste', label: 'Dry Waste', color: '#ca8a04' },
  { value: 'garden_waste', label: 'Garden Waste', color: '#15803d' },
  { value: 'food_waste', label: 'Food Waste', color: '#ea580c' },
  { value: 'compost', label: 'Compost', color: '#92400e' },
  { value: 'organic', label: 'Organic', color: '#166534' },
  { value: 'recyclable', label: 'Recyclable', color: '#1d4ed8' },
  { value: 'non_recyclable', label: 'Non-Recyclable', color: '#374151' },
  { value: 'hazardous', label: 'Hazardous', color: '#dc2626' },
];

const BIN_STATUS_OPTIONS = [
  { value: 'empty', label: 'Empty' },
  { value: 'under_process', label: 'Under Process' },
  { value: 'ready_for_harvest', label: 'Ready for Harvest' },
  { value: 'harvested', label: 'Harvested' },
  { value: 'maintenance_required', label: 'Maintenance Required' },
];

function binTypeColor(type: string) {
  return BIN_TYPES.find(t => t.value === type)?.color ?? '#374151';
}

function binTypeLabel(type: string) {
  return BIN_TYPES.find(t => t.value === type)?.label ?? type.replace(/_/g, ' ');
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';

// ── QR Label Canvas renderer ──────────────────────────────────────────────────

async function renderLabel(
  canvas: HTMLCanvasElement,
  bin: Bin,
  site: Site,
  qrDataUrl: string,
  scale = 1,
) {
  const W = Math.round(240 * scale);
  const H = Math.round(300 * scale);
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d')!;
  const color = binTypeColor(bin.bin_type);
  const radius = Math.round(12 * scale);

  // White background with rounded rect
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(W - radius, 0);
  ctx.quadraticCurveTo(W, 0, W, radius);
  ctx.lineTo(W, H - radius);
  ctx.quadraticCurveTo(W, H, W - radius, H);
  ctx.lineTo(radius, H);
  ctx.quadraticCurveTo(0, H, 0, H - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Border
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = scale;
  ctx.stroke();

  // Color header strip
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(W - radius, 0);
  ctx.quadraticCurveTo(W, 0, W, radius);
  ctx.lineTo(W, Math.round(48 * scale));
  ctx.lineTo(0, Math.round(48 * scale));
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Bin type label in header
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(11 * scale)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(binTypeLabel(bin.bin_type).toUpperCase(), W / 2, Math.round(22 * scale));

  // Site name
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `${Math.round(9 * scale)}px Arial, sans-serif`;
  ctx.fillText(site.name, W / 2, Math.round(38 * scale));

  // Bin code
  ctx.fillStyle = '#111827';
  ctx.font = `bold ${Math.round(18 * scale)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(bin.bin_code, W / 2, Math.round(74 * scale));

  // QR code image
  const qrImg = new Image();
  await new Promise<void>(res => {
    qrImg.onload = () => res();
    qrImg.src = qrDataUrl;
  });
  const qrSize = Math.round(140 * scale);
  const qrX = (W - qrSize) / 2;
  ctx.drawImage(qrImg, qrX, Math.round(84 * scale), qrSize, qrSize);

  // Divider
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = scale;
  ctx.beginPath();
  ctx.moveTo(Math.round(16 * scale), Math.round(238 * scale));
  ctx.lineTo(W - Math.round(16 * scale), Math.round(238 * scale));
  ctx.stroke();

  // Capacity
  const cap = bin.capacity_kg ? `${bin.capacity_kg} kg` : bin.capacity_liters ? `${bin.capacity_liters} L` : '—';
  ctx.fillStyle = '#374151';
  ctx.font = `${Math.round(9 * scale)}px Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('Capacity:', Math.round(16 * scale), Math.round(258 * scale));
  ctx.textAlign = 'right';
  ctx.fillText(cap, W - Math.round(16 * scale), Math.round(258 * scale));

  // Location
  if (bin.location_details) {
    ctx.textAlign = 'left';
    ctx.fillText('Location:', Math.round(16 * scale), Math.round(274 * scale));
    ctx.textAlign = 'right';
    const loc = bin.location_details.length > 22 ? bin.location_details.slice(0, 21) + '…' : bin.location_details;
    ctx.fillText(loc, W - Math.round(16 * scale), Math.round(274 * scale));
  }

  // Bottom color bar
  ctx.fillStyle = color;
  ctx.fillRect(0, H - Math.round(6 * scale), W, Math.round(6 * scale));
}

// ── Bin Form ──────────────────────────────────────────────────────────────────

interface BinFormProps {
  site: Site;
  editingBin: Bin | null;
  onSaved: () => void;
  onCancel: () => void;
}

function BinForm({ site, editingBin, onSaved, onCancel }: BinFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    bin_code: editingBin?.bin_code ?? '',
    bin_type: editingBin?.bin_type ?? 'wet_waste',
    capacity_kg: editingBin?.capacity_kg?.toString() ?? '',
    capacity_liters: editingBin?.capacity_liters?.toString() ?? '',
    location_details: editingBin?.location_details ?? '',
    bin_status: editingBin?.bin_status ?? 'empty',
  });

  const upd = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        site_id: site.id,
        bin_code: form.bin_code.trim(),
        bin_type: form.bin_type,
        capacity_kg: form.capacity_kg ? parseFloat(form.capacity_kg) : null,
        capacity_liters: form.capacity_liters ? parseFloat(form.capacity_liters) : null,
        location_details: form.location_details.trim() || null,
        bin_status: form.bin_status,
      };
      if (editingBin) {
        const { error } = await supabase.from('bins').update(payload).eq('id', editingBin.id);
        if (error) throw error;
      } else {
        const qrData = `BIN-${site.id}-${form.bin_code.trim()}-${Date.now()}`;
        const { error } = await supabase.from('bins').insert({ ...payload, qr_code_data: qrData, active: true });
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-gray-800">{editingBin ? 'Edit Bin' : 'Add New Bin'}</h3>
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Bin Code *</label>
          <input required value={form.bin_code} onChange={e => upd('bin_code', e.target.value)}
            className={inputCls} placeholder="e.g. BIN-001" />
        </div>
        <div>
          <label className={labelCls}>Bin Type *</label>
          <select value={form.bin_type} onChange={e => upd('bin_type', e.target.value)} className={inputCls}>
            {BIN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Capacity (kg)</label>
          <input type="number" min="0" step="0.1" value={form.capacity_kg}
            onChange={e => upd('capacity_kg', e.target.value)} className={inputCls} placeholder="e.g. 50" />
        </div>
        <div>
          <label className={labelCls}>Capacity (liters)</label>
          <input type="number" min="0" step="1" value={form.capacity_liters}
            onChange={e => upd('capacity_liters', e.target.value)} className={inputCls} placeholder="e.g. 100" />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={form.bin_status} onChange={e => upd('bin_status', e.target.value)} className={inputCls}>
            {BIN_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Location Details</label>
          <input value={form.location_details} onChange={e => upd('location_details', e.target.value)}
            className={inputCls} placeholder="e.g. Near entrance" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
          <Save className="w-4 h-4" />{saving ? 'Saving…' : editingBin ? 'Update Bin' : 'Add Bin'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Label Preview Modal ───────────────────────────────────────────────────────

interface LabelPreviewProps {
  bin: Bin;
  site: Site;
  qrDataUrl: string;
  onClose: () => void;
}

function LabelPreview({ bin, site, qrDataUrl, onClose }: LabelPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderLabel(canvasRef.current, bin, site, qrDataUrl, 2);
    }
  }, [bin, site, qrDataUrl]);

  const downloadPNG = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.href = canvasRef.current.toDataURL('image/png');
    link.download = `${site.name}-${bin.bin_code}-label.png`;
    link.click();
  };

  const printLabel = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const win = window.open('', '_blank', 'width=400,height=500');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Bin Label - ${bin.bin_code}</title>
      <style>body{margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#f9fafb;}
      img{max-width:100%;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.12);}
      @media print{body{margin:0;background:#fff;}img{box-shadow:none;border-radius:0;}}</style>
      </head><body><img src="${url}" onload="window.print()"/></body></html>
    `);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Label Preview — {bin.bin_code}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex justify-center mb-5">
          <canvas ref={canvasRef} style={{ width: 240, height: 300, borderRadius: 12, border: '1px solid #e5e7eb' }} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={downloadPNG}
            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition">
            <Download className="w-4 h-4" />PNG
          </button>
          <button onClick={printLabel}
            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
            <Printer className="w-4 h-4" />Print
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Site Bin Manager (drill-down view) ────────────────────────────────────────

interface SiteBinManagerProps {
  site: Site;
  onBack: () => void;
}

function SiteBinManager({ site, onBack }: SiteBinManagerProps) {
  const [bins, setBins] = useState<Bin[]>([]);
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBin, setEditingBin] = useState<Bin | null>(null);
  const [previewBin, setPreviewBin] = useState<Bin | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const fetchBins = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bins')
      .select('id, site_id, bin_code, bin_type, capacity_kg, capacity_liters, qr_code_data, location_details, bin_status, active')
      .eq('site_id', site.id)
      .order('bin_code');
    if (error) { setError(error.message); setLoading(false); return; }
    const binsData = (data ?? []) as Bin[];
    setBins(binsData);

    // Generate QR code URLs
    const urls: Record<string, string> = {};
    await Promise.all(binsData.map(async bin => {
      urls[bin.id] = await QRCodeLib.toDataURL(bin.qr_code_data, { width: 200, margin: 1 });
    }));
    setQrUrls(urls);
    setLoading(false);
  }, [site.id]);

  useEffect(() => { fetchBins(); }, [fetchBins]);

  const deleteBin = async (id: string) => {
    if (!confirm('Delete this bin?')) return;
    await supabase.from('bins').delete().eq('id', id);
    setBins(prev => prev.filter(b => b.id !== id));
  };

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () =>
    setSelected(prev => prev.size === bins.length ? new Set() : new Set(bins.map(b => b.id)));

  const exportPDFBatch = async (binIds: string[]) => {
    const targets = bins.filter(b => binIds.includes(b.id));
    if (!targets.length) return;
    setExporting(true);

    const LABEL_W_MM = 63.5;
    const LABEL_H_MM = 80;
    const COLS = 3;
    const ROWS = 3;
    const PAD_H = 10;
    const PAD_V = 10;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PX_SCALE = 4;

    let col = 0, row = 0;
    for (const bin of targets) {
      if (!qrUrls[bin.id]) continue;

      const canvas = document.createElement('canvas');
      await renderLabel(canvas, bin, site, qrUrls[bin.id], PX_SCALE);
      const imgData = canvas.toDataURL('image/png');

      const x = PAD_H + col * (LABEL_W_MM + 3);
      const y = PAD_V + row * (LABEL_H_MM + 3);

      doc.addImage(imgData, 'PNG', x, y, LABEL_W_MM, LABEL_H_MM);

      col++;
      if (col >= COLS) { col = 0; row++; }
      if (row >= ROWS) { col = 0; row = 0; doc.addPage(); }
    }

    doc.save(`${site.name}-bin-labels.pdf`);
    setExporting(false);
  };

  const printBatch = async (binIds: string[]) => {
    const targets = bins.filter(b => binIds.includes(b.id));
    if (!targets.length) return;
    setExporting(true);

    const images: string[] = [];
    for (const bin of targets) {
      if (!qrUrls[bin.id]) continue;
      const canvas = document.createElement('canvas');
      await renderLabel(canvas, bin, site, qrUrls[bin.id], 3);
      images.push(canvas.toDataURL('image/png'));
    }

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { setExporting(false); return; }
    const imgTags = images.map(src => `<img src="${src}" />`).join('');
    win.document.write(`
      <!DOCTYPE html><html><head><title>Bin Labels — ${site.name}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#f3f4f6;font-family:sans-serif;}
        .grid{display:flex;flex-wrap:wrap;gap:12px;padding:16px;justify-content:flex-start;}
        img{width:180px;height:225px;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.12);}
        @media print{
          body{background:#fff;}
          .grid{gap:4mm;padding:4mm;}
          img{width:63.5mm;height:79.5mm;border-radius:0;box-shadow:none;page-break-inside:avoid;}
        }
      </style></head>
      <body><div class="grid">${imgTags}</div>
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>
    `);
    win.document.close();
    setExporting(false);
  };

  const STATUS_COLORS: Record<string, string> = {
    empty: 'bg-gray-100 text-gray-700',
    under_process: 'bg-blue-100 text-blue-800',
    ready_for_harvest: 'bg-green-100 text-green-700',
    harvested: 'bg-yellow-100 text-yellow-800',
    maintenance_required: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{site.name}</h2>
          <p className="text-xs text-gray-500 truncate">{site.address}</p>
        </div>
        <button
          onClick={() => { setEditingBin(null); setShowForm(v => !v); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />Add Bin
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      {showForm && (
        <BinForm
          site={site}
          editingBin={editingBin}
          onSaved={() => { setShowForm(false); setEditingBin(null); fetchBins(); }}
          onCancel={() => { setShowForm(false); setEditingBin(null); }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />Loading bins…
        </div>
      ) : bins.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-xl border border-gray-200">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No bins yet. Add your first bin above.</p>
        </div>
      ) : (
        <>
          {/* Bulk action bar */}
          <div className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl">
            <button onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition">
              {selected.size === bins.length ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
              {selected.size === bins.length ? 'Deselect All' : `Select All (${bins.length})`}
            </button>
            {selected.size > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-xs text-blue-700 font-semibold">{selected.size} selected</span>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => printBatch([...selected])}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-900 transition disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {exporting ? 'Working…' : 'Print Selected'}
                  </button>
                  <button
                    onClick={() => exportPDFBatch([...selected])}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exporting ? 'Working…' : 'PDF Selected'}
                  </button>
                </div>
              </>
            )}
            {selected.size === 0 && (
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => printBatch(bins.map(b => b.id))}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-900 transition disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {exporting ? 'Working…' : 'Print All'}
                </button>
                <button
                  onClick={() => exportPDFBatch(bins.map(b => b.id))}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  {exporting ? 'Working…' : 'PDF All'}
                </button>
              </div>
            )}
          </div>

          {/* Bin grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bins.map(bin => (
              <div
                key={bin.id}
                className={`bg-white border rounded-xl overflow-hidden transition ${
                  selected.has(bin.id) ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Color strip */}
                <div className="h-1.5" style={{ backgroundColor: binTypeColor(bin.bin_type) }} />

                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => toggleSelect(bin.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-blue-600 transition"
                      >
                        {selected.has(bin.id)
                          ? <CheckSquare className="w-4 h-4 text-blue-600" />
                          : <Square className="w-4 h-4" />}
                      </button>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{bin.bin_code}</p>
                        <span className="text-xs font-medium" style={{ color: binTypeColor(bin.bin_type) }}>
                          {binTypeLabel(bin.bin_type)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingBin(bin); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteBin(bin.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* QR thumbnail */}
                  {qrUrls[bin.id] && (
                    <div className="flex justify-center mb-3">
                      <img src={qrUrls[bin.id]} alt={bin.bin_code}
                        className="w-24 h-24 border border-gray-100 rounded-lg" />
                    </div>
                  )}

                  {/* Meta */}
                  <div className="space-y-1 text-xs text-gray-500 mb-3">
                    {(bin.capacity_kg || bin.capacity_liters) && (
                      <p>Capacity: <span className="text-gray-700 font-medium">
                        {bin.capacity_kg ? `${bin.capacity_kg} kg` : `${bin.capacity_liters} L`}
                      </span></p>
                    )}
                    {bin.location_details && (
                      <p className="truncate">Location: <span className="text-gray-700 font-medium">{bin.location_details}</span></p>
                    )}
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[bin.bin_status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {BIN_STATUS_OPTIONS.find(s => s.value === bin.bin_status)?.label ?? bin.bin_status}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setPreviewBin(bin)}
                      className="flex items-center justify-center gap-1 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
                    >
                      <QrCode className="w-3.5 h-3.5" />Label
                    </button>
                    <button
                      onClick={() => qrUrls[bin.id] && printBatch([bin.id])}
                      className="flex items-center justify-center gap-1 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-900 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />Print
                    </button>
                    <button
                      onClick={() => exportPDFBatch([bin.id])}
                      className="flex items-center justify-center gap-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
                    >
                      <Download className="w-3.5 h-3.5" />PDF
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {previewBin && qrUrls[previewBin.id] && (
        <LabelPreview
          bin={previewBin}
          site={site}
          qrDataUrl={qrUrls[previewBin.id]}
          onClose={() => setPreviewBin(null)}
        />
      )}
    </div>
  );
}

// ── Main export: site picker → bin manager ────────────────────────────────────

export function BinQRApplication() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [search, setSearch] = useState('');

  const fetchSites = async () => {
    const { data } = await supabase
      .from('sites')
      .select('id, name, address, bins(count)')
      .eq('active', true)
      .order('name');
    setSites((data ?? []) as Site[]);
    setLoading(false);
  };

  useEffect(() => { fetchSites(); }, []);

  if (selectedSite) {
    return (
      <SiteBinManager
        site={selectedSite}
        onBack={() => { setSelectedSite(null); fetchSites(); }}
      />
    );
  }

  const filtered = sites.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Bin QR Application</h2>
          <p className="text-xs text-gray-500 mt-0.5">Select a site to manage bins and print QR labels</p>
        </div>
      </div>

      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sites…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />Loading sites…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-xl border border-gray-200">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No active sites found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(site => (
            <button
              key={site.id}
              onClick={() => setSelectedSite(site)}
              className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 transition">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 text-sm truncate">{site.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{site.address}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Package className="w-3 h-3 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-600">
                      {site.bins?.[0]?.count ?? 0} {(site.bins?.[0]?.count ?? 0) === 1 ? 'bin' : 'bins'}
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition rotate-[-90deg] flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// keep legacy export for existing BinManagement usages
export { BinQRApplication as default };
