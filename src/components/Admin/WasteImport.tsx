import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import {
  Upload, Download, CheckCircle, AlertCircle, X, FileSpreadsheet,
  Loader, Info, ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SiteOption { id: string; name: string }
interface EmployeeOption { id: string; full_name: string; employee_code: string }

type SheetName = 'Loading' | 'Harvest' | 'Maintenance' | 'Consumables';

interface ParsedRow {
  sheet: SheetName;
  rowNum: number;
  data: Record<string, unknown>;
  errors: string[];
}

// ── Template generation ────────────────────────────────────────────────────────

function buildTemplate(sites: SiteOption[], employees: EmployeeOption[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const siteNames = sites.map(s => s.name);
  const empCodes = employees.map(e => e.employee_code);

  // Loading sheet
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['site_name*', 'employee_code*', 'bin_code*', 'weight_loaded_kg*', 'waste_type*', 'loading_datetime*', 'collector_name*', 'remarks'],
    ['// waste_type: wet_waste | dry_waste | garden_waste | food_waste', '', '', '', '', '', '', ''],
    ['// loading_datetime format: YYYY-MM-DD HH:MM', '', '', '', '', '', '', ''],
    [siteNames[0] ?? '', empCodes[0] ?? '', 'BIN-001', '50', 'wet_waste', '2025-01-15 09:00', 'Collector Name', 'Optional remarks'],
  ]), 'Loading');

  // Harvest sheet
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['site_name*', 'employee_code*', 'bin_code*', 'compost_harvested_kg*', 'harvest_date*', 'compost_quality*', 'moisture_level*', 'remarks'],
    ['// compost_quality: good | average | poor', '', '', '', '', '', '', ''],
    ['// moisture_level: low | normal | high', '', '', '', '', '', '', ''],
    ['// harvest_date format: YYYY-MM-DD', '', '', '', '', '', '', ''],
    [siteNames[0] ?? '', empCodes[0] ?? '', 'BIN-001', '20', '2025-01-15', 'good', 'normal', ''],
  ]), 'Harvest');

  // Maintenance sheet
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['site_name*', 'employee_code*', 'bin_code*', 'maintenance_type*', 'status*', 'remarks'],
    ['// maintenance_type: cleaning | aeration | mixing | repair | temperature_check', '', '', '', '', ''],
    ['// status: completed | pending', '', '', '', '', ''],
    [siteNames[0] ?? '', empCodes[0] ?? '', 'BIN-001', 'cleaning', 'completed', ''],
  ]), 'Maintenance');

  // Consumables sheet
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['site_name*', 'employee_code*', 'item_name*', 'opening_stock*', 'used*', 'entry_date*'],
    ['// entry_date format: YYYY-MM-DD', '', '', '', '', ''],
    [siteNames[0] ?? '', empCodes[0] ?? '', 'Cocopeat', '100', '20', '2025-01-15'],
  ]), 'Consumables');

  // Reference sheet
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['=== SITES ==='],
    ['site_name'],
    ...siteNames.map(n => [n]),
    [],
    ['=== EMPLOYEES ==='],
    ['employee_code', 'full_name'],
    ...employees.map(e => [e.employee_code, e.full_name]),
  ]), 'Reference');

  return wb;
}

// ── Parsing ────────────────────────────────────────────────────────────────────

function str(v: unknown): string { return v != null ? String(v).trim() : ''; }
function num(v: unknown): number | null {
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}
function parseDate(v: unknown): string | null {
  if (v == null || str(v) === '') return null;
  const s = str(v);
  // XLSX may return a number for dates
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? s.slice(0, 10) : null;
}
function parseDatetime(v: unknown): string | null {
  if (v == null || str(v) === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const h = Math.floor((d.H ?? 0));
      const m = Math.floor((d.M ?? 0));
      return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
    }
  }
  const s = str(v);
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
    const spaced = s.replace(' ', 'T');
    return spaced.length === 10 ? `${spaced}T00:00:00` : spaced;
  }
  return null;
}

