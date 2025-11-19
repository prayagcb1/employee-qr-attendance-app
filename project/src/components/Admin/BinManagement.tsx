import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, Plus, ArrowLeft, Download, QrCode, X, Edit } from 'lucide-react';
import QRCodeLib from 'qrcode';

interface Bin {
  id: string;
  site_id: string;
  bin_code: string;
  bin_type: 'organic' | 'recyclable' | 'non_recyclable' | 'hazardous' | 'compost';
  capacity_kg: number;
  qr_code_data: string;
  location_details: string | null;
  active: boolean;
  created_at: string;
}

interface Site {
  id: string;
  name: string;
  address: string;
}

interface BinManagementProps {
  site: Site;
  onBack: () => void;
}

export function BinManagement({ site, onBack }: BinManagementProps) {
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBin, setEditingBin] = useState<Bin | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});
  const [selectedBinForQR, setSelectedBinForQR] = useState<Bin | null>(null);

  const [formData, setFormData] = useState({
    bin_code: '',
    bin_type: 'organic' as const,
    capacity_kg: 50,
    location_details: '',
  });

  useEffect(() => {
    fetchBins();
  }, [site.id]);

  const fetchBins = async () => {
    try {
      const { data, error } = await supabase
        .from('bins')
        .select('*')
        .eq('site_id', site.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBins(data || []);

      if (data) {
        const urls: Record<string, string> = {};
        for (const bin of data) {
          const url = await QRCodeLib.toDataURL(bin.qr_code_data, {
            width: 300,
            margin: 2,
          });
          urls[bin.id] = url;
        }
        setQrCodeUrls(urls);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bins');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (editingBin) {
        const { error } = await supabase
          .from('bins')
          .update({
            bin_code: formData.bin_code,
            bin_type: formData.bin_type,
            capacity_kg: formData.capacity_kg,
            location_details: formData.location_details || null,
          })
          .eq('id', editingBin.id);

        if (error) throw error;
        setSuccess('Bin updated successfully!');
      } else {
        const qrData = `BIN-${site.id}-${formData.bin_code}-${Date.now()}`;

        const { error } = await supabase.from('bins').insert({
          site_id: site.id,
          bin_code: formData.bin_code,
          bin_type: formData.bin_type,
          capacity_kg: formData.capacity_kg,
          qr_code_data: qrData,
          location_details: formData.location_details || null,
        });

        if (error) throw error;
        setSuccess('Bin added successfully!');
      }

      setFormData({
        bin_code: '',
        bin_type: 'organic',
        capacity_kg: 50,
        location_details: '',
      });
      setShowAddForm(false);
      setEditingBin(null);
      await fetchBins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bin');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (bin: Bin) => {
    setEditingBin(bin);
    setFormData({
      bin_code: bin.bin_code,
      bin_type: bin.bin_type,
      capacity_kg: bin.capacity_kg,
      location_details: bin.location_details || '',
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bin?')) return;

    try {
      const { error } = await supabase.from('bins').delete().eq('id', id);
      if (error) throw error;
      setSuccess('Bin deleted successfully');
      await fetchBins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bin');
    }
  };

  const downloadQRCode = (binCode: string, qrUrl: string) => {
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `bin-${binCode}-qr.png`;
    link.click();
  };

  const getBinTypeColor = (type: string) => {
    switch (type) {
      case 'organic':
        return 'bg-green-100 text-green-800';
      case 'recyclable':
        return 'bg-blue-100 text-blue-800';
      case 'non_recyclable':
        return 'bg-gray-100 text-gray-800';
      case 'hazardous':
        return 'bg-red-100 text-red-800';
      case 'compost':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{site.name}</h2>
              <p className="text-gray-600">{site.address}</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Add Bin
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{editingBin ? 'Edit Bin' : 'Add New Bin'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bin Code
                </label>
                <input
                  type="text"
                  value={formData.bin_code}
                  onChange={(e) => setFormData({ ...formData, bin_code: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  placeholder="e.g., BIN-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bin Type
                </label>
                <select
                  value={formData.bin_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bin_type: e.target.value as 'organic' | 'recyclable' | 'non_recyclable' | 'hazardous' | 'compost',
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                >
                  <option value="organic">Organic</option>
                  <option value="recyclable">Recyclable</option>
                  <option value="non_recyclable">Non-Recyclable</option>
                  <option value="hazardous">Hazardous</option>
                  <option value="compost">Compost</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity (L)
                </label>
                <input
                  type="number"
                  value={formData.capacity_kg}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity_kg: parseInt(e.target.value) })
                  }
                  required
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location Details
                </label>
                <input
                  type="text"
                  value={formData.location_details}
                  onChange={(e) =>
                    setFormData({ ...formData, location_details: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  placeholder="e.g., Near entrance"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? (editingBin ? 'Updating...' : 'Adding...') : (editingBin ? 'Update Bin' : 'Add Bin')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingBin(null);
                  setFormData({
                    bin_code: '',
                    bin_type: 'organic',
                    capacity_kg: 50,
                    location_details: '',
                  });
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bins.map((bin) => (
          <div key={bin.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{bin.bin_code}</h3>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${getBinTypeColor(
                    bin.bin_type
                  )}`}
                >
                  {bin.bin_type.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(bin)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(bin.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-gray-600">
                <span className="font-medium">Capacity:</span> {bin.capacity_kg} L
              </p>
              {bin.location_details && (
                <p className="text-gray-600">
                  <span className="font-medium">Location:</span> {bin.location_details}
                </p>
              )}
            </div>

            <div className="border-t pt-4">
              <button
                onClick={() => setSelectedBinForQR(bin)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <QrCode className="w-4 h-4" />
                View QR Code
              </button>
            </div>
          </div>
        ))}
      </div>

      {bins.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-500">No bins added yet. Click "Add Bin" to create one.</p>
        </div>
      )}

      {selectedBinForQR && qrCodeUrls[selectedBinForQR.id] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{selectedBinForQR.bin_code}</h3>
              <button
                onClick={() => setSelectedBinForQR(null)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <img
                src={qrCodeUrls[selectedBinForQR.id]}
                alt={`QR Code for ${selectedBinForQR.bin_code}`}
                className="w-full rounded-lg border border-gray-200"
              />
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Type:</span> {selectedBinForQR.bin_type.replace('_', ' ').toUpperCase()}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Capacity:</span> {selectedBinForQR.capacity_kg} L
              </p>
              {selectedBinForQR.location_details && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Location:</span> {selectedBinForQR.location_details}
                </p>
              )}
            </div>

            <button
              onClick={() => downloadQRCode(selectedBinForQR.bin_code, qrCodeUrls[selectedBinForQR.id])}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Download className="w-5 h-5" />
              Download QR Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
