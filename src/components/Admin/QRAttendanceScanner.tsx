import { useState } from 'react';
import { QRScanner } from '../Scanner/QRScanner';
import { supabase } from '../../lib/supabase';
import { Camera, CheckCircle, XCircle } from 'lucide-react';

interface Message {
  type: 'success' | 'error';
  text: string;
}

export function QRAttendanceScanner() {
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

          const employeeCode = prompt('Enter Employee Code:');
          if (!employeeCode) {
            setMessage({ type: 'error', text: 'Employee code is required' });
            setProcessing(false);
            return;
          }

          const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('id, full_name, active')
            .eq('employee_code', employeeCode)
            .maybeSingle();

          if (empError || !employee) {
            setMessage({ type: 'error', text: 'Employee not found' });
            setProcessing(false);
            return;
          }

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
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">QR Attendance Scanner</h2>
          <p className="text-gray-600">Scan employee QR code to mark attendance</p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="font-medium">{message.text}</p>
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={() => setShowScanner(true)}
            disabled={processing}
            className="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-lg transition transform hover:scale-105 disabled:transform-none"
          >
            <Camera className="w-6 h-6" />
            {processing ? 'Processing...' : 'Scan QR Code'}
          </button>
        </div>

        {showScanner && (
          <QRScanner
            onScan={handleScan}
            onClose={() => setShowScanner(false)}
          />
        )}

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Click the "Scan QR Code" button</li>
            <li>Point camera at the site QR code</li>
            <li>Enter the employee code when prompted</li>
            <li>System will automatically mark clock in or clock out</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
