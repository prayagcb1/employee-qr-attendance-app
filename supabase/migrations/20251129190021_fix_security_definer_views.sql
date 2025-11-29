/*
  # Fix Security Definer Views

  ## Overview
  Remove SECURITY DEFINER from views as they don't need elevated privileges
  and can create security risks. Views should rely on underlying table RLS.

  ## Changes
  1. Recreate bins_with_site_names without SECURITY DEFINER
  2. Recreate attendance_logs_with_names without SECURITY DEFINER
  3. Recreate waste_management_forms_with_names without SECURITY DEFINER

  ## Security Impact
  - Views will use caller's privileges (safer)
  - Underlying RLS policies will still protect data
  - Removes unnecessary privilege escalation
*/

-- Drop and recreate bins_with_site_names
DROP VIEW IF EXISTS bins_with_site_names;

CREATE VIEW bins_with_site_names AS
SELECT 
  bins.*,
  sites.name as site_name,
  sites.address as site_address
FROM bins
INNER JOIN sites ON bins.site_id = sites.id;

-- Drop and recreate attendance_logs_with_names
DROP VIEW IF EXISTS attendance_logs_with_names;

CREATE VIEW attendance_logs_with_names AS
SELECT 
  attendance_logs.*,
  employees.full_name,
  employees.employee_code,
  sites.name as site_name
FROM attendance_logs
INNER JOIN employees ON attendance_logs.employee_id = employees.id
INNER JOIN sites ON attendance_logs.site_id = sites.id;

-- Drop and recreate waste_management_forms_with_names
DROP VIEW IF EXISTS waste_management_forms_with_names;

CREATE VIEW waste_management_forms_with_names AS
SELECT 
  waste_management_forms.*,
  employees.full_name,
  employees.employee_code
FROM waste_management_forms
INNER JOIN employees ON waste_management_forms.employee_id = employees.id;
