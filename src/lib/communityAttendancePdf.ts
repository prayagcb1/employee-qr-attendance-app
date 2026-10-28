import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendancePunch, AttendanceSession, formatDurationMs, sumAttendance } from '../components/Admin/AttendanceSessionViews';

interface CommunityAttendancePdfInput {
  employee: { full_name: string; employee_code: string };
  siteName: string;
  siteAddress: string | null;
  sessions: AttendanceSession[];
  rangeLabel: string;
}

const MARGIN = 14;
const NOT_AVAILABLE = 'Location not available';
const IN_PROGRESS = 'In Progress';

const formatPunchTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const mapsUrl = (punch: AttendancePunch) =>
  `https://www.google.com/maps?q=${punch.latitude},${punch.longitude}`;

const punchLocation = (punch: AttendancePunch | null): { text: string; url: string | null } => {
  if (!punch) return { text: IN_PROGRESS, url: null };
  if (!punch.address && !Number.isFinite(punch.latitude)) return { text: NOT_AVAILABLE, url: null };
  const text = punch.address || NOT_AVAILABLE;
  return { text: `${text}\nView map`, url: mapsUrl(punch) };
};

const sanitizeForFilename = (value: string) => value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

export function describeDateRange(dateFilter: string, selectedMonth: string): string {
  if (dateFilter) {
    const [year, month, day] = dateFilter.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (selectedMonth) {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return 'All recorded dates';
}

export function downloadCommunityAttendancePdf({ employee, siteName, siteAddress, sessions, rangeLabel }: CommunityAttendancePdfInput) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { recordCount, totalMs } = sumAttendance(sessions);
  const daysWorked = new Set(sessions.map(session => session.date)).size;

  const rows = sessions
    .flatMap(session => session.entries.flatMap(entry =>
      entry.clockIn ? [{ date: session.date, clockIn: entry.clockIn, clockOut: entry.clockOut, duration: entry.duration }] : []
    ))
    .sort((a, b) => new Date(a.clockIn.time).getTime() - new Date(b.clockIn.time).getTime());

  const linkTargets = new Map<string, string>();
  const body = rows.map((row, rowIndex) => {
    const clockIn = punchLocation(row.clockIn);
    const clockOut = punchLocation(row.clockOut);
    if (clockIn.url) linkTargets.set(`${rowIndex}-2`, clockIn.url);
    if (clockOut.url) linkTargets.set(`${rowIndex}-4`, clockOut.url);
    return [
      row.date,
      formatPunchTime(row.clockIn.time),
      clockIn.text,
      row.clockOut ? formatPunchTime(row.clockOut.time) : IN_PROGRESS,
      clockOut.text,
      row.duration ?? IN_PROGRESS,
    ];
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Field Worker Attendance Report', MARGIN, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const details: Array<[string, string]> = [
    ['Field worker', employee.full_name],
    ['Employee ID', employee.employee_code],
    ['Community / site', siteName],
    ['Community address', siteAddress || 'Not available'],
    ['Date range', rangeLabel],
    ['Report generated', new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })],
  ];
  let y = 26;
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, MARGIN + 38, y);
    y += 5.5;
  });

  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Attendance Summary', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total days worked at this community: ${daysWorked}`, MARGIN, y); y += 5.5;
  doc.text(`Total attendance sessions: ${recordCount}`, MARGIN, y); y += 5.5;
  doc.text(`Total time spent at this community: ${totalMs > 0 ? formatDurationMs(totalMs) : 'No completed sessions'}`, MARGIN, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Clock-In Time', 'Clock-In Location', 'Clock-Out Time', 'Clock-Out Location', 'Duration']],
    body,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
    bodyStyles: { fontSize: 8, valign: 'middle' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      2: { textColor: [37, 99, 235] },
      4: { textColor: [37, 99, 235] },
    },
    didDrawCell: data => {
      if (data.section !== 'body') return;
      const url = linkTargets.get(`${data.row.index}-${data.column.index}`);
      if (url) {
        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
      }
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${page} of ${pageCount}`, doc.internal.pageSize.getWidth() - MARGIN, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    doc.setTextColor(0);
  }

  const fileName = [
    'Attendance',
    sanitizeForFilename(employee.employee_code),
    sanitizeForFilename(siteName),
    sanitizeForFilename(rangeLabel),
  ].join('_');
  doc.save(`${fileName}.pdf`);
}
