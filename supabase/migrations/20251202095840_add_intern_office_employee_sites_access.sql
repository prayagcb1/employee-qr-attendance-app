/*
  # Add Sites Access for Intern and Office Employee Roles

  ## Overview
  Interns and Office Employees cannot scan QR codes because they don't have 
  permission to read the sites table. This migration adds read access.

  ## Changes
  1. Add SELECT policy for interns to read sites
  2. Add SELECT policy for office employees to read sites

  ## Security
  - Read-only access to sites table
  - Only authenticated users with intern or office_employee role
  - No write permissions granted
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "interns_read_sites" ON sites;
DROP POLICY IF EXISTS "office_employees_read_sites" ON sites;

-- Allow interns to read sites for QR scanning
CREATE POLICY "interns_read_sites"
  ON sites
  FOR SELECT
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'intern');

-- Allow office employees to read sites for QR scanning
CREATE POLICY "office_employees_read_sites"
  ON sites
  FOR SELECT
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'office_employee');
