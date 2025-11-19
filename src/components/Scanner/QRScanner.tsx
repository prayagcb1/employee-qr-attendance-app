import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, X } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        onScan(result.data);
        scanner.stop();
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
      }
    );

    scannerRef.current = scanner;

    scanner.start().catch((err) => {
      setError('Failed to access camera. Please grant camera permissions.');
      console.error('Scanner error:', err);
    });

    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-gray-900">
        <div className="flex items-center gap-2">
          <Camera className="w-6 h-6 text-white" />
          <h2 className="text-white text-lg font-semibold">Scan QR Code</h2>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-300 transition p-2"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <div className="text-white text-center p-6 bg-red-600 rounded-lg max-w-md">
            <p className="font-semibold mb-2">Camera Access Required</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div className="relative w-full max-w-md aspect-square">
            <video
              ref={videoRef}
              className="w-full h-full object-cover rounded-lg"
            />
            <div className="absolute inset-0 border-4 border-blue-500 rounded-lg pointer-events-none" />
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-900 text-center">
        <p className="text-white text-sm">Position the QR code within the frame</p>
      </div>
    </div>
  );
}
