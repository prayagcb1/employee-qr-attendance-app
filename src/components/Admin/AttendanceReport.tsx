import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Filter, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface EmployeeAttendance {
  id: string;
  employee_code: string;
  full_name: string;
  role: string;
  total_days_present: number;
  total_hours_week: number;
  total_hours_month: number;
  avg_hours_per_day: number;
  last_active_date: string | null;
}

interface DailyAttendance {
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: 'present' | 'absent' | 'incomplete' | 'not_applicable';
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

  const roles = ['all', 'field_worker', 'field_supervisor', 'intern', 'office_employee', 'admin', 'manager'];

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
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      weekStart.setHours(0, 0, 0, 0);

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

        const { data: weekLogs } = await supabase
          .from('attendance_logs')
          .select('event_type, timestamp')
          .eq('employee_id', emp.id)
          .gte('timestamp', weekStart.toISOString())
          .order('timestamp');

        const { data: lastActive } = await supabase
          .from('attendance_logs')
          .select('timestamp')
          .eq('employee_id', emp.id)
          .eq('event_type', 'clock_in')
          .order('timestamp', { ascending: false })
          .limit(1);

        const monthPairs = pairClockInOut(monthLogs || []);
        const weekPairs = pairClockInOut(weekLogs || []);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const totalHoursWeek = weekPairs
          .filter(pair => {
            const pairDate = new Date(pair.date);
            return pairDate >= weekStart && pairDate <= weekEnd;
          })
          .reduce((sum, pair) => sum + pair.hours, 0);

        const totalDaysPresent = monthPairs.length;
        const totalHoursMonth = monthPairs.reduce((sum, pair) => sum + pair.hours, 0);

        return {
          id: emp.id,
          employee_code: emp.employee_code,
          full_name: emp.full_name,
          role: emp.role,
          total_days_present: totalDaysPresent,
          total_hours_week: totalHoursWeek,
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

    setFilteredEmployees(filtered);
  }

  async function fetchDailyAttendance(employeeId: string) {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyData: DailyAttendance[] = [];

    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('event_type, timestamp')
      .eq('employee_id', employeeId)
      .gte('timestamp', new Date(year, month - 1, 1).toISOString())
      .lte('timestamp', new Date(year, month, 0, 23, 59, 59).toISOString())
      .order('timestamp');

    const dateMap = new Map<string, { clock_in?: string; clock_out?: string }>();
    (logs || []).forEach((log) => {
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const employeeRole = selectedEmployee?.role || '';
    const isFieldRole = employeeRole === 'field_worker' || employeeRole === 'field_supervisor';

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const currentDate = new Date(year, month - 1, day);
      const record = dateMap.get(date);

      let status: 'present' | 'absent' | 'incomplete' | 'not_applicable' = 'absent';
      let hours_worked = 0;

      if (currentDate > today) {
        status = 'not_applicable';
      } else {
        const dayOfWeek = currentDate.getDay();
        const isHoliday = isFieldRole ? dayOfWeek === 0 : (dayOfWeek === 0 || dayOfWeek === 6);

        if (isHoliday) {
          status = 'not_applicable';
        } else if (record?.clock_in && record?.clock_out) {
          status = 'present';
          hours_worked = (new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime()) / (1000 * 60 * 60);
        } else if (record?.clock_in && !record?.clock_out) {
          status = 'incomplete';
        } else {
          status = 'absent';
        }
      }

      dailyData.push({
        date,
        clock_in: record?.clock_in || null,
        clock_out: record?.clock_out || null,
        status,
        hours_worked,
      });
    }

    setDailyAttendance(dailyData);
  }

  function handleRowClick(employee: EmployeeAttendance) {
    setSelectedEmployee(employee);
    fetchDailyAttendance(employee.id);
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

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or employee code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
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
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Days Present</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Week Hours</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Month Hours</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Avg Hours/Day</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Last Active</th>
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
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{emp.full_name}</div>
                        <div className="text-sm text-gray-500">{emp.employee_code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {formatRole(emp.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-900">
                        {emp.total_days_present}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-900">
                        {emp.total_hours_week.toFixed(1)}h
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-900">
                        {emp.total_hours_month.toFixed(1)}h
                      </td>
                      <td className={`px-4 py-3 text-center font-semibold ${getAvgHoursColor(emp.avg_hours_per_day)}`}>
                        {emp.avg_hours_per_day.toFixed(1)}h
                      </td>
                      <td className={`px-4 py-3 text-center text-sm ${getInactiveColor(emp.last_active_date)}`}>
                        {emp.last_active_date
                          ? new Date(emp.last_active_date).toLocaleDateString()
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedEmployee.full_name}</h3>
                <p className="text-sm text-gray-600">{selectedEmployee.employee_code} - {formatRole(selectedEmployee.role)}</p>
              </div>
              <button
                onClick={closeDetail}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Days Present</p>
                  <p className="text-xl font-bold text-gray-900">{selectedEmployee.total_days_present}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Week Hours</p>
                  <p className="text-xl font-bold text-gray-900">{selectedEmployee.total_hours_week.toFixed(1)}h</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Month Hours</p>
                  <p className="text-xl font-bold text-gray-900">{selectedEmployee.total_hours_month.toFixed(1)}h</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Avg Hours/Day</p>
                  <p className={`text-xl font-bold ${getAvgHoursColor(selectedEmployee.avg_hours_per_day)}`}>
                    {selectedEmployee.avg_hours_per_day.toFixed(1)}h
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h4 className="font-semibold text-gray-900">
                  Daily Attendance - {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h4>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                    {day}
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
                      case 'not_applicable': return '—';
                      default: return '—';
                    }
                  };

                  const getStatusColors = () => {
                    switch (day.status) {
                      case 'present': return 'bg-green-50 border-green-300 text-green-600';
                      case 'incomplete': return 'bg-yellow-50 border-yellow-300 text-yellow-600';
                      case 'absent': return 'bg-red-50 border-red-300 text-red-600';
                      case 'not_applicable': return 'bg-gray-100 border-gray-300 text-gray-400';
                      default: return 'bg-gray-100 border-gray-300 text-gray-400';
                    }
                  };

                  return (
                    <div
                      key={day.date}
                      className={`aspect-square border rounded-lg p-2 flex flex-col items-center justify-center ${getStatusColors()}`}
                    >
                      <div className="text-xs font-medium text-gray-700">{date.getDate()}</div>
                      <div className="text-lg font-bold">
                        {getStatusDisplay()}
                      </div>
                      {day.status === 'present' && (
                        <div className="text-xs text-gray-600">{day.hours_worked.toFixed(1)}h</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex gap-4 justify-center text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-50 border border-green-300 rounded"></div>
                  <span className="text-gray-600">P - Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-50 border border-yellow-300 rounded"></div>
                  <span className="text-gray-600">I - Incomplete</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-50 border border-red-300 rounded"></div>
                  <span className="text-gray-600">A - Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
                  <span className="text-gray-600">— - Weekend/Future</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
