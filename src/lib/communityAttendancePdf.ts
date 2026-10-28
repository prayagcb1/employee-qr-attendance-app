import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendanceSession, formatDurationMs, sumAttendance } from '../components/Admin/AttendanceSessionViews';

interface CommunityAttendancePdfInput {
  employee: { full_name: string; employee_code: string };
  siteName: string;
  sessions: AttendanceSession[];
  rangeLabel: string;
}

const MARGIN = 14;
const IN_PROGRESS = 'In Progress';
const TABLE_WIDTH = 210 - MARGIN * 2;
const DATE_COLUMN_WIDTH = 56;
const TIME_COLUMN_WIDTH = 42;

const formatPunchTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

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

export function buildCommunityAttendancePdf({ employee, siteName, sessions, rangeLabel }: CommunityAttendancePdfInput): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { recordCount, totalMs } = sumAttendance(sessions);
  const daysWorked = new Set(sessions.map(session => session.date)).size;

  const rows = sessions
    .flatMap(session => session.entries.flatMap(entry =>
      entry.clockIn ? [{ date: session.date, clockIn: entry.clockIn, clockOut: entry.clockOut, duration: entry.duration }] : []
    ))
    .sort((a, b) => new Date(a.clockIn.time).getTime() - new Date(b.clockIn.time).getTime());

  const body = rows.map(row => [
    row.date,
    formatPunchTime(row.clockIn.time),
    row.clockOut ? formatPunchTime(row.clockOut.time) : IN_PROGRESS,
    row.clockOut ? (row.duration ?? IN_PROGRESS) : IN_PROGRESS,
  ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Field Worker Attendance Report', MARGIN, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const details: Array<[string, string]> = [
    ['Field worker', employee.full_name],
    ['Employee ID', employee.employee_code],
    ['Community / site', siteName],
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
    head: [['Date', 'Clock-In Time', 'Clock-Out Time', 'Duration']],
    body,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 9, halign: 'center', valign: 'middle', minCellHeight: 9 },
    bodyStyles: { fontSize: 9, halign: 'center', valign: 'middle', minCellHeight: 8, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: TABLE_WIDTH,
    showHead: 'everyPage',
    columnStyles: {
      0: { cellWidth: DATE_COLUMN_WIDTH },
      1: { cellWidth: TIME_COLUMN_WIDTH },
      2: { cellWidth: TIME_COLUMN_WIDTH },
      3: { cellWidth: TABLE_WIDTH - DATE_COLUMN_WIDTH - TIME_COLUMN_WIDTH * 2 },
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

  return doc;
}

export function downloadCommunityAttendancePdf(input: CommunityAttendancePdfInput) {
  const doc = buildCommunityAttendancePdf(input);
  const fileName = [
    'Attendance',
    sanitizeForFilename(input.employee.employee_code),
    sanitizeForFilename(input.siteName),
    sanitizeForFilename(input.rangeLabel),
  ].join('_');
  doc.save(`${fileName}.pdf`);
}
