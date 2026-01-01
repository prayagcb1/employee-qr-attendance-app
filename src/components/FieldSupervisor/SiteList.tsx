import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, QrCode } from 'lucide-react';
import { QRCodeDisplay } from '../Admin/QRCodeDisplay';

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

export function SiteList() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState<Site | null>(null);

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

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Sites</h2>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading sites...</div>
      ) : sites.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No sites available</div>
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

              {site.latitude && site.longitude && (
                <div className="text-xs text-gray-500 mb-3">
                  <p>Lat: {site.latitude.toFixed(6)}</p>
                  <p>Lng: {site.longitude.toFixed(6)}</p>
                </div>
              )}

              <div className="mt-4">
                <button
                  onClick={() => setShowQR(site)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg transition text-sm font-medium"
                >
                  <QrCode className="w-4 h-4" />
                  View QR Code
                </button>
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
