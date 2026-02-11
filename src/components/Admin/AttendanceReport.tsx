import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { exportAttendanceToExcel } from '../../utils/excelExport';
import { Search, Filter, X, ChevronLeft, ChevronRight, Calendar, FileDown, Check } from 'lucide-react';

interface EmployeeAttendance {
  id: string;
  employee_code: string;
  full_name: string;
  role: string;
  total_days_present: number;
  total_hours_week: number;
  expected_hours_week: number;
  total_hours_month: number;
  avg_hours_per_day: number;
  last_active_date: string | null;
}

interface DailyAttendance {
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: 'present' | 'absent' | 'incomplete' | 'not_applicable' | 'leave' | 'wfh' | 'incomplete_wfh';
  hours_worked: number;
}

export function AttendanceReport() {
  const [employees, setEmployees] = useState<EmployeeAttendance[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeAttendance | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendance[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedMonthsForExport, setSelectedMonthsForExport] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const roles = ['all', 'field_worker', 'field_supervisor', 'intern', 'office_employee', 'admin', 'manager'];
  const roleOrder: Record<string, number> = {
    'field_worker': 1,
    'field_supervisor': 2,
    'intern': 3,
    'office_employee': 4,
    'admin': 5,
    'manager': 6
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [selectedMonth]);

  useEffect(() => {
    filterEmployees();
  }, [searchTerm, selectedRole, employees]);

  async function fetchAttendanceData() {
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const now = new Date();
      const monthEnd = new Date(year, month, 0);
      const referenceDate = now < monthEnd ? now : monthEnd;

      const dayOfWeek = referenceDate.getDay();
      const weekStart = new Date(referenceDate);
      weekStart.setDate(referenceDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      weekStart.setHours(0, 0, 0, 0);

      if (weekStart < startDate) {
        weekStart.setTime(startDate.getTime());
      }

      const { data: employeesData, error: empError } = await supabase
        .from('employees')
        .select('id, employee_code, full_name, role')
        .order('full_name');

      if (empError) throw empError;

      const attendancePromises = (employeesData || []).map(async (emp) => {
        const { data: monthLogs } = await supabase
          .from('attendance_logs')
          .select('event_type, timestamp')
          .eq('employee_id', emp.id)
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .order('timestamp');

        const { data: wfhLogs } = await supabase
          .from('wfh_attendance')
          .select('date, duration_minutes, status')
          .eq('employee_id', emp.id)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0])
          .in('status', ['complete', 'incomplete']);

        const { data: lastActive } = await supabase
          .from('attendance_logs')
          .select('timestamp')
          .eq('employee_id', emp.id)
          .eq('event_type', 'clock_in')
          .order('timestamp', { ascending: false })
          .limit(1);

        const monthPairs = pairClockInOut(monthLogs || []);

        const wfhHoursMap = new Map<string, number>();
        (wfhLogs || []).forEach(log => {
          if (log.status === 'complete' && log.duration_minutes) {
            wfhHoursMap.set(log.date, log.duration_minutes / 60);
          }
        });

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const totalHoursWeek = monthPairs
          .filter(pair => {
            const pairDate = new Date(pair.date);
            return pairDate >= weekStart && pairDate <= weekEnd;
          })
          .reduce((sum, pair) => sum + pair.hours, 0);

        const wfhHoursWeek = Array.from(wfhHoursMap.entries())
          .filter(([date]) => {
            const wfhDate = new Date(date);
            return wfhDate >= weekStart && wfhDate <= weekEnd;
          })
          .reduce((sum, [, hours]) => sum + hours, 0);

        const isFieldRole = emp.role === 'field_worker' || emp.role === 'field_supervisor';
        let expectedWorkdays = 0;
        const currentWeekDate = new Date(weekStart);
        while (currentWeekDate <= weekEnd && currentWeekDate <= endDate) {
          const dayOfWeek = currentWeekDate.getDay();
          const isWorkday = isFieldRole ? dayOfWeek !== 0 : (dayOfWeek !== 0 && dayOfWeek !== 6);
          if (isWorkday) expectedWorkdays++;
          currentWeekDate.setDate(currentWeekDate.getDate() + 1);
        }
        const expectedHoursWeek = expectedWorkdays * 8;

        const totalDaysPresent = monthPairs.length + (wfhLogs || []).filter(log => log.status === 'complete').length;
        const totalHoursMonth = monthPairs.reduce((sum, pair) => sum + pair.hours, 0) +
                                Array.from(wfhHoursMap.values()).reduce((sum, hours) => sum + hours, 0);

        return {
          id: emp.id,
          employee_code: emp.employee_code,
          full_name: emp.full_name,
          role: emp.role,
          total_days_present: totalDaysPresent,
          total_hours_week: totalHoursWeek + wfhHoursWeek,
          expected_hours_week: expectedHoursWeek,
          total_hours_month: totalHoursMonth,
          avg_hours_per_day: totalDaysPresent > 0 ? totalHoursMonth / totalDaysPresent : 0,
          last_active_date: lastActive?.[0]?.timestamp || null,
        };
      });

      const attendanceData = await Promise.all(attendancePromises);
      setEmployees(attendanceData);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  }

  function pairClockInOut(logs: { event_type: string; timestamp: string }[]) {
    const pairs: { date: string; clock_in: string; clock_out: string; hours: number }[] = [];
    const dateMap = new Map<string, { clock_in?: string; clock_out?: string }>();

    logs.forEach((log) => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, {});
      }
      const entry = dateMap.get(date)!;
      if (log.event_type === 'clock_in' && !entry.clock_in) {
        entry.clock_in = log.timestamp;
      } else if (log.event_type === 'clock_out' && !entry.clock_out) {
        entry.clock_out = log.timestamp;
      }
    });

    dateMap.forEach((entry, date) => {
      if (entry.clock_in && entry.clock_out) {
        const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
        pairs.push({
          date,
          clock_in: entry.clock_in,
          clock_out: entry.clock_out,
          hours,
        });
      }
    });

    return pairs;
  }

  function filterEmployees() {
    let filtered = employees;

    if (searchTerm) {
      filtered = filtered.filter((emp) =>
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedRole !== 'all') {
      filtered = filtered.filter((emp) => emp.role === selectedRole);
    }

    filtered = filtered.sort((a, b) => {
      const roleA = roleOrder[a.role] || 999;
      const roleB = roleOrder[b.role] || 999;
      if (roleA !== roleB) {
        return roleA - roleB;
      }
      return a.full_name.localeCompare(b.full_name);
    });

    setFilteredEmployees(filtered);
  }

  async function fetchDailyAttendance(employeeId: string, employeeRole: string) {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyData: DailyAttendance[] = [];

    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('event_type, timestamp, site_id')
      .eq('employee_id', employeeId)
      .gte('timestamp', new Date(year, month - 1, 1).toISOString())
      .lte('timestamp', new Date(year, month, 0, 23, 59, 59).toISOString())
      .order('timestamp');

    const { data: wfhLogs } = await supabase
      .from('wfh_attendance')
      .select('date, clock_in_time, clock_out_time, duration_minutes, status')
      .eq('employee_id', employeeId)
      .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lte('date', `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`);

    const { data: leaveLogs } = await supabase
      .from('leave_attendance')
      .select('date')
      .eq('employee_id', employeeId)
      .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lte('date', `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`);

    const dateSiteMap = new Map<string, Map<string, { clock_ins: string[]; clock_outs: string[] }>>();
    (logs || []).forEach((log) => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      if (!dateSiteMap.has(date)) {
        dateSiteMap.set(date, new Map());
      }
      const siteMap = dateSiteMap.get(date)!;
      if (!siteMap.has(log.site_id)) {
        siteMap.set(log.site_id, { clock_ins: [], clock_outs: [] });
      }
      const siteEntry = siteMap.get(log.site_id)!;
      if (log.event_type === 'clock_in') {
        siteEntry.clock_ins.push(log.timestamp);
      } else if (log.event_type === 'clock_out') {
        siteEntry.clock_outs.push(log.timestamp);
      }
    });

    const wfhMap = new Map<string, any>();
    (wfhLogs || []).forEach(log => {
      wfhMap.set(log.date, log);
    });

    const leaveSet = new Set<string>();
    (leaveLogs || []).forEach(log => {
      leaveSet.add(log.date);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isFieldRole = employeeRole === 'field_worker' || employeeRole === 'field_supervisor';

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const currentDate = new Date(year, month - 1, day);
      const siteMap = dateSiteMap.get(date);
      const wfhData = wfhMap.get(date);
      const isLeave = leaveSet.has(date);

      let status: 'present' | 'absent' | 'incomplete' | 'not_applicable' | 'leave' | 'wfh' | 'incomplete_wfh' = 'absent';
      let hours_worked = 0;
      let hasClockIn = false;
      let hasIncomplete = false;
      let firstClockIn: string | null = null;
      let lastClockOut: string | null = null;

      if (isLeave) {
        status = 'leave';
      } else if (wfhData) {
        if (wfhData.status === 'complete' && wfhData.duration_minutes) {
          status = 'wfh';
          hours_worked = wfhData.duration_minutes / 60;
          firstClockIn = wfhData.clock_in_time;
          lastClockOut = wfhData.clock_out_time;
        } else if (wfhData.status === 'incomplete') {
          status = 'incomplete_wfh';
          firstClockIn = wfhData.clock_in_time;
        } else if (wfhData.status === 'active') {
          status = 'wfh';
          firstClockIn = wfhData.clock_in_time;
        }
      } else if (siteMap) {
        siteMap.forEach((siteEntry) => {
          siteEntry.clock_ins.forEach((clockIn, index) => {
            hasClockIn = true;
            if (!firstClockIn) firstClockIn = clockIn;

            if (siteEntry.clock_outs[index]) {
              const clockOut = siteEntry.clock_outs[index];
              lastClockOut = clockOut;
              const duration = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
              hours_worked += duration;
            } else {
              hasIncomplete = true;
            }
          });
        });

        if (currentDate > today) {
          status = 'not_applicable';
        } else {
          const dayOfWeek = currentDate.getDay();
          const isSunday = dayOfWeek === 0;
          const isSaturday = dayOfWeek === 6;

          if (isSunday) {
            status = 'not_applicable';
          } else if (isSaturday && !isFieldRole) {
            if (hasClockIn && hours_worked > 0) {
              status = 'present';
            } else if (hasIncomplete) {
              status = 'incomplete';
            } else {
              status = 'not_applicable';
            }
          } else if (hasClockIn && hours_worked > 0) {
            status = 'present';
          } else if (hasIncomplete) {
            status = 'incomplete';
          } else {
            const now = new Date();
            const isToday = currentDate.getTime() === today.getTime();
            const currentHour = now.getHours();

            if (isToday && currentHour < 18) {
              status = 'not_applicable';
            } else {
              status = 'absent';
            }
          }
        }
      } else if (currentDate > today) {
        status = 'not_applicable';
      } else {
        const dayOfWeek = currentDate.getDay();
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;

        if (isSunday) {
          status = 'not_applicable';
        } else if (isSaturday && !isFieldRole) {
          status = 'not_applicable';
        } else {
          const now = new Date();
          const isToday = currentDate.getTime() === today.getTime();
          const currentHour = now.getHours();

          if (isToday && currentHour < 18) {
            status = 'not_applicable';
          } else {
            status = 'absent';
          }
        }
      }

      dailyData.push({
        date,
        clock_in: firstClockIn,
        clock_out: lastClockOut,
        status,
        hours_worked,
      });
    }

    setDailyAttendance(dailyData);
  }

  function handleRowClick(employee: EmployeeAttendance) {
    setSelectedEmployee(employee);
    fetchDailyAttendance(employee.id, employee.role);
    setShowDetail(true);
  }

  function closeDetail() {
    setShowDetail(false);
    setSelectedEmployee(null);
    setDailyAttendance([]);
  }

  function formatRole(role: string) {
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  function formatHoursMinutes(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${String(m).padStart(2, '0')} hr`;
  }

  function getAvgHoursColor(hours: number) {
    if (hours >= 8) return 'text-green-600';
    if (hours >= 6) return 'text-yellow-600';
    return 'text-red-600';
  }

  function getInactiveColor(lastActive: string | null) {
    if (!lastActive) return 'text-red-600';
    const daysSince = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 7) return 'text-red-600';
    if (daysSince > 3) return 'text-yellow-600';
    return 'text-green-600';
  }

  function generateAvailableMonths(): string[] {
    const months: string[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    for (let year = currentYear; year >= currentYear - 1; year--) {
      const startMonth = year === currentYear ? currentMonth : 12;
      const endMonth = year === currentYear - 1 ? Math.max(1, currentMonth - 11) : 1;

      for (let month = startMonth; month >= endMonth; month--) {
        months.push(`${year}-${String(month).padStart(2, '0')}`);
      }
    }

    return months;
  }

  function toggleMonthForExport(month: string) {
    setSelectedMonthsForExport(prev =>
      prev.includes(month)
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  }

  async function handleExport() {
    if (selectedMonthsForExport.length === 0) return;

    setExporting(true);
    const result = await exportAttendanceToExcel(selectedMonthsForExport);
    setExporting(false);

    if (result.success) {
      setShowExportModal(false);
      setSelectedMonthsForExport([]);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or employee code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition whitespace-nowrap"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">Export Excel</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role === 'all' ? 'All Roles' : formatRole(role)}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading attendance data...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[795px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Role</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Days</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Week</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Month</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Avg/Day</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No employees found
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => handleRowClick(emp)}
                      className="hover:bg-gray-50 cursor-pointer transition"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-sm text-gray-900">{emp.full_name}</div>
                        <div className="text-xs text-gray-500">{emp.employee_code}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {formatRole(emp.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-sm text-gray-900 whitespace-nowrap">
                        {emp.total_days_present}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-sm text-gray-900 whitespace-nowrap">
                        {formatHoursMinutes(emp.total_hours_week)}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-sm text-gray-900 whitespace-nowrap">
                        {formatHoursMinutes(emp.total_hours_month)}
                      </td>
                      <td className={`px-4 py-3 text-center font-semibold text-sm whitespace-nowrap ${getAvgHoursColor(emp.avg_hours_per_day)}`}>
                        {formatHoursMinutes(emp.avg_hours_per_day)}
                      </td>
                      <td className={`px-4 py-3 text-center text-sm whitespace-nowrap ${getInactiveColor(emp.last_active_date)}`}>
                        {emp.last_active_date
                          ? new Date(emp.last_active_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : 'Never'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showDetail && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{selectedEmployee.full_name}</h3>
                <p className="text-xs sm:text-sm text-gray-600 truncate">{selectedEmployee.employee_code} - {formatRole(selectedEmployee.role)}</p>
              </div>
              <button
                onClick={closeDetail}
                className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600">Days Present</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{selectedEmployee.total_days_present}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600">Week Hours</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatHoursMinutes(selectedEmployee.total_hours_week)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600">Month Hours</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">{formatHoursMinutes(selectedEmployee.total_hours_month)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600">Avg Hours/Day</p>
                  <p className={`text-lg sm:text-xl font-bold ${getAvgHoursColor(selectedEmployee.avg_hours_per_day)}`}>
                    {formatHoursMinutes(selectedEmployee.avg_hours_per_day)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
                <h4 className="font-semibold text-sm sm:text-base text-gray-900">
                  Daily Attendance - {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h4>
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <div key={day} className="text-center text-[10px] sm:text-xs font-semibold text-gray-600 py-1 sm:py-2">
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{day.charAt(0)}</span>
                  </div>
                ))}

                {Array.from({ length: new Date(selectedMonth + '-01').getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {dailyAttendance.map((day) => {
                  const date = new Date(day.date);

                  const getStatusDisplay = () => {
                    switch (day.status) {
                      case 'present': return 'P';
                      case 'incomplete': return 'I';
                      case 'absent': return 'A';
                      case 'leave': return 'L';
                      case 'wfh': return 'W';
                      case 'incomplete_wfh': return 'I-W';
                      case 'not_applicable': return '—';
                      default: return '—';
                    }
                  };

                  const getStatusColors = () => {
                    switch (day.status) {
                      case 'present': return 'bg-green-50 border-green-300 text-green-600';
                      case 'incomplete': return 'bg-yellow-50 border-yellow-300 text-yellow-600';
                      case 'absent': return 'bg-red-50 border-red-300 text-red-600';
                      case 'leave': return 'bg-orange-50 border-orange-300 text-orange-600';
                      case 'wfh': return 'bg-purple-50 border-purple-300 text-purple-600';
                      case 'incomplete_wfh': return 'bg-yellow-50 border-yellow-300 text-yellow-600';
                      case 'not_applicable': return 'bg-gray-100 border-gray-300 text-gray-400';
                      default: return 'bg-gray-100 border-gray-300 text-gray-400';
                    }
                  };

                  return (
                    <div
                      key={day.date}
                      className={`aspect-square border rounded-lg p-1 sm:p-2 flex flex-col items-center justify-center ${getStatusColors()}`}
                    >
                      <div className="text-[10px] sm:text-xs font-medium text-gray-700">{date.getDate()}</div>
                      <div className="text-sm sm:text-lg font-bold">
                        {getStatusDisplay()}
                      </div>
                      {(day.status === 'present' || day.status === 'wfh') && day.hours_worked > 0 && (
                        <div className="text-[9px] sm:text-xs text-gray-600 text-center leading-tight">{formatHoursMinutes(day.hours_worked)}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 sm:mt-4 flex gap-2 sm:gap-4 justify-center text-xs sm:text-sm flex-wrap">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-50 border border-green-300 rounded"></div>
                  <span className="text-gray-600">P - Present</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-purple-50 border border-purple-300 rounded"></div>
                  <span className="text-gray-600">W - WFH</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-orange-50 border border-orange-300 rounded"></div>
                  <span className="text-gray-600">L - Leave</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-yellow-50 border border-yellow-300 rounded"></div>
                  <span className="text-gray-600">I/I-W - Incomplete</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-50 border border-red-300 rounded"></div>
                  <span className="text-gray-600">A - Absent</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-100 border border-gray-300 rounded"></div>
                  <span className="text-gray-600">— - Weekend/Future</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Export Attendance to Excel</h3>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setSelectedMonthsForExport([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-600 mb-4">
                Select the months you want to include in the Excel export. Each month will be added as a separate sheet.
              </p>

              <div className="space-y-2">
                {generateAvailableMonths().map(month => {
                  const [year, monthNum] = month.split('-').map(Number);
                  const monthDate = new Date(year, monthNum - 1, 1);
                  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  const isSelected = selectedMonthsForExport.includes(month);

                  return (
                    <button
                      key={month}
                      onClick={() => toggleMonthForExport(month)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition ${
                        isSelected
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <span className={`font-medium ${isSelected ? 'text-green-900' : 'text-gray-700'}`}>
                        {monthLabel}
                      </span>
                      {isSelected && (
                        <Check className="w-5 h-5 text-green-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    setSelectedMonthsForExport([]);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={selectedMonthsForExport.length === 0 || exporting}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
                >
                  {exporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      Export {selectedMonthsForExport.length} {selectedMonthsForExport.length === 1 ? 'Month' : 'Months'}
                    </>
                  )}
                </button>
              </div>
              {selectedMonthsForExport.length > 0 && (
                <p className="text-xs text-gray-600 mt-2 text-center">
                  {selectedMonthsForExport.length} month{selectedMonthsForExport.length === 1 ? '' : 's'} selected
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
