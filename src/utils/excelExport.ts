import * as XLSX from 'xlsx-js-style';
import { supabase } from '../lib/supabase';

interface EmployeeData {
  id: string;
  employee_code: string;
  full_name: string;
  role: string;
}

interface MonthlyData {
  [employeeId: string]: {
    [day: number]: 'P' | 'A' | 'I' | 'L' | 'W' | '—';
  };
}

async function fetchEmployees(): Promise<EmployeeData[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_code, full_name, role')
    .order('full_name');

  if (error) throw error;
  return data || [];
}

async function fetchMonthlyAttendance(
  employees: EmployeeData[],
  year: number,
  month: number
): Promise<MonthlyData> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthlyData: MonthlyData = {};

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  for (const employee of employees) {
    monthlyData[employee.id] = {};

    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('event_type, timestamp, site_id')
      .eq('employee_id', employee.id)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp');

    const { data: wfhLogs } = await supabase
      .from('wfh_attendance')
      .select('date, status')
      .eq('employee_id', employee.id)
      .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lte('date', `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`);

    const { data: leaveLogs } = await supabase
      .from('leave_attendance')
      .select('date')
      .eq('employee_id', employee.id)
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

    const isFieldRole = employee.role === 'field_worker' || employee.role === 'field_supervisor';

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const currentDate = new Date(year, month - 1, day);
      const siteMap = dateSiteMap.get(date);
      const wfhData = wfhMap.get(date);
      const isLeave = leaveSet.has(date);

      let status: 'P' | 'A' | 'I' | 'L' | 'W' | '—' = 'A';
      let hasClockIn = false;
      let hasIncomplete = false;
      let hours_worked = 0;

      if (isLeave) {
        status = 'L';
      } else if (wfhData) {
        if (wfhData.status === 'complete') {
          status = 'W';
        } else if (wfhData.status === 'incomplete') {
          status = 'I';
        }
      } else if (siteMap) {
        siteMap.forEach((siteEntry) => {
          siteEntry.clock_ins.forEach((clockIn, index) => {
            hasClockIn = true;
            if (siteEntry.clock_outs[index]) {
              const clockOut = siteEntry.clock_outs[index];
              const duration = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
              hours_worked += duration;
            } else {
              hasIncomplete = true;
            }
          });
        });

        if (currentDate > today) {
          status = '—';
        } else {
          const dayOfWeek = currentDate.getDay();
          const isSunday = dayOfWeek === 0;
          const isSaturday = dayOfWeek === 6;

          if (isSunday) {
            status = '—';
          } else if (isSaturday && !isFieldRole) {
            if (hasClockIn && hours_worked > 0) {
              status = 'P';
            } else if (hasIncomplete) {
              status = 'I';
            } else {
              status = '—';
            }
          } else if (hasClockIn && hours_worked > 0) {
            status = 'P';
          } else if (hasIncomplete) {
            status = 'I';
          } else {
            const now = new Date();
            const isToday = currentDate.getTime() === today.getTime();
            const currentHour = now.getHours();

            if (isToday && currentHour < 18) {
              status = '—';
            } else {
              status = 'A';
            }
          }
        }
      } else if (currentDate > today) {
        status = '—';
      } else {
        const dayOfWeek = currentDate.getDay();
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;

        if (isSunday) {
          status = '—';
        } else if (isSaturday && !isFieldRole) {
          status = '—';
        } else {
          const now = new Date();
          const isToday = currentDate.getTime() === today.getTime();
          const currentHour = now.getHours();

          if (isToday && currentHour < 18) {
            status = '—';
          } else {
            status = 'A';
          }
        }
      }

      monthlyData[employee.id][day] = status;
    }
  }

  return monthlyData;
}

function createMonthSheet(
  employees: EmployeeData[],
  monthlyData: MonthlyData,
  year: number,
  month: number
) {
  const daysInMonth = new Date(year, month, 0).getDate();

  const headers = ['Employee Name'];
  for (let day = 1; day <= daysInMonth; day++) {
    headers.push(day.toString());
  }
  headers.push('Total P', 'Total A', 'Total I');

  const rows = [headers];

  employees.forEach(employee => {
    const row: (string | number)[] = [employee.full_name];
    const employeeData = monthlyData[employee.id] || {};

    let totalP = 0;
    let totalA = 0;
    let totalI = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const status = employeeData[day] || '—';
      row.push(status);

      if (status === 'P' || status === 'W') totalP++;
      else if (status === 'A') totalA++;
      else if (status === 'I') totalI++;
    }

    row.push(totalP, totalA, totalI);
    rows.push(row);
  });

  return rows;
}

function getTextColorForStatus(status: string): string {
  switch (status) {
    case 'P':
      return 'FF006400';
    case 'W':
      return 'FF00008B';
    case 'A':
      return 'FF8B0000';
    case 'I':
      return 'FFFF8C00';
    case 'L':
      return 'FF808080';
    case '—':
      return 'FFC0C0C0';
    default:
      return 'FF000000';
  }
}

function applyCellStyles(worksheet: XLSX.WorkSheet, employees: EmployeeData[], daysInMonth: number) {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  const thinBorder = {
    top: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
    bottom: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
    left: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
    right: { style: 'thin', color: { rgb: 'FFD0D0D0' } }
  };

  for (let R = 0; R <= range.e.r; R++) {
    for (let C = 0; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];

      if (!cell) continue;

      if (R === 0) {
        cell.s = {
          font: { bold: true, color: { rgb: 'FF000000' } },
          fill: { fgColor: { rgb: 'FFFFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: thinBorder
        };
      } else if (C >= 1 && C <= daysInMonth) {
        const status = cell.v as string;
        const textColor = getTextColorForStatus(status);

        cell.s = {
          font: { bold: true, color: { rgb: textColor } },
          fill: { fgColor: { rgb: 'FFFFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: thinBorder
        };
      } else {
        cell.s = {
          font: { color: { rgb: 'FF000000' } },
          fill: { fgColor: { rgb: 'FFFFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: thinBorder
        };
      }
    }
  }
}

export async function exportAttendanceToExcel(monthsToExport: string[]) {
  try {
    const employees = await fetchEmployees();

    const workbook = XLSX.utils.book_new();
    workbook.Workbook = workbook.Workbook || {};
    workbook.Workbook.Views = workbook.Workbook.Views || [];

    for (const monthStr of monthsToExport) {
      const [year, month] = monthStr.split('-').map(Number);

      const monthlyData = await fetchMonthlyAttendance(employees, year, month);

      const sheetData = createMonthSheet(employees, monthlyData, year, month);

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      const daysInMonth = new Date(year, month, 0).getDate();

      const colWidths = [{ wch: 25 }];
      for (let i = 0; i < daysInMonth; i++) {
        colWidths.push({ wch: 4 });
      }
      colWidths.push({ wch: 8 });
      colWidths.push({ wch: 8 });
      colWidths.push({ wch: 8 });
      worksheet['!cols'] = colWidths;

      worksheet['!freeze'] = { xSplit: 1, ySplit: 1, state: 'frozen' };

      applyCellStyles(worksheet, employees, daysInMonth);

      const monthDate = new Date(year, month - 1, 1);
      const sheetName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    XLSX.writeFile(workbook, `Attendance_Report_${new Date().toISOString().split('T')[0]}.xlsx`, {
      cellStyles: true
    });

    return { success: true };
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return { success: false, error };
  }
}
