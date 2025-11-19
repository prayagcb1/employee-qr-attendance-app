import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Download } from 'lucide-react';

interface QRCodeDisplayProps {
  site: {
    id: string;
    name: string;
    address: string;
    qr_code_data: string;
  };
  onClose: () => void;
}

export function QRCodeDisplay({ site, onClose }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, site.qr_code_data, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    }
  }, [site.qr_code_data]);

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const url = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${site.name.replace(/\s+/g, '-')}-QR.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Site QR Code</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="text-center mb-6">
          <h4 className="font-semibold text-gray-900 mb-1">{site.name}</h4>
          <p className="text-sm text-gray-600">{site.address}</p>
        </div>

        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-lg shadow-inner">
            <canvas ref={canvasRef} />
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
          >
            <Download className="w-5 h-5" />
            Download QR Code
          </button>

          <p className="text-xs text-center text-gray-500">
            Print this QR code and place it at the site location for employees to scan
          </p>
        </div>
      </div>
    </div>
  );
}
