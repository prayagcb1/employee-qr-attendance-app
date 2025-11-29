/*
  # Fix Missing Foreign Key Indexes

  ## Overview
  Add indexes on foreign key columns to improve query performance.
  Foreign keys without indexes can cause table scans and poor performance.

  ## Changes
  1. Add index on bins.site_id
  2. Add index on waste_management_forms.employee_id

  ## Performance Impact
  - Significantly improves JOIN performance
  - Speeds up foreign key constraint checks
  - Reduces table scans
*/

-- Add index for bins foreign key
CREATE INDEX IF NOT EXISTS idx_bins_site_id 
  ON bins(site_id);

-- Add index for waste_management_forms foreign key
CREATE INDEX IF NOT EXISTS idx_waste_management_forms_employee_id 
  ON waste_management_forms(employee_id);
