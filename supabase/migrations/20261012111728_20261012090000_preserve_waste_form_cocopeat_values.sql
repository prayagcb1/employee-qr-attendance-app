/*
# Preserve cocopeat values on waste loading entries

1. Purpose
- Store the cocopeat quantity entered for each loading bin as its own value.
- Keep the existing waste form tables, fields, relationships, and user interface unchanged.

2. Modified Tables
- `waste_loading_entries`
  - Adds `cocopeat_kg` (numeric, nullable) for the exact cocopeat quantity entered for that bin.
  - A null value represents an empty cocopeat field; existing rows remain valid.

3. Security
- The existing row-level security policies on `waste_loading_entries` continue to protect the table.
- No access roles or policies are changed.

4. Data Safety
- This migration is additive and does not delete, rename, or change existing columns or records.
- The statement is idempotent and safe to apply again.
*/

ALTER TABLE waste_loading_entries
  ADD COLUMN IF NOT EXISTS cocopeat_kg numeric;
