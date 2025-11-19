import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, MapPin, QrCode, Edit, Trash2, Package } from 'lucide-react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { BinManagement } from './BinManagement';

interface Site {
  id: string;
  name: string;
  address: string;
  qr_code_data: string;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  created_at: string;
}

export function SiteManagement() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [showQR, setShowQR] = useState<Site | null>(null);
  const [showBinManagement, setShowBinManagement] = useState<Site | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSites(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const qrCodeData = `SITE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const siteData = {
      name: formData.name,
      address: formData.address,
      qr_code_data: qrCodeData,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      active: true,
    };

    if (selectedSite) {
      const { error: updateError } = await supabase
        .from('sites')
        .update(siteData)
        .eq('id', selectedSite.id);

      if (updateError) {
        setError('Failed to update site');
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from('sites')
        .insert(siteData);

      if (insertError) {
        setError('Failed to create site');
        return;
      }
    }

    setFormData({ name: '', address: '', latitude: '', longitude: '' });
    setShowForm(false);
    setSelectedSite(null);
    fetchSites();
  };

  const handleEdit = (site: Site) => {
    setSelectedSite(site);
    setFormData({
      name: site.name,
      address: site.address,
      latitude: site.latitude?.toString() || '',
      longitude: site.longitude?.toString() || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this site?')) return;

    const { error } = await supabase
      .from('sites')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchSites();
    }
  };

  const toggleActive = async (site: Site) => {
    const { error } = await supabase
      .from('sites')
      .update({ active: !site.active })
      .eq('id', site.id);

    if (!error) {
      fetchSites();
    }
  };

  if (showBinManagement) {
    return <BinManagement site={showBinManagement} onBack={() => setShowBinManagement(null)} />;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Site Management</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setSelectedSite(null);
            setFormData({ name: '', address: '', latitude: '', longitude: '' });
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Add Site
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">
            {selectedSite ? 'Edit Site' : 'New Site'}
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Construction Site A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123 Main St, City, State"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latitude (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="40.7128"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitude (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="-74.0060"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
              >
                {selectedSite ? 'Update Site' : 'Create Site'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setSelectedSite(null);
                  setError('');
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading sites...</div>
      ) : sites.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No sites created yet</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => (
            <div
              key={site.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{site.name}</h3>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {site.address}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  site.active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {site.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2 mt-4">
                <button
                  onClick={() => setShowBinManagement(site)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
                >
                  <Package className="w-4 h-4" />
                  Manage Bins
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowQR(site)}
                    className="flex-1 flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition text-sm"
                  >
                    <QrCode className="w-4 h-4" />
                    QR Code
                  </button>
                  <button
                    onClick={() => handleEdit(site)}
                    className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(site)}
                    className={`flex items-center justify-center px-3 py-2 rounded-lg transition text-sm ${
                      site.active
                        ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    }`}
                  >
                    {site.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(site.id)}
                    className="flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showQR && (
        <QRCodeDisplay
          site={showQR}
          onClose={() => setShowQR(null)}
        />
      )}
    </div>
  );
}
