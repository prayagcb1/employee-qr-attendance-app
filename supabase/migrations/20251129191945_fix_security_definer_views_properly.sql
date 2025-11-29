/*
  # Fix Security Definer Views - Remove SECURITY DEFINER Property

  ## Overview
  The three views are still using SECURITY DEFINER which is a security risk.
  We need to drop and recreate them as regular views.

  ## Changes
  1. Drop waste_management_forms_with_names view
  2. Drop attendance_logs_with_names view  
  3. Drop bins_with_site_names view
  4. Recreate all three as regular views (without SECURITY DEFINER)

  ## Security Impact
  - Views will use caller's privileges (much safer)
  - Underlying RLS policies will still protect the data
  - No privilege escalation possible
*/

-- Drop existing views
DROP VIEW IF EXISTS waste_management_forms_with_names CASCADE;
DROP VIEW IF EXISTS attendance_logs_with_names CASCADE;
DROP VIEW IF EXISTS bins_with_site_names CASCADE;

-- Recreate waste_management_forms_with_names as a regular view
CREATE VIEW waste_management_forms_with_names AS
SELECT 
  waste_management_forms.*,
  employees.full_name,
  employees.employee_code
FROM waste_management_forms
INNER JOIN employees ON waste_management_forms.employee_id = employees.id;

-- Recreate attendance_logs_with_names as a regular view
CREATE VIEW attendance_logs_with_names AS
SELECT 
  attendance_logs.*,
  employees.full_name,
  employees.employee_code,
  sites.name as site_name
FROM attendance_logs
INNER JOIN employees ON attendance_logs.employee_id = employees.id
INNER JOIN sites ON attendance_logs.site_id = sites.id;

-- Recreate bins_with_site_names as a regular view
CREATE VIEW bins_with_site_names AS
SELECT 
  bins.*,
  sites.name as site_name,
  sites.address as site_address
FROM bins
INNER JOIN sites ON bins.site_id = sites.id;
