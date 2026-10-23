/*
# Add wet-waste weight to loading entries

1. Data change
- Add `wet_waste_kg` to `waste_loading_entries`.
- Store the separately entered wet-waste weight for each loading entry.
- Existing records remain unchanged and receive the safe default value `0`.

2. Security
- No new table, role, grant, or RLS policy is introduced.
- The existing table permissions and row-level security policies continue to protect this field through the existing loading-entry access rules.

3. Important notes
- This is an additive, non-destructive change; no existing columns or records are removed.
- The field is numeric and non-null with a default so existing inserts and records remain valid.
*/

ALTER TABLE public.waste_loading_entries
  ADD COLUMN IF NOT EXISTS wet_waste_kg numeric NOT NULL DEFAULT 0;
