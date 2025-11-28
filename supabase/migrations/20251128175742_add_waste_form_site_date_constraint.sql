/*
  # Add Unique Constraint for Waste Forms

  ## Overview
  Prevent multiple waste form submissions for the same site on the same day.
  Only one waste form can be submitted per site per day by any employee.

  ## Changes Made
  1. Add unique constraint on (site_id, date) combination
  2. This ensures only one waste form per site per day

  ## Notes
  - If duplicate entries exist, they need to be resolved before migration
  - Future attempts to submit duplicate forms will be rejected
*/

-- Add unique constraint to prevent multiple forms for same site on same day
ALTER TABLE waste_management_forms
  DROP CONSTRAINT IF EXISTS unique_site_date;

ALTER TABLE waste_management_forms
  ADD CONSTRAINT unique_site_date UNIQUE (site_id, date);
