import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { storage_path } = await req.json() as { storage_path: string };
    if (!storage_path) {
      return new Response(JSON.stringify({ error: "storage_path required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the PDF from storage
    const { data: fileData, error: storageErr } = await supabase.storage
      .from("analytics-reports")
      .download(storage_path);

    if (storageErr || !fileData) {
      return new Response(JSON.stringify({ error: `Storage error: ${storageErr?.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert PDF blob to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const base64Pdf = btoa(binary);

    // Use Supabase AI (Llama) if available, otherwise use fetch to call any configured LLM
    // We'll use a structured prompt to extract analytics from the PDF text
    // Since we can't natively parse PDF binary here, we'll extract readable text heuristically
    // and use the AI model to interpret it

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    let analysisResult: AnalyticsResult;

    if (ANTHROPIC_API_KEY) {
      analysisResult = await analyzeWithClaude(base64Pdf, ANTHROPIC_API_KEY);
    } else {
      // Fallback: extract text from PDF binary using basic heuristics
      const pdfText = extractTextFromPdfBytes(uint8);
      analysisResult = parsePdfTextToAnalytics(pdfText);
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface AnalyticsEntry {
  label: string;
  value: string | number;
  unit?: string;
}

interface AnalyticsSection {
  title: string;
  entries: AnalyticsEntry[];
}

interface AnalyticsResult {
  title: string;
  summary: string;
  sections: AnalyticsSection[];
  tables: { headers: string[]; rows: string[][] }[];
  keyMetrics: { label: string; value: string; highlight?: boolean }[];
  rawText?: string;
}

async function analyzeWithClaude(base64Pdf: string, apiKey: string): Promise<AnalyticsResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Pdf,
              },
            },
            {
              type: "text",
              text: `You are a waste management analytics assistant. Analyze this document and extract all data relevant to waste management operations.

Return a JSON object with this exact structure:
{
  "title": "short title describing the document",
  "summary": "2-3 sentence summary of key findings",
  "keyMetrics": [
    { "label": "metric name", "value": "value with unit", "highlight": true/false }
  ],
  "sections": [
    {
      "title": "section heading",
      "entries": [
        { "label": "field name", "value": "value", "unit": "optional unit" }
      ]
    }
  ],
  "tables": [
    {
      "headers": ["Col1", "Col2", ...],
      "rows": [["val1", "val2"], ...]
    }
  ]
}

Focus on:
- Total waste collected (kg, tonnes, or any unit mentioned)
- Waste by type (wet, dry, garden, food, recyclable, etc.)
- Compost/harvest data
- Bin utilization and fill rates
- Collection frequency and dates
- Site or location breakdowns
- Any trends, averages, or comparisons
- Issues or anomalies mentioned

If a field is not present in the document, omit it. Return only valid JSON.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text ?? "";

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON");
  return JSON.parse(jsonMatch[0]) as AnalyticsResult;
}

// Basic PDF text extraction from raw bytes (BT/ET blocks)
function extractTextFromPdfBytes(bytes: Uint8Array): string {
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);

  const textParts: string[] = [];

  // Extract content between BT and ET (text objects in PDF)
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    // Extract strings in parentheses (literal strings)
    const strRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
    let strMatch;
    while ((strMatch = strRegex.exec(block)) !== null) {
      const s = strMatch[1].replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\\\/g, "\\").replace(/\\'/g, "'");
      if (s.trim()) textParts.push(s.trim());
    }
    // Extract hex strings <...>
    const hexRegex = /<([0-9a-fA-F]+)>/g;
    let hexMatch;
    while ((hexMatch = hexRegex.exec(block)) !== null) {
      const hex = hexMatch[1];
      let str = "";
      for (let i = 0; i < hex.length - 1; i += 2) {
        const code = parseInt(hex.slice(i, i + 2), 16);
        if (code > 31) str += String.fromCharCode(code);
      }
      if (str.trim()) textParts.push(str.trim());
    }
  }

  return textParts.join(" ");
}

function parsePdfTextToAnalytics(text: string): AnalyticsResult {
  const lines = text.split(/\s{2,}|\n/).map(l => l.trim()).filter(Boolean);

  // Try to find numeric data
  const metrics: { label: string; value: string; highlight?: boolean }[] = [];
  const sections: AnalyticsSection[] = [];

  // Look for patterns like "label: value" or "label value unit"
  const kvRegex = /([A-Za-z][A-Za-z\s\/\-]{2,30})[:\s]+(\d+[\d.,]*)\s*(kg|tonnes?|ltr|liters?|%|bins?)?/gi;
  let m;
  const seen = new Set<string>();
  while ((m = kvRegex.exec(text)) !== null) {
    const label = m[1].trim();
    const value = m[2].trim();
    const unit = m[3] ?? "";
    const key = `${label.toLowerCase()}`;
    if (!seen.has(key) && label.length > 3) {
      seen.add(key);
      metrics.push({ label, value: unit ? `${value} ${unit}` : value, highlight: seen.size <= 4 });
    }
    if (metrics.length >= 20) break;
  }

  // Build sections from line groups
  const tableHeaders: string[] = [];
  const tableRows: string[][] = [];

  // Try to detect table-like rows (3+ tab/space-separated values)
  for (const line of lines) {
    const cols = line.split(/\t+|\s{3,}/).map(c => c.trim()).filter(Boolean);
    if (cols.length >= 3) {
      if (tableHeaders.length === 0) {
        tableHeaders.push(...cols);
      } else {
        tableRows.push(cols);
      }
    }
  }

  if (metrics.length === 0 && tableRows.length === 0) {
    sections.push({
      title: "Extracted Content",
      entries: lines.slice(0, 30).map((l, i) => ({ label: `Line ${i + 1}`, value: l })),
    });
  }

  return {
    title: "PDF Analytics",
    summary: text.length > 50
      ? `Document contains approximately ${lines.length} content blocks. ${metrics.length} numeric metrics detected.`
      : "Unable to extract meaningful text from this PDF. The file may be scanned or image-based.",
    keyMetrics: metrics.slice(0, 8),
    sections,
    tables: tableHeaders.length > 0
      ? [{ headers: tableHeaders, rows: tableRows.slice(0, 50) }]
      : [],
    rawText: text.slice(0, 2000),
  };
}
