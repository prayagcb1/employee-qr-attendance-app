import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, MapPin, User, ChevronRight, ArrowLeft, CalendarCheck, RefreshCw } from 'lucide-react';

interface Employee {
  id: string;
  full_name: string;
  employee_code: string;
  email: string;
  role: string;
}

interface AttendanceLog {
  id: string;
  employee_id: string;
  site_id: string;
  event_type: 'clock_in' | 'clock_out';
  timestamp: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  sites: {
    name: string;
    address: string;
  };
}

interface AttendanceSession {
  date: string;
  siteName: string;
  siteAddress: string;
  entries: Array<{
    clockIn: {
      time: string;
      latitude: number;
      longitude: number;
      address?: string;
    } | null;
    clockOut: {
      time: string;
      latitude: number;
      longitude: number;
      address?: string;
    } | null;
    duration: string | null;
  }>;
  totalDuration: string | null;
}

interface MonthlyStats {
  month: string;
  year: number;
  daysWorked: number;
}

export function AttendanceView() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeLogs(selectedEmployee.id);
      if (selectedMonth) {
        calculateMonthlyStats(selectedEmployee.id, selectedMonth);
      }
    }
  }, [selectedEmployee, dateFilter, selectedMonth]);

  useEffect(() => {
    if (!selectedEmployee) return;

    const channel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_logs',
          filter: `employee_id=eq.${selectedEmployee.id}`,
        },
        () => {
          fetchEmployeeLogs(selectedEmployee.id);
          if (selectedMonth) {
            calculateMonthlyStats(selectedEmployee.id, selectedMonth);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEmployee, selectedMonth]);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, employee_code, email, role')
      .eq('active', true)
      .order('full_name');

    if (!error && data) {
      setEmployees(data);
    }
    setLoading(false);
  };

  const fetchEmployeeLogs = async (employeeId: string) => {
    setLoading(true);

    let query = supabase
      .from('attendance_logs')
      .select(`
        *,
        sites (
          name,
          address
        )
      `)
      .eq('employee_id', employeeId)
      .order('timestamp', { ascending: false });

    if (dateFilter) {
      const startOfDay = new Date(dateFilter);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateFilter);
      endOfDay.setHours(23, 59, 59, 999);

      query = query
        .gte('timestamp', startOfDay.toISOString())
        .lte('timestamp', endOfDay.toISOString());
    } else if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

      query = query
        .gte('timestamp', startOfMonth.toISOString())
        .lte('timestamp', endOfMonth.toISOString());
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching attendance logs:', error);
      setLogs([]);
      setSessions([]);
    } else if (data) {
      console.log('Fetched attendance logs:', data);
      setLogs(data);
      groupLogsIntoSessions(data);
    }
    setLoading(false);
  };

  const getAddressFromCoordinates = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'AttendanceSystem/1.0'
          }
        }
      );
      const data = await response.json();
      return data.display_name || 'Address not available';
    } catch (error) {
      return 'Address not available';
    }
  };

  const groupLogsIntoSessions = async (logs: AttendanceLog[]) => {
    const sessionMap = new Map<string, AttendanceSession>();

    const sortedLogs = [...logs].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sortedLogs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const key = `${date}-${log.site_id}`;

      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          date,
          siteName: log.sites.name,
          siteAddress: log.sites.address,
          entries: [],
          totalDuration: null,
        });
      }

      const session = sessionMap.get(key)!;

      if (log.event_type === 'clock_in') {
        session.entries.push({
          clockIn: {
            time: log.timestamp,
            latitude: log.latitude,
            longitude: log.longitude,
            address: 'Loading...',
          },
          clockOut: null,
          duration: null,
        });
      } else if (log.event_type === 'clock_out') {
        const lastEntry = session.entries[session.entries.length - 1];
        if (lastEntry && lastEntry.clockIn && !lastEntry.clockOut) {
          lastEntry.clockOut = {
            time: log.timestamp,
            latitude: log.latitude,
            longitude: log.longitude,
            address: 'Loading...',
          };

          const clockInTime = new Date(lastEntry.clockIn.time).getTime();
          const clockOutTime = new Date(lastEntry.clockOut.time).getTime();
          const durationMs = clockOutTime - clockInTime;
          const hours = Math.floor(durationMs / (1000 * 60 * 60));
          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          lastEntry.duration = formatHoursMinutes(hours, minutes);
        }
      }
    });

    sessionMap.forEach(session => {
      let totalMs = 0;
      session.entries.forEach(entry => {
        if (entry.clockIn && entry.clockOut) {
          const clockInTime = new Date(entry.clockIn.time).getTime();
          const clockOutTime = new Date(entry.clockOut.time).getTime();
          totalMs += clockOutTime - clockInTime;
        }
      });
      if (totalMs > 0) {
        const hours = Math.floor(totalMs / (1000 * 60 * 60));
        const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
        session.totalDuration = formatHoursMinutes(hours, minutes);
      }
    });

    const sessionsArray = Array.from(sessionMap.values()).sort((a, b) => {
      const dateA = new Date(a.entries[0]?.clockIn?.time || a.entries[0]?.clockOut?.time || 0);
      const dateB = new Date(b.entries[0]?.clockIn?.time || b.entries[0]?.clockOut?.time || 0);
      return dateB.getTime() - dateA.getTime();
    });
    setSessions(sessionsArray);

    const addressPromises: Promise<void>[] = [];
    sessionsArray.forEach((session, sessionIndex) => {
      session.entries.forEach((entry, entryIndex) => {
        if (entry.clockIn) {
          addressPromises.push(
            getAddressFromCoordinates(entry.clockIn.latitude, entry.clockIn.longitude).then(address => {
              sessionsArray[sessionIndex].entries[entryIndex].clockIn!.address = address;
            })
          );
        }
        if (entry.clockOut) {
          addressPromises.push(
            getAddressFromCoordinates(entry.clockOut.latitude, entry.clockOut.longitude).then(address => {
              sessionsArray[sessionIndex].entries[entryIndex].clockOut!.address = address;
            })
          );
        }
      });
    });

    Promise.all(addressPromises).then(() => {
      setSessions([...sessionsArray]);
    });
  };

  const calculateMonthlyStats = async (employeeId: string, monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

    const { data, error } = await supabase
      .from('attendance_logs')
      .select('timestamp, event_type')
      .eq('employee_id', employeeId)
      .eq('event_type', 'clock_in')
      .gte('timestamp', startOfMonth.toISOString())
      .lte('timestamp', endOfMonth.toISOString());

    if (!error && data) {
      const uniqueDays = new Set(
        data.map(log => new Date(log.timestamp).toDateString())
      );

      setMonthlyStats({
        month: new Date(startOfMonth).toLocaleDateString('en-US', { month: 'long' }),
        year: parseInt(year),
        daysWorked: uniqueDays.size,
      });
    }
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

  const formatHoursMinutes = (hours: number, minutes: number): string => {
    return `${hours}:${String(minutes).padStart(2, '0')} hr`;
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp =>
      emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  if (selectedEmployee) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-col space-y-4 mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSelectedEmployee(null);
                  setDateFilter('');
                  setSelectedMonth('');
                  setMonthlyStats(null);
                  setLogs([]);
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Back</span>
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{selectedEmployee.full_name}</h2>
                <p className="text-xs sm:text-sm text-gray-500 truncate">{selectedEmployee.employee_code} - {selectedEmployee.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <button
                onClick={() => {
                  if (selectedEmployee) {
                    fetchEmployeeLogs(selectedEmployee.id);
                    if (selectedMonth) {
                      calculateMonthlyStats(selectedEmployee.id, selectedMonth);
                    }
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm font-medium">Refresh</span>
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setDateFilter('');
                }}
                max={getCurrentMonth()}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setSelectedMonth('');
                  setMonthlyStats(null);
                }}
                max={getTodayDate()}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />

              {(dateFilter || selectedMonth) && (
                <button
                  onClick={() => {
                    setDateFilter('');
                    setSelectedMonth('');
                    setMonthlyStats(null);
                  }}
                  className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm bg-blue-50 rounded-lg"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {monthlyStats && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <CalendarCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Days Worked in {monthlyStats.month} {monthlyStats.year}</p>
                  <p className="text-3xl font-bold text-gray-900">{monthlyStats.daysWorked} Days</p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading records...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No attendance records found</div>
          ) : (
            <div className="space-y-6">
              {(() => {
                const groupedByDate = sessions.reduce((acc, session) => {
                  if (!acc[session.date]) {
                    acc[session.date] = [];
                  }
                  acc[session.date].push(session);
                  return acc;
                }, {} as Record<string, typeof sessions>);

                return Object.entries(groupedByDate).map(([date, dateSessions]) => {
                  let dailyTotalMs = 0;
                  dateSessions.forEach(session => {
                    session.entries.forEach(entry => {
                      if (entry.clockIn && entry.clockOut) {
                        const clockInTime = new Date(entry.clockIn.time).getTime();
                        const clockOutTime = new Date(entry.clockOut.time).getTime();
                        dailyTotalMs += clockOutTime - clockInTime;
                      }
                    });
                  });

                  const dailyTotalHours = Math.floor(dailyTotalMs / (1000 * 60 * 60));
                  const dailyTotalMinutes = Math.floor((dailyTotalMs % (1000 * 60 * 60)) / (1000 * 60));
                  const dailyTotalFormatted = dailyTotalMs > 0 ? formatHoursMinutes(dailyTotalHours, dailyTotalMinutes) : null;

                  return (
                  <div key={date} className="border-2 border-gray-300 rounded-xl p-4 sm:p-5 bg-gradient-to-br from-gray-50 to-white">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b-2 border-gray-300">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-bold text-gray-900">{date}</h3>
                        <span className="text-xs text-gray-500">
                          {dateSessions.length} {dateSessions.length === 1 ? 'site' : 'sites'}
                        </span>
                      </div>
                      {dailyTotalFormatted && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Daily Total:</span>
                          <span className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-base font-bold shadow-md">
                            {dailyTotalFormatted}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      {dateSessions.map((session, sessionIndex) => (
                        <div key={sessionIndex} className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 pb-3 border-b border-gray-200">
                            <div className="mb-2 sm:mb-0">
                              <p className="font-semibold text-gray-900 text-base">{session.siteName}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{session.siteAddress}</p>
                            </div>
                            {session.totalDuration && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Site Duration</p>
                                <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm font-bold">
                                  {session.totalDuration}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            {session.entries.map((entry, entryIndex) => (
                              <div key={entryIndex} className="bg-gray-50 rounded-lg p-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                                  <div>
                                    {entry.clockIn ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                                            Clock In
                                          </span>
                                          <p className="flex items-center gap-1 text-sm text-gray-900 font-medium">
                                            <Clock className="w-4 h-4 text-green-600" />
                                            {formatTime(entry.clockIn.time)}
                                          </p>
                                        </div>
                                        <div className="flex items-start gap-1 text-xs text-gray-600">
                                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="mb-1 line-clamp-2">{entry.clockIn.address}</p>
                                            <a
                                              href={`https://www.google.com/maps?q=${entry.clockIn.latitude},${entry.clockIn.longitude}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:text-blue-700 underline"
                                            >
                                              View Map
                                            </a>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400 text-sm">-</span>
                                    )}
                                  </div>
                                  <div>
                                    {entry.clockOut ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                                            Clock Out
                                          </span>
                                          <p className="flex items-center gap-1 text-sm text-gray-900 font-medium">
                                            <Clock className="w-4 h-4 text-red-600" />
                                            {formatTime(entry.clockOut.time)}
                                          </p>
                                        </div>
                                        <div className="flex items-start gap-1 text-xs text-gray-600">
                                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="mb-1 line-clamp-2">{entry.clockOut.address}</p>
                                            <a
                                              href={`https://www.google.com/maps?q=${entry.clockOut.latitude},${entry.clockOut.longitude}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:text-blue-700 underline"
                                            >
                                              View Map
                                            </a>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center h-full">
                                        <span className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-semibold">Active</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-start md:items-center md:justify-end">
                                    {entry.duration && (
                                      <div>
                                        <p className="text-xs text-gray-500 mb-1 md:text-right">Duration</p>
                                        <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-bold inline-block">
                                          {entry.duration}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-gray-900">Employee Attendance</h2>
        <input
          type="text"
          placeholder="Search employees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading employees...</div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No employees found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee) => (
            <button
              key={employee.id}
              onClick={() => setSelectedEmployee(employee)}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{employee.full_name}</p>
                  <p className="text-sm text-gray-500">{employee.employee_code}</p>
                  <p className="text-xs text-gray-400">{employee.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
