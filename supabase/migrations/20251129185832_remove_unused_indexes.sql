/*
  # Remove Unused Indexes

  ## Overview
  Remove indexes that are not being used to reduce storage overhead
  and improve write performance.

  ## Changes
  1. Drop idx_employees_username (unused)
  2. Drop idx_employees_email (unused)
  3. Drop idx_employees_active (unused)
  4. Drop idx_sites_active (unused)

  ## Performance Impact
  - Reduces storage usage
  - Improves INSERT/UPDATE performance
  - No query performance impact since these indexes are not used
*/

-- Drop unused indexes
DROP INDEX IF EXISTS idx_employees_username;
DROP INDEX IF EXISTS idx_employees_email;
DROP INDEX IF EXISTS idx_employees_active;
DROP INDEX IF EXISTS idx_sites_active;
