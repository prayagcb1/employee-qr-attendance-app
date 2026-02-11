import { useState, useEffect } from 'react';
import { QRScanner } from '../Scanner/QRScanner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LeaveRequestForm } from '../Employee/LeaveRequestForm';
import { LeaveStatusView } from '../Employee/LeaveStatusView';
import { Camera, CheckCircle, XCircle, Clock, MapPin, Calendar, CalendarCheck, FileText } from 'lucide-react';

interface Message {
  type: 'success' | 'error';
  text: string;
}

interface AttendanceLog {
  id: string;
  site_id: string;
  event_type: 'clock_in' | 'clock_out';
  timestamp: string;
  latitude: number;
  longitude: number;
  sites: {
    name: string;
    address: string;
  };
}

interface GroupedLog {
  date: string;
  site: { name: string; address: string };
  entries: Array<{
    type: 'clock_in' | 'clock_out';
    timestamp: string;
    latitude: number;
    longitude: number;
  }>;
}

export function QRAttendanceScanner() {
  const { employee: loggedInEmployee } = useAuth();
  const [showScanner, setShowScanner] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<GroupedLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showLeaveRequestForm, setShowLeaveRequestForm] = useState(false);
  const [showLeaveStatus, setShowLeaveStatus] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [loggedInEmployee, message]);

  const fetchLogs = async () => {
    if (!loggedInEmployee) return;

    setLoadingLogs(true);
    const { data, error } = await supabase
      .from('attendance_logs')
      .select(`
        id,
        site_id,
        event_type,
        timestamp,
        latitude,
        longitude,
        sites!inner (
          name,
          address
        )
      `)
      .eq('employee_id', loggedInEmployee.id)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (!error && data) {
      const grouped: { [key: string]: GroupedLog } = {};

      data.forEach((log: AttendanceLog) => {
        const date = log.timestamp.split('T')[0];
        const key = `${date}-${log.site_id}`;

        if (!grouped[key]) {
          grouped[key] = { date, entries: [], site: log.sites };
        }

        grouped[key].entries.push({
          type: log.event_type,
          timestamp: log.timestamp,
          latitude: log.latitude,
          longitude: log.longitude,
        });
      });

      Object.values(grouped).forEach((day: GroupedLog) => {
        day.entries.sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

      setLogs(Object.values(grouped).sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
    }
    setLoadingLogs(false);
  };

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

          const lastLog = todayLogs && todayLogs.length > 0 ? todayLogs[0] : null;

          if (lastLog && lastLog.event_type === 'clock_in' && lastLog.site_id !== site.id) {
            setMessage({
              type: 'error',
              text: 'Please clock out from your current site before clocking in to another site.'
            });
            setProcessing(false);
            return;
          }

          const eventType = !lastLog || lastLog.event_type === 'clock_out' ? 'clock_in' : 'clock_out';

          if (eventType === 'clock_out' && lastLog && lastLog.site_id !== site.id) {
            setMessage({
              type: 'error',
              text: 'You must clock out at the same site where you clocked in'
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

  if (showLeaveStatus) {
    return <LeaveStatusView onBack={() => setShowLeaveStatus(false)} />;
  }

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

        {loggedInEmployee?.role === 'admin' && (
          <div className="mt-6 sm:mt-8">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm sm:text-base">My Leave & WFH Requests</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <button
                onClick={() => setShowLeaveRequestForm(true)}
                className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-3 px-4 rounded-lg shadow-sm transition flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <CalendarCheck className="w-5 h-5" />
                <span>Request Leave or WFH</span>
              </button>

              <button
                onClick={() => setShowLeaveStatus(true)}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 px-4 rounded-lg shadow-sm transition flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <FileText className="w-5 h-5" />
                <span>View Request Status</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {showLeaveRequestForm && loggedInEmployee && (
        <div className="max-w-2xl mx-auto mt-6">
          <LeaveRequestForm
            employeeId={loggedInEmployee.id}
            employeeRole={loggedInEmployee.role}
            onClose={() => setShowLeaveRequestForm(false)}
            onSuccess={() => {
              setShowLeaveRequestForm(false);
              setMessage({ type: 'success', text: 'Request submitted successfully' });
              setTimeout(() => setMessage(null), 5000);
            }}
          />
        </div>
      )}

      <div className="mt-8 max-w-4xl mx-auto">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">My Recent Attendance</h3>

        {loadingLogs ? (
          <div className="text-center py-8 text-gray-500">Loading attendance logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No attendance records yet</div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.date} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">
                    {new Date(log.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                <div className="flex items-start gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">{log.site.name}</p>
                    <p className="text-xs text-gray-500">{log.site.address}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {log.entries.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        entry.type === 'clock_in'
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className={`w-4 h-4 ${
                          entry.type === 'clock_in' ? 'text-green-600' : 'text-red-600'
                        }`} />
                        <span className={`text-xs font-semibold uppercase ${
                          entry.type === 'clock_in' ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {entry.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                        </span>
                      </div>
                      <p className={`text-sm font-semibold ${
                        entry.type === 'clock_in' ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs underline mt-1 inline-block ${
                          entry.type === 'clock_in' ? 'text-green-700 hover:text-green-900' : 'text-red-700 hover:text-red-900'
                        }`}
                      >
                        View Location
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