type SiteMap = Record<string, string>;
type EmpMap = Record<string, string>;

function parseLoadingSheet(rows: Record<string, unknown>[], siteMap: SiteMap, empMap: EmpMap): ParsedRow[] {
  return rows.map((row, i) => {
    const errors: string[] = [];
    const siteName = str(row['site_name*'] ?? row['site_name']);
    const empCode = str(row['employee_code*'] ?? row['employee_code']);
    const binCode = str(row['bin_code*'] ?? row['bin_code']);
    const weight = num(row['weight_loaded_kg*'] ?? row['weight_loaded_kg']);
    const wasteType = str(row['waste_type*'] ?? row['waste_type']).toLowerCase();
    const dt = parseDatetime(row['loading_datetime*'] ?? row['loading_datetime']);
    const collector = str(row['collector_name*'] ?? row['collector_name']);

    if (!siteName) errors.push('site_name is required');
    else if (!siteMap[siteName.toLowerCase()]) errors.push(`Unknown site: "${siteName}"`);
    if (!empCode) errors.push('employee_code is required');
    else if (!empMap[empCode]) errors.push(`Unknown employee code: "${empCode}"`);
    if (!binCode) errors.push('bin_code is required');
    if (weight == null) errors.push('weight_loaded_kg must be a number');
    if (!['wet_waste','dry_waste','garden_waste','food_waste'].includes(wasteType))
      errors.push(`waste_type must be wet_waste|dry_waste|garden_waste|food_waste (got: "${wasteType}")`);
    if (!dt) errors.push('loading_datetime must be YYYY-MM-DD HH:MM');
    if (!collector) errors.push('collector_name is required');

    return {
      sheet: 'Loading',
      rowNum: i + 2,
      data: {
        site_id: siteMap[siteName.toLowerCase()],
        employee_id: empMap[empCode],
        bin_code: binCode,
        weight_loaded_kg: weight ?? 0,
        waste_type: wasteType,
        loading_datetime: dt ?? new Date().toISOString(),
        collector_name: collector,
        remarks: str(row['remarks']),
      },
      errors,
    };
  });
}

function parseHarvestSheet(rows: Record<string, unknown>[], siteMap: SiteMap, empMap: EmpMap): ParsedRow[] {
  return rows.map((row, i) => {
    const errors: string[] = [];
    const siteName = str(row['site_name*'] ?? row['site_name']);
    const empCode = str(row['employee_code*'] ?? row['employee_code']);
    const binCode = str(row['bin_code*'] ?? row['bin_code']);
    const kg = num(row['compost_harvested_kg*'] ?? row['compost_harvested_kg']);
    const harvestDate = parseDate(row['harvest_date*'] ?? row['harvest_date']);
    const quality = str(row['compost_quality*'] ?? row['compost_quality']).toLowerCase();
    const moisture = str(row['moisture_level*'] ?? row['moisture_level']).toLowerCase();

    if (!siteName) errors.push('site_name is required');
    else if (!siteMap[siteName.toLowerCase()]) errors.push(`Unknown site: "${siteName}"`);
    if (!empCode) errors.push('employee_code is required');
    else if (!empMap[empCode]) errors.push(`Unknown employee code: "${empCode}"`);
    if (!binCode) errors.push('bin_code is required');
    if (kg == null) errors.push('compost_harvested_kg must be a number');
    if (!harvestDate) errors.push('harvest_date must be YYYY-MM-DD');
    if (!['good','average','poor'].includes(quality))
      errors.push(`compost_quality must be good|average|poor (got: "${quality}")`);
    if (!['low','normal','high'].includes(moisture))
      errors.push(`moisture_level must be low|normal|high (got: "${moisture}")`);

    return {
      sheet: 'Harvest',
      rowNum: i + 2,
      data: {
        site_id: siteMap[siteName.toLowerCase()],
        employee_id: empMap[empCode],
        bin_code: binCode,
        compost_harvested_kg: kg ?? 0,
        harvest_date: harvestDate ?? new Date().toISOString().slice(0,10),
        compost_quality: quality,
        moisture_level: moisture,
        remarks: str(row['remarks']),
      },
      errors,
    };
  });
}

