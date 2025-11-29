import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { QRScanner } from '../Scanner/QRScanner';
import { WasteManagementForm } from './WasteManagementForm';
import { PasswordChangeForm } from './PasswordChangeForm';
import { LogOut, ScanLine, Clock, MapPin, Calendar, ClipboardList, ChevronLeft, ChevronRight, Lock } from 'lucide-react';

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

interface EmployeeDashboardProps {
  hideHeader?: boolean;
}

export function EmployeeDashboard({ hideHeader = false }: EmployeeDashboardProps = {}) {
  const { employee, signOut } = useAuth();
  const [showScanner, setShowScanner] = useState(false);
  const [showWasteForm, setShowWasteForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentStatus, setCurrentStatus] = useState<'clocked_out' | 'clocked_in'>('clocked_out');
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(null);
  const [monthlyStats, setMonthlyStats] = useState({ daysWorked: 0, totalClockIns: 0 });
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    fetchLogs();
    checkCurrentStatus();
  }, [employee]);

  useEffect(() => {
    fetchMonthlyStats();
  }, [employee, selectedDate]);

  const fetchLogs = async () => {
    if (!employee) return;

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
      .eq('employee_id', employee.id)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (!error && data) {
      const grouped: { [key: string]: any } = {};

      data.forEach(log => {
        const date = log.timestamp.split('T')[0];

        if (!grouped[date]) {
          grouped[date] = { date, entries: [], site: log.sites };
        }

        grouped[date].entries.push({
          type: log.event_type,
          timestamp: log.timestamp
        });
      });

      const groupedLogs = Object.values(grouped)
        .map((day: any) => {
          const clockIns = day.entries.filter((e: any) => e.type === 'clock_in');
          const clockOuts = day.entries.filter((e: any) => e.type === 'clock_out');

          let totalMinutes = 0;
          clockIns.forEach((clockIn: any, index: number) => {
            const clockOut = clockOuts[index];
            if (clockOut) {
              const diff = new Date(clockOut.timestamp).getTime() - new Date(clockIn.timestamp).getTime();
              totalMinutes += diff / 60000;
            }
          });

          return {
            ...day,
            totalDuration: totalMinutes
          };
        })
        .sort((a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        .slice(0, 10);

      setLogs(groupedLogs);
    }
    setLoading(false);
  };

  const checkCurrentStatus = async () => {
    if (!employee) return;

    const { data } = await supabase
      .from('attendance_logs')
      .select('event_type, site_id')
      .eq('employee_id', employee.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setCurrentStatus(data.event_type === 'clock_in' ? 'clocked_in' : 'clocked_out');
      setCurrentSiteId(data.event_type === 'clock_in' ? data.site_id : null);
    }
  };

  const fetchMonthlyStats = async () => {
    if (!employee) return;

    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

    const { data, error } = await supabase
      .from('attendance_logs')
      .select('timestamp, event_type')
      .eq('employee_id', employee.id)
      .eq('event_type', 'clock_in')
      .gte('timestamp', startOfMonth.toISOString())
      .lte('timestamp', endOfMonth.toISOString())
      .order('timestamp', { ascending: true });

    if (!error && data) {
      const uniqueDays = new Set(
        data.map((log) => new Date(log.timestamp).toDateString())
      );
      setMonthlyStats({
        daysWorked: uniqueDays.size,
        totalClockIns: data.length,
      });
    }
  };

  const handleScan = async (qrData: string) => {
    setShowScanner(false);
    setMessage(null);

    if (!employee) {
      setMessage({ type: 'error', text: 'Employee information not found' });
      return;
    }

    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported by your browser' });
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
          .limit(1)
          .single();

        if (siteError || !site) {
          setMessage({ type: 'error', text: 'Invalid QR code or site not found' });
          return;
        }

        const today = new Date().toISOString().split('T')[0];

        const { data: todayLogs } = await supabase
          .from('attendance_logs')
          .select('site_id, event_type')
          .eq('employee_id', employee.id)
          .gte('timestamp', today)
          .lt('timestamp', `${today}T23:59:59.999Z`)
          .order('timestamp', { ascending: false });

        if (todayLogs && todayLogs.length > 0) {
          const firstSiteId = todayLogs[todayLogs.length - 1].site_id;
          if (site.id !== firstSiteId) {
            setMessage({
              type: 'error',
              text: 'You can only clock in/out at one site per day. You already have entries for a different site today.'
            });
            return;
          }
        }

        const eventType = currentStatus === 'clocked_out' ? 'clock_in' : 'clock_out';

        if (eventType === 'clock_out' && currentSiteId && currentSiteId !== site.id) {
          setMessage({
            type: 'error',
            text: 'You must clock out at the same site where you clocked in'
          });
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
          setMessage({ type: 'success', text: `${action} at ${site.name}` });
          setCurrentStatus(eventType === 'clock_in' ? 'clocked_in' : 'clocked_out');
          setCurrentSiteId(eventType === 'clock_in' ? site.id : null);
          fetchLogs();
          fetchMonthlyStats();
        }
      },
      () => {
        setMessage({ type: 'error', text: 'Unable to get your location. Please enable location services.' });
      }
    );
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    setSelectedDate(prevDate => {
      const newDate = new Date(prevDate);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getMonthYearDisplay = () => {
    return selectedDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return selectedDate.getMonth() === now.getMonth() &&
           selectedDate.getFullYear() === now.getFullYear();
  };

  return (
    <div className={hideHeader ? '' : 'min-h-screen bg-gray-50'}>
      {!hideHeader && <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{employee?.full_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-600">{employee?.employee_code}</p>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                  {employee?.role === 'field_worker' && 'Field Worker'}
                  {employee?.role === 'field_supervisor' && 'Field Supervisor'}
                  {employee?.role === 'intern' && 'Intern'}
                  {employee?.role === 'office_employee' && 'Office Employee'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPasswordForm(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <Lock className="w-5 h-5" />
                <span className="font-medium">Change Password</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>}

      <main className={hideHeader ? '' : 'max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8'}>
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className={`p-6 rounded-xl shadow-sm col-span-1 md:col-span-2 ${
              currentStatus === 'clocked_in'
                ? 'bg-gradient-to-r from-green-500 to-green-600'
                : 'bg-gradient-to-r from-gray-600 to-gray-700'
            }`}>
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="text-sm opacity-90 mb-1">Current Status</p>
                  <p className="text-2xl font-bold">
                    {currentStatus === 'clocked_in' ? 'Clocked In' : 'Clocked Out'}
                  </p>
                </div>
                <Clock className="w-12 h-12 opacity-80" />
              </div>
            </div>

            <div className="p-6 rounded-xl shadow-sm bg-gradient-to-r from-blue-500 to-blue-600">
              <div className="text-white">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => changeMonth('prev')}
                    className="p-1 hover:bg-white/20 rounded transition"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="text-center flex-1">
                    <p className="text-xs opacity-90 mb-1">{getMonthYearDisplay()}</p>
                    <p className="text-sm font-semibold">Days Worked</p>
                  </div>
                  <button
                    onClick={() => changeMonth('next')}
                    disabled={isCurrentMonth()}
                    className={`p-1 rounded transition ${
                      isCurrentMonth() ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-3xl font-bold text-center">{monthlyStats.daysWorked}</p>
                <p className="text-xs opacity-75 mt-1 text-center">{monthlyStats.totalClockIns} clock-ins</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setShowScanner(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg shadow-sm transition flex items-center justify-center gap-3"
            >
              <ScanLine className="w-6 h-6" />
              Scan QR Code to {currentStatus === 'clocked_out' ? 'Clock In' : 'Clock Out'}
            </button>

            {(employee?.role === 'field_worker' || employee?.role === 'field_supervisor') && (
              <button
                onClick={() => setShowWasteForm(true)}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg shadow-sm transition flex items-center justify-center gap-3"
              >
                <ClipboardList className="w-6 h-6" />
                Waste Management Form
              </button>
            )}
          </div>

          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Attendance</h2>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No attendance records yet</div>
          ) : (
            <div className="space-y-4">
              {logs.map((log: any, index: number) => (
                <div
                  key={log.date || index}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{log.site?.name}</h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {log.site?.address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-900 font-medium">{formatDate(log.date)}</span>
                  </div>
                  <div className="space-y-2">
                    {log.entries.filter((e: any) => e.type === 'clock_in').map((entry: any, idx: number) => {
                      const clockOut = log.entries.filter((e: any) => e.type === 'clock_out')[idx];
                      return (
                        <div key={idx} className="grid grid-cols-2 gap-4 p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              In
                            </span>
                            <span className="text-sm text-gray-900 flex items-center gap-1">
                              <Clock className="w-4 h-4 text-gray-500" />
                              {formatTime(entry.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                              Out
                            </span>
                            <span className="text-sm text-gray-900 flex items-center gap-1">
                              <Clock className="w-4 h-4 text-gray-500" />
                              {clockOut ? formatTime(clockOut.timestamp) : '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {log.totalDuration > 0 && employee?.role === 'admin' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Total Duration:</span>
                        <span className="text-sm font-bold text-gray-900">
                          {Math.floor(log.totalDuration / 60)}h {Math.round(log.totalDuration % 60)}m
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showWasteForm && (
        <WasteManagementForm
          onClose={() => setShowWasteForm(false)}
          onSuccess={() => {
            setMessage({ type: 'success', text: 'Waste management form submitted successfully' });
            setTimeout(() => setMessage(null), 5000);
          }}
        />
      )}

      {showPasswordForm && (
        <PasswordChangeForm
          onClose={() => setShowPasswordForm(false)}
          onSuccess={() => {
            setMessage({ type: 'success', text: 'Password updated successfully' });
            setTimeout(() => setMessage(null), 5000);
          }}
        />
      )}
    </div>
  );
}
