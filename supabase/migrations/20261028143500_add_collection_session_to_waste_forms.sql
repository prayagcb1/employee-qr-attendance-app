/*
# Add collection session to waste management forms

## Plain-English summary
A worker often submits one bin at a time during the same collection visit. This migration adds a
"collection session" tag to each waste form so the Admin Dashboard can show all forms from one
visit as a single grouped card. Existing forms do not get a session, so they keep displaying
exactly as they do today.

## Changes
1. New nullable column `collection_session_id` (uuid) on `waste_management_forms`.
   - NULL means the form was submitted before sessions existed, or without one. Such forms are never grouped.
2. New index on `(collection_session_id)` so the admin lookup stays fast.

## Unchanged
- No existing rows are modified, merged, or deleted.
- Row Level Security, policies, and grants are unchanged.
- Child tables (loading, harvest, maintenance, consumables) are unchanged.

## Notes
- Adding a nullable column without a default is a metadata-only change and does not rewrite data.
*/

ALTER TABLE public.waste_management_forms
  ADD COLUMN IF NOT EXISTS collection_session_id uuid;

CREATE INDEX IF NOT EXISTS idx_waste_management_forms_collection_session
  ON public.waste_management_forms (collection_session_id);