function parseMaintenanceSheet(rows: Record<string, unknown>[], siteMap: SiteMap, empMap: EmpMap): ParsedRow[] {
  return rows.map((row, i) => {
    const errors: string[] = [];
    const siteName = str(row['site_name*'] ?? row['site_name']);
    const empCode = str(row['employee_code*'] ?? row['employee_code']);
    const binCode = str(row['bin_code*'] ?? row['bin_code']);
    const mType = str(row['maintenance_type*'] ?? row['maintenance_type']).toLowerCase();
    const status = str(row['status*'] ?? row['status']).toLowerCase();

    if (!siteName) errors.push('site_name is required');
    else if (!siteMap[siteName.toLowerCase()]) errors.push(`Unknown site: "${siteName}"`);
    if (!empCode) errors.push('employee_code is required');
    else if (!empMap[empCode]) errors.push(`Unknown employee code: "${empCode}"`);
    if (!binCode) errors.push('bin_code is required');
    if (!['cleaning','aeration','mixing','repair','temperature_check'].includes(mType))
      errors.push(`maintenance_type must be cleaning|aeration|mixing|repair|temperature_check`);
    if (!['completed','pending'].includes(status))
      errors.push(`status must be completed|pending`);

    return {
      sheet: 'Maintenance',
      rowNum: i + 2,
      data: {
        site_id: siteMap[siteName.toLowerCase()],
        employee_id: empMap[empCode],
        bin_code: binCode,
        maintenance_type: mType,
        status: status,
        remarks: str(row['remarks']),
      },
      errors,
    };
  });
}

