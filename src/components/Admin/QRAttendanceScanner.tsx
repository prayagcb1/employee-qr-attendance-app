import { useState } from 'react';
import { QRScanner } from '../Scanner/QRScanner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, CheckCircle, XCircle } from 'lucide-react';

interface Message {
  type: 'success' | 'error';
  text: string;
}

export function QRAttendanceScanner() {
  const { employee: loggedInEmployee } = useAuth();
  const [showScanner, setShowScanner] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleScan = async (qrData: string) => {
    setShowScanner(false);
    setMessage(null);
    setProcessing(true);

    try {
      if (!navigator.geolocation) {
        setMessage({ type: 'error', text: 'Geolocation is not supported by your browser' });
        setProcessing(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          const { data: site, error: siteError } = await supabase
            .from('sites')
            .select('id, name')
            .eq('qr_code_data', qrData)
            .eq('active', true)
            .maybeSingle();

          if (siteError || !site) {
            setMessage({ type: 'error', text: 'Invalid QR code or site not found' });
            setProcessing(false);
            return;
          }

          if (!loggedInEmployee) {
            setMessage({ type: 'error', text: 'Employee information not found' });
            setProcessing(false);
            return;
          }

          const employee = {
            id: loggedInEmployee.id,
            full_name: loggedInEmployee.full_name,
            active: loggedInEmployee.active
          };

          if (!employee.active) {
            setMessage({ type: 'error', text: 'Employee is not active' });
            setProcessing(false);
            return;
          }

          const today = new Date().toISOString().split('T')[0];

          const { data: todayLogs } = await supabase
            .from('attendance_logs')
            .select('id, event_type, site_id')
            .eq('employee_id', employee.id)
            .gte('timestamp', today)
            .lt('timestamp', `${today}T23:59:59.999Z`)
            .order('timestamp', { ascending: false });

          if (todayLogs && todayLogs.length > 0) {
            const firstSiteId = todayLogs[todayLogs.length - 1].site_id;
            if (site.id !== firstSiteId) {
              setMessage({
                type: 'error',
                text: 'This employee can only clock in/out at one site per day. They already have entries for a different site today.'
              });
              setProcessing(false);
              return;
            }
          }

          const lastLog = todayLogs && todayLogs.length > 0 ? todayLogs[0] : null;
          const eventType = !lastLog || lastLog.event_type === 'clock_out' ? 'clock_in' : 'clock_out';

          if (eventType === 'clock_out' && lastLog && lastLog.site_id !== site.id) {
            setMessage({
              type: 'error',
              text: 'Employee must clock out at the same site where they clocked in'
            });
            setProcessing(false);
            return;
          }

          const { error: logError } = await supabase.from('attendance_logs').insert({
            employee_id: employee.id,
            site_id: site.id,
            event_type: eventType,
            latitude,
            longitude,
          });

          if (logError) {
            setMessage({ type: 'error', text: 'Failed to log attendance' });
          } else {
            const action = eventType === 'clock_in' ? 'Clocked in' : 'Clocked out';
            setMessage({
              type: 'success',
              text: `${employee.full_name} ${action.toLowerCase()} at ${site.name}`
            });
          }
          setProcessing(false);
        },
        (error) => {
          setMessage({ type: 'error', text: 'Failed to get location. Please enable location services.' });
          setProcessing(false);
        }
      );
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while processing attendance' });
      setProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">QR Attendance Scanner</h2>
          <p className="text-sm sm:text-base text-gray-600">Scan site QR code to mark your attendance</p>
          {loggedInEmployee && (
            <p className="text-xs sm:text-sm text-gray-500 mt-2">
              Scanning for: {loggedInEmployee.full_name} ({loggedInEmployee.employee_code})
            </p>
          )}
        </div>

        {message && (
          <div
            className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg flex items-start gap-2 sm:gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <p className="font-medium text-sm sm:text-base">{message.text}</p>
          </div>
        )}

        <div className="flex justify-center mb-6 sm:mb-8">
          <button
            onClick={() => setShowScanner(true)}
            disabled={processing}
            className="flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-lg transition transform hover:scale-105 disabled:transform-none text-sm sm:text-base w-full sm:w-auto"
          >
            <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
            {processing ? 'Processing...' : 'Scan QR Code'}
          </button>
        </div>

        {showScanner && (
          <QRScanner
            onScan={handleScan}
            onClose={() => setShowScanner(false)}
          />
        )}

        <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-600">
            <li>Click the "Scan QR Code" button</li>
            <li>Point camera at the site QR code</li>
            <li>System will automatically detect clock in or clock out</li>
            <li>Your attendance will be recorded with location</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
