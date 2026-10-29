import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendancePunch, AttendanceSession, formatDurationMs, sumAttendance } from '../components/Admin/AttendanceSessionViews';

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

interface CompleteAttendancePdfInput {
  employee: { full_name: string; employee_code: string };
  sessions: AttendanceSession[];
  rangeLabel: string;
  communityNames: Record<string, string>;
}

const LANDSCAPE_TABLE_WIDTH = 297 - MARGIN * 2;
const MAP_LINK_LABEL = 'View map';
const MAP_LINK_COLOR: [number, number, number] = [37, 99, 235];
const COMPLETE_COLUMN_WIDTHS = [20, 46, 15, 50, 15, 15, 50, 15, 18, 25];

type MapCell = { content: string; url: string };

const isMapCell = (value: unknown): value is MapCell =>
  typeof value === 'object' && value !== null && 'url' in value;

const formatPunchLocation = (punch: AttendancePunch) => {
  const address = punch.address ?? 'Address not available';
  if (punch.latitude == null || punch.longitude == null) return address;
  return `${address}\n(${punch.latitude.toFixed(5)}, ${punch.longitude.toFixed(5)})`;
};

const formatPunchMapCell = (punch: AttendancePunch): MapCell | string =>
  punch.latitude == null || punch.longitude == null
    ? '-'
    : { content: MAP_LINK_LABEL, url: `https://www.google.com/maps?q=${punch.latitude},${punch.longitude}` };

export function buildCompleteAttendancePdf({ employee, sessions, rangeLabel, communityNames }: CompleteAttendancePdfInput): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const { recordCount, totalMs } = sumAttendance(sessions);
  const daysWorked = new Set(sessions.map(session => session.date)).size;
  const communitiesVisited = new Set(sessions.map(session => session.siteId)).size;

  const rows = sessions
    .flatMap(session => session.entries.flatMap(entry => {
      if (!entry.clockIn) return [];
      const community = communityNames[session.siteId] ?? session.siteName;
      return [{
        date: session.date,
        community,
        siteName: session.siteName,
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        duration: entry.duration,
      }];
    }))
    .sort((a, b) => new Date(a.clockIn.time).getTime() - new Date(b.clockIn.time).getTime());

  const body = rows.map(row => {
    const communityCell = row.siteName !== row.community ? `${row.community}\nSite: ${row.siteName}` : row.community;
    return [
      row.date,
      communityCell,
      formatPunchTime(row.clockIn.time),
      formatPunchLocation(row.clockIn),
      formatPunchMapCell(row.clockIn),
      row.clockOut ? formatPunchTime(row.clockOut.time) : IN_PROGRESS,
      row.clockOut ? formatPunchLocation(row.clockOut) : '-',
      row.clockOut ? formatPunchMapCell(row.clockOut) : '-',
      row.clockOut ? (row.duration ?? IN_PROGRESS) : IN_PROGRESS,
      row.clockOut ? 'Completed' : IN_PROGRESS,
    ];
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Complete Field Worker Attendance Report', MARGIN, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const details: Array<[string, string]> = [
    ['Field worker', employee.full_name],
    ['Employee ID', employee.employee_code],
    ['Reporting period', rangeLabel],
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
  doc.text(`Total days worked: ${daysWorked}`, MARGIN, y); y += 5.5;
  doc.text(`Total attendance sessions: ${recordCount}`, MARGIN, y); y += 5.5;
  doc.text(`Total working duration: ${totalMs > 0 ? formatDurationMs(totalMs) : 'No completed sessions'}`, MARGIN, y); y += 5.5;
  doc.text(`Total communities visited: ${communitiesVisited}`, MARGIN, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Community / Site', 'Clock-In Time', 'Clock-In Location', 'Map', 'Clock-Out Time', 'Clock-Out Location', 'Map', 'Duration', 'Status']],
    body,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 8, halign: 'center', valign: 'middle', minCellHeight: 8 },
    bodyStyles: { fontSize: 8, halign: 'center', valign: 'middle', minCellHeight: 7, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: LANDSCAPE_TABLE_WIDTH,
    showHead: 'everyPage',
    columnStyles: {
      0: { cellWidth: COMPLETE_COLUMN_WIDTHS[0] },
      1: { cellWidth: COMPLETE_COLUMN_WIDTHS[1], halign: 'left' },
      2: { cellWidth: COMPLETE_COLUMN_WIDTHS[2] },
      3: { cellWidth: COMPLETE_COLUMN_WIDTHS[3], halign: 'left' },
      4: { cellWidth: COMPLETE_COLUMN_WIDTHS[4] },
      5: { cellWidth: COMPLETE_COLUMN_WIDTHS[5] },
      6: { cellWidth: COMPLETE_COLUMN_WIDTHS[6], halign: 'left' },
      7: { cellWidth: COMPLETE_COLUMN_WIDTHS[7] },
      8: { cellWidth: COMPLETE_COLUMN_WIDTHS[8] },
      9: { cellWidth: COMPLETE_COLUMN_WIDTHS[9] },
    },
    didParseCell: data => {
      if (data.section === 'body' && isMapCell(data.cell.raw)) {
        data.cell.styles.textColor = MAP_LINK_COLOR;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: data => {
      const raw = data.cell.raw;
      if (data.section === 'body' && isMapCell(raw)) {
        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: raw.url });
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

  return doc;
}

export function downloadCompleteAttendancePdf(input: CompleteAttendancePdfInput) {
  const doc = buildCompleteAttendancePdf(input);
  const fileName = [
    sanitizeForFilename(input.employee.full_name),
    'Attendance',
    sanitizeForFilename(input.rangeLabel),
  ].join('_');
  doc.save(`${fileName}.pdf`);
}