function parseConsumablesSheet(rows: Record<string, unknown>[], siteMap: SiteMap, empMap: EmpMap): ParsedRow[] {
  return rows.map((row, i) => {
    const errors: string[] = [];
    const siteName = str(row['site_name*'] ?? row['site_name']);
    const empCode = str(row['employee_code*'] ?? row['employee_code']);
    const itemName = str(row['item_name*'] ?? row['item_name']);
    const opening = num(row['opening_stock*'] ?? row['opening_stock']);
    const used = num(row['used*'] ?? row['used']);
    const entryDate = parseDate(row['entry_date*'] ?? row['entry_date']);

    if (!siteName) errors.push('site_name is required');
    else if (!siteMap[siteName.toLowerCase()]) errors.push(`Unknown site: "${siteName}"`);
    if (!empCode) errors.push('employee_code is required');
    else if (!empMap[empCode]) errors.push(`Unknown employee code: "${empCode}"`);
    if (!itemName) errors.push('item_name is required');
    if (opening == null) errors.push('opening_stock must be a number');
    if (used == null) errors.push('used must be a number');
    if (!entryDate) errors.push('entry_date must be YYYY-MM-DD');

    return {
      sheet: 'Consumables',
      rowNum: i + 2,
      data: {
        site_id: siteMap[siteName.toLowerCase()],
        employee_id: empMap[empCode],
        item_name: itemName,
        opening_stock: opening ?? 0,
        used: used ?? 0,
        entry_date: entryDate ?? new Date().toISOString().slice(0,10),
      },
      errors,
    };
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WasteImport() {
  const { employee } = useAuth();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('sites').select('id, name').eq('active', true).order('name'),
      supabase.from('employees').select('id, full_name, employee_code').eq('active', true).order('full_name'),
    ]).then(([sitesRes, empsRes]) => {
      if (sitesRes.data) setSites(sitesRes.data);
      if (empsRes.data) setEmployees(empsRes.data);
      setLoading(false);
    });
  }, []);

  const siteMap = Object.fromEntries(sites.map(s => [s.name.toLowerCase(), s.id]));
  const empMap = Object.fromEntries(employees.map(e => [e.employee_code, e.id]));

  const downloadTemplate = () => {
    const wb = buildTemplate(sites, employees);
    XLSX.writeFile(wb, 'waste_import_template.xlsx');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      if (!data) return;
      try {
        const wb = XLSX.read(data, { type: 'binary', cellDates: false });
        const allRows: ParsedRow[] = [];

        const parseSheet = <T extends ParsedRow>(
          name: SheetName,
          parser: (rows: Record<string, unknown>[], sm: SiteMap, em: EmpMap) => T[]
        ) => {
          const ws = wb.Sheets[name];
          if (!ws) return;
          const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
          // Skip comment rows (first cell starts with //)
          const dataRows = raw.filter(r => {
            const firstVal = Object.values(r)[0];
            return !String(firstVal ?? '').startsWith('//');
          });
          allRows.push(...parser(dataRows, siteMap, empMap));
        };

        parseSheet('Loading', parseLoadingSheet);
        parseSheet('Harvest', parseHarvestSheet);
        parseSheet('Maintenance', parseMaintenanceSheet);
        parseSheet('Consumables', parseConsumablesSheet);

        setParsedRows(allRows);
      } catch (err) {
        alert('Failed to read Excel file. Make sure it uses the provided template.');
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const validRows = parsedRows?.filter(r => r.errors.length === 0) ?? [];
  const invalidRows = parsedRows?.filter(r => r.errors.length > 0) ?? [];

  const handleImport = async () => {
    if (!employee || validRows.length === 0) return;
    setImporting(true);

    let success = 0;
    let failed = 0;

    // Group valid rows by sheet type
    const loadingRows = validRows.filter(r => r.sheet === 'Loading');
    const harvestRows = validRows.filter(r => r.sheet === 'Harvest');
    const maintenanceRows = validRows.filter(r => r.sheet === 'Maintenance');
    const consumablesRows = validRows.filter(r => r.sheet === 'Consumables');

    const insertBatch = async (
      table: string,
      rows: ParsedRow[],
      extraFields?: Record<string, unknown>
    ) => {
      if (rows.length === 0) return;
      const records = rows.map(r => ({ ...r.data, ...(extraFields ?? {}) }));
      const { error } = await supabase.from(table).insert(records);
      if (error) {
        console.error(`Insert into ${table} failed:`, error);
        failed += rows.length;
      } else {
        success += rows.length;
      }
    };

    await insertBatch('waste_loading_entries', loadingRows);
    await insertBatch('waste_harvest_entries', harvestRows);
    await insertBatch('waste_maintenance_entries', maintenanceRows);
    await insertBatch('waste_consumables_entries', consumablesRows);

    setImportResult({ success, failed });
    if (success > 0) {
      setParsedRows(null);
      setFileName('');
    }
    setImporting(false);
  };

  const sheetSummary: Record<SheetName, { valid: number; invalid: number }> = {
    Loading: { valid: 0, invalid: 0 },
    Harvest: { valid: 0, invalid: 0 },
    Maintenance: { valid: 0, invalid: 0 },
    Consumables: { valid: 0, invalid: 0 },
  };
  parsedRows?.forEach(r => {
    if (r.errors.length === 0) sheetSummary[r.sheet].valid++;
    else sheetSummary[r.sheet].invalid++;
  });

  const sheetColors: Record<SheetName, string> = {
    Loading: 'blue',
    Harvest: 'green',
    Maintenance: 'orange',
    Consumables: 'purple',
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Import Historic Waste Data</h2>
          <p className="text-sm text-gray-500">Upload an Excel file with historic waste management records</p>
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span className="font-semibold text-gray-800 text-sm">Download Template</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">Get the Excel template pre-filled with your sites and employee codes.</p>
          <button
            onClick={downloadTemplate}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span className="font-semibold text-gray-800 text-sm">Fill in Your Data</span>
          </div>
          <p className="text-xs text-gray-600">Fill the <strong>Loading</strong>, <strong>Harvest</strong>, <strong>Maintenance</strong>, and <strong>Consumables</strong> sheets. Use the Reference sheet for valid site names and employee codes.</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span className="font-semibold text-gray-800 text-sm">Upload & Import</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">Upload your filled file. Review any errors before confirming the import.</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
          >
            <Upload className="w-4 h-4" />
            {fileName ? 'Replace File' : 'Upload File'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
          importResult.failed === 0
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${importResult.failed === 0 ? 'text-green-600' : 'text-yellow-600'}`} />
          <div>
            <p className="font-semibold text-gray-900">
              Import complete: {importResult.success} rows inserted{importResult.failed > 0 ? `, ${importResult.failed} failed` : ''}.
            </p>
            {importResult.failed > 0 && (
              <p className="text-sm text-gray-600 mt-1">Some rows could not be inserted. Check permissions or data integrity and retry.</p>
            )}
          </div>
        </div>
      )}

      {/* Parsed preview */}
      {parsedRows !== null && (
        <div>
          {fileName && (
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
              <FileSpreadsheet className="w-4 h-4 text-blue-500" />
              <span className="font-medium">{fileName}</span>
              <span className="text-gray-400">—</span>
              <span>{parsedRows.length} rows parsed</span>
            </div>
          )}

          {/* Summary cards per sheet */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {(Object.keys(sheetSummary) as SheetName[]).map(sheet => {
              const s = sheetSummary[sheet];
              const color = sheetColors[sheet];
              return (
                <div key={sheet} className={`p-3 rounded-lg border bg-${color}-50 border-${color}-200`}>
                  <p className={`text-xs font-semibold text-${color}-700 mb-1`}>{sheet}</p>
                  <p className="text-lg font-bold text-gray-900">{s.valid + s.invalid}</p>
                  <div className="flex gap-2 text-xs mt-1">
                    <span className="text-green-700">{s.valid} ok</span>
                    {s.invalid > 0 && <span className="text-red-700">{s.invalid} errors</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Errors section */}
          {invalidRows.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="font-semibold text-red-800">{invalidRows.length} rows have errors and will be skipped</p>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {invalidRows.map((row, i) => {
                  const key = `${row.sheet}-${row.rowNum}`;
                  const open = expandedErrors[key];
                  return (
                    <div key={i} className="bg-white rounded border border-red-200 overflow-hidden">
                      <button
                        onClick={() => setExpandedErrors(prev => ({ ...prev, [key]: !open }))}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm"
                      >
                        <span>
                          <span className="font-medium text-red-800">{row.sheet} row {row.rowNum}</span>
                          <span className="text-red-600 ml-2">— {row.errors[0]}{row.errors.length > 1 ? ` (+${row.errors.length - 1} more)` : ''}</span>
                        </span>
                        {open ? <ChevronUp className="w-4 h-4 text-red-400" /> : <ChevronDown className="w-4 h-4 text-red-400" />}
                      </button>
                      {open && (
                        <ul className="px-3 pb-2 text-xs text-red-700 space-y-1">
                          {row.errors.map((e, j) => <li key={j}>• {e}</li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Valid rows info */}
          {validRows.length > 0 && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-800">
                <span className="font-semibold">{validRows.length} rows ready to import</span>
                {invalidRows.length > 0 && <span className="text-green-700"> ({invalidRows.length} skipped due to errors)</span>}
              </p>
            </div>
          )}

          {parsedRows.length === 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
              <Info className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-yellow-800 text-sm">No data rows found. Make sure the sheets have data rows below the header and comment rows.</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {validRows.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition"
              >
                {importing ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Importing...' : `Import ${validRows.length} Rows`}
              </button>
            )}
            <button
              onClick={() => { setParsedRows(null); setFileName(''); setImportResult(null); }}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Help box */}
      {parsedRows === null && !importResult && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Supported sheets in the template:</p>
              <ul className="space-y-1 text-blue-700">
                <li><strong>Loading</strong> — Bin loading entries (waste loaded into bins)</li>
                <li><strong>Harvest</strong> — Compost harvest records</li>
                <li><strong>Maintenance</strong> — Bin maintenance activities</li>
                <li><strong>Consumables</strong> — Consumables stock and usage</li>
              </ul>
              <p className="mt-2">You only need to fill the sheets relevant to your data. Empty sheets are ignored.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
