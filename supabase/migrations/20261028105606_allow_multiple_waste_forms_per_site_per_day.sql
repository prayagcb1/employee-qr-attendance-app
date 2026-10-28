/*
# Allow multiple waste forms per site per day

## Plain-English summary
Previously the database allowed only one waste management form per site per day. Several workers can now submit their own separate form for the same site on the same date. Existing forms are not changed or deleted.

## Changes
1. Dropped the unique constraint `unique_site_date` on `waste_management_forms (site_id, date)`. This was the only constraint that enforced one form per site per day.
2. Added a regular (non-unique) index on `waste_management_forms (site_id, date)` so lookups by site and date stay fast.

## Unchanged
- Primary key on `id` (every form still gets its own unique ID).
- Foreign keys on `employee_id` and `site_id`.
- Row Level Security, policies, and grants on `waste_management_forms` and all child entry tables.
- All other constraints on the waste tables.
- All existing rows in `waste_management_forms` and child tables.

## Notes
- Dropping the constraint does not modify any row.
- The new index is not unique, so it does not restrict submissions.
*/

ALTER TABLE public.waste_management_forms
  DROP CONSTRAINT IF EXISTS unique_site_date;

CREATE INDEX IF NOT EXISTS idx_waste_management_forms_site_date
  ON public.waste_management_forms (site_id, date);
