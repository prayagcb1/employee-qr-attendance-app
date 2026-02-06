import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { QRScanner } from '../Scanner/QRScanner';
import { WasteManagementForm } from './WasteManagementForm';
import { PasswordChangeForm } from './PasswordChangeForm';
import { LeaveRequestForm } from './LeaveRequestForm';
import { WFHButton } from './WFHButton';
import { LogOut, ScanLine, Clock, MapPin, Calendar, ClipboardList, ChevronLeft, ChevronRight, Lock, CalendarCheck, Home, Briefcase, FileText } from 'lucide-react';

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

interface LeaveRequest {
  id: string;
  request_type: 'leave' | 'wfh';
  start_date: string;
  end_date: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  rejection_reason: string | null;
}

interface EmployeeDashboardProps {
  hideHeader?: boolean;
}

export function EmployeeDashboard({ hideHeader = false }: EmployeeDashboardProps = {}) {
  const { employee, signOut } = useAuth();
  const [showScanner, setShowScanner] = useState(false);
  const [showWasteForm, setShowWasteForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showLeaveRequestForm, setShowLeaveRequestForm] = useState(false);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentStatus, setCurrentStatus] = useState<'clocked_out' | 'clocked_in'>('clocked_out');
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(null);
  const [monthlyStats, setMonthlyStats] = useState({ daysWorked: 0, totalClockIns: 0 });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [todayLeaveWFHStatus, setTodayLeaveWFHStatus] = useState<'none' | 'leave' | 'wfh'>('none');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showLeaveStatus, setShowLeaveStatus] = useState(false);

  useEffect(() => {
    fetchLogs();
    checkCurrentStatus();
    checkTodayLeaveWFHStatus();
    fetchLeaveRequests();
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
        const key = `${date}-${log.site_id}`;

        if (!grouped[key]) {
          grouped[key] = {
            date,
            entries: [],
            site: log.sites,
            siteId: log.site_id,
            timestamp: log.timestamp
          };
        }

        grouped[key].entries.push({
          type: log.event_type,
          timestamp: log.timestamp
        });
      });

      Object.values(grouped).forEach((day: any) => {
        day.entries.sort((a: any, b: any) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
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
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
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
      .select('event_type, site_id, timestamp')
      .eq('employee_id', employee.id)
      .order('timestamp', { ascending: false });

    if (data && data.length > 0) {
      const siteStatus: { [key: string]: string } = {};

      data.forEach(log => {
        if (!siteStatus[log.site_id]) {
          siteStatus[log.site_id] = log.event_type;
        }
      });

      const hasOpenClockIn = Object.values(siteStatus).some(status => status === 'clock_in');

      setCurrentStatus(hasOpenClockIn ? 'clocked_in' : 'clocked_out');
      setCurrentSiteId(hasOpenClockIn ? Object.keys(siteStatus).find(id => siteStatus[id] === 'clock_in') || null : null);
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

  const checkTodayLeaveWFHStatus = async () => {
    if (!employee) return;

    const today = new Date().toISOString().split('T')[0];

    const { data: leaveData } = await supabase
      .from('leave_attendance')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('date', today)
      .maybeSingle();

    if (leaveData) {
      setTodayLeaveWFHStatus('leave');
      return;
    }

    const { data: approvedWFH } = await supabase
      .from('leave_requests')
      .select('id, start_date, end_date')
      .eq('employee_id', employee.id)
      .eq('request_type', 'wfh')
      .eq('status', 'approved')
      .lte('start_date', today);

    if (approvedWFH && approvedWFH.length > 0) {
      const hasWFHToday = approvedWFH.some(req =>
        req.end_date ? req.end_date >= today : req.start_date === today
      );
      if (hasWFHToday) {
        setTodayLeaveWFHStatus('wfh');
        return;
      }
    }

    setTodayLeaveWFHStatus('none');
  };

  const fetchLeaveRequests = async () => {
    if (!employee) return;

    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employee.id)
      .order('requested_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setLeaveRequests(data);
    }
  };

  const handleScan = async (qrData: string) => {
    setShowScanner(false);
    setMessage({ type: 'success', text: 'Processing...' });

    if (!employee) {
      setMessage({ type: 'error', text: 'Employee information not found' });
      return;
    }

    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported' });
      return;
    }

    const geolocationOptions = {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 30000
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          const { data: site, error: siteError } = await supabase
            .from('sites')
            .select('id, name')
            .eq('qr_code_data', qrData)
            .eq('active', true)
            .maybeSingle();

          if (siteError || !site) {
            setMessage({ type: 'error', text: 'Invalid QR code' });
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
            return;
          }

          const eventType = !lastLog || lastLog.event_type === 'clock_out' ? 'clock_in' : 'clock_out';

          if (eventType === 'clock_out' && lastLog && lastLog.site_id !== site.id) {
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
            console.error('Attendance log error:', logError);
            setMessage({ type: 'error', text: 'Failed to log attendance' });
          } else {
            const action = eventType === 'clock_in' ? 'Clocked In' : 'Clocked Out';
            setMessage({ type: 'success', text: `${action} at ${site.name}` });
            setCurrentStatus(eventType === 'clock_in' ? 'clocked_in' : 'clocked_out');
            setCurrentSiteId(eventType === 'clock_in' ? site.id : null);
            fetchLogs();
            fetchMonthlyStats();
          }
        } catch (err) {
          console.error('Scan error:', err);
          setMessage({ type: 'error', text: 'Failed to process scan' });
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setMessage({ type: 'error', text: 'Enable location services' });
      },
      geolocationOptions
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
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{employee?.full_name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-xs sm:text-sm text-gray-600">{employee?.employee_code}</p>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 whitespace-nowrap">
                  {employee?.role === 'field_worker' && 'Field Worker'}
                  {employee?.role === 'field_supervisor' && 'Field Supervisor'}
                  {employee?.role === 'intern' && 'Intern'}
                  {employee?.role === 'office_employee' && 'Office Employee'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPasswordForm(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
                title="Change Password"
              >
                <Lock className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Change Password</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>}

      <main className={hideHeader ? '' : 'max-w-7xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8'}>
        <div className="mb-6 sm:mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className={`p-4 sm:p-6 rounded-xl shadow-sm col-span-1 md:col-span-2 ${
              currentStatus === 'clocked_in'
                ? 'bg-gradient-to-r from-green-500 to-green-600'
                : 'bg-gradient-to-r from-gray-600 to-gray-700'
            }`}>
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="text-xs sm:text-sm opacity-90 mb-1">Current Status</p>
                  <p className="text-xl sm:text-2xl font-bold">
                    {currentStatus === 'clocked_in' ? 'Clocked In' : 'Clocked Out'}
                  </p>
                </div>
                <Clock className="w-10 h-10 sm:w-12 sm:h-12 opacity-80" />
              </div>
            </div>

            <div className="p-4 sm:p-6 rounded-xl shadow-sm bg-gradient-to-r from-blue-500 to-blue-600">
              <div className="text-white">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <button
                    onClick={() => changeMonth('prev')}
                    className="p-1 hover:bg-white/20 rounded transition"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <div className="text-center flex-1">
                    <p className="text-xs opacity-90 mb-0.5">{getMonthYearDisplay()}</p>
                    <p className="text-xs sm:text-sm font-semibold">Days Worked</p>
                  </div>
                  <button
                    onClick={() => changeMonth('next')}
                    disabled={isCurrentMonth()}
                    className={`p-1 rounded transition ${
                      isCurrentMonth() ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'
                    }`}
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-center">{monthlyStats.daysWorked}</p>
                <p className="text-xs opacity-75 mt-1 text-center">{monthlyStats.totalClockIns} clock-ins</p>
              </div>
            </div>
          </div>

          {todayLeaveWFHStatus === 'leave' ? (
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-center gap-3 text-white">
                <Briefcase className="w-8 h-8" />
                <div className="text-center">
                  <p className="text-xl font-bold">On Leave Today</p>
                  <p className="text-sm opacity-90">Enjoy your time off</p>
                </div>
              </div>
            </div>
          ) : todayLeaveWFHStatus === 'wfh' ? (
            <div className="space-y-4">
              <WFHButton employeeId={employee!.id} date={new Date().toISOString().split('T')[0]} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <button
                onClick={() => setShowScanner(true)}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-4 px-4 sm:px-6 rounded-lg shadow-sm transition flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
              >
                <ScanLine className="w-5 h-5 sm:w-6 sm:h-6" />
                <span>Scan Site QR Code</span>
              </button>

              {(employee?.role === 'field_worker' || employee?.role === 'field_supervisor') && (
                <button
                  onClick={() => setShowWasteForm(true)}
                  className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-4 px-4 sm:px-6 rounded-lg shadow-sm transition flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
                >
                  <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>Waste Management Form</span>
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
            <button
              onClick={() => setShowLeaveRequestForm(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold py-4 px-4 sm:px-6 rounded-lg shadow-sm transition flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
            >
              <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>Request Leave or WFH</span>
            </button>

            <button
              onClick={() => setShowLeaveStatus(!showLeaveStatus)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-4 px-4 sm:px-6 rounded-lg shadow-sm transition flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
            >
              <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>{showLeaveStatus ? 'Hide' : 'View'} Request Status</span>
            </button>
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

        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Recent Attendance</h2>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No attendance records yet</div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {logs.map((log: any, index: number) => (
                <div
                  key={log.date || index}
                  className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1 truncate">{log.site?.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 flex items-start gap-1">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{log.site?.address}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                    <span className="text-xs sm:text-sm text-gray-900 font-medium">{formatDate(log.date)}</span>
                  </div>
                  <div className="space-y-2">
                    {log.entries.filter((e: any) => e.type === 'clock_in').map((entry: any, idx: number) => {
                      const clockOut = log.entries.filter((e: any) => e.type === 'clock_out')[idx];
                      return (
                        <div key={idx} className="grid grid-cols-2 gap-3 sm:gap-4 p-2 sm:p-3 bg-gray-50 rounded">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="px-1.5 sm:px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              In
                            </span>
                            <span className="text-xs sm:text-sm text-gray-900 flex items-center gap-1">
                              <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                              {formatTime(entry.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="px-1.5 sm:px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                              Out
                            </span>
                            <span className="text-xs sm:text-sm text-gray-900 flex items-center gap-1">
                              <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
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

        {showLeaveStatus && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mt-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">My Leave & WFH Requests</h2>
            {leaveRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No leave or WFH requests yet</div>
            ) : (
            <div className="space-y-3 sm:space-y-4">
              {leaveRequests.map((request) => (
                <div
                  key={request.id}
                  className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {request.request_type === 'wfh' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-lg text-xs sm:text-sm font-semibold">
                          <Home className="w-3 h-3 sm:w-4 sm:h-4" />
                          Work From Home
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs sm:text-sm font-semibold">
                          <Briefcase className="w-3 h-3 sm:w-4 sm:h-4" />
                          Leave
                        </span>
                      )}
                    </div>
                    {request.status === 'pending' && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-xs font-semibold whitespace-nowrap">
                        Pending
                      </span>
                    )}
                    {request.status === 'approved' && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-semibold whitespace-nowrap">
                        Approved
                      </span>
                    )}
                    {request.status === 'rejected' && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-semibold whitespace-nowrap">
                        Rejected
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="font-medium">
                        {new Date(request.start_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        {request.end_date && (
                          <> - {new Date(request.end_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}</>
                        )}
                      </span>
                    </div>

                    {request.reason && (
                      <div className="flex items-start gap-2 text-gray-600">
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                        <span>{request.reason}</span>
                      </div>
                    )}

                    {request.status === 'rejected' && request.rejection_reason && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3 mt-2">
                        <p className="text-xs sm:text-sm text-red-800">
                          <span className="font-semibold">Rejection Reason:</span> {request.rejection_reason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}
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

      {showLeaveRequestForm && (
        <LeaveRequestForm
          employeeId={employee!.id}
          employeeRole={employee!.role}
          onClose={() => setShowLeaveRequestForm(false)}
          onSuccess={() => {
            setMessage({ type: 'success', text: 'Request submitted successfully' });
            setTimeout(() => setMessage(null), 5000);
          }}
        />
      )}
    </div>
  );
}
