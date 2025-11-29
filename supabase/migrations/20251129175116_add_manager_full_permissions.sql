/*
  # Grant Manager Full Admin Permissions

  ## Overview
  Managers should have identical permissions to Admins for all operations.
  This migration adds all necessary policies for managers.

  ## Changes
  1. Add SELECT policy for managers on employees table
  2. Add INSERT policy for managers on employees table  
  3. Add UPDATE policy for managers on employees table
  4. Add DELETE policy for managers on employees table
  5. Add SELECT policy for managers on sites table
  6. Add INSERT policy for managers on sites table
  7. Add UPDATE policy for managers on sites table
  8. Add DELETE policy for managers on sites table
  9. Add SELECT policy for managers on bins table
  10. Add INSERT policy for managers on bins table
  11. Add UPDATE policy for managers on bins table
  12. Add DELETE policy for managers on bins table
  13. Add SELECT policy for managers on attendance_logs table
  14. Add UPDATE policy for managers on waste_management_forms table
  15. Add DELETE policy for managers on waste_management_forms table

  ## Security
  - Only authenticated users with manager role can perform these operations
  - Manager permissions match admin permissions exactly
*/

-- Employees table policies for managers
CREATE POLICY "manager_read_employees"
  ON employees
  FOR SELECT
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager');

CREATE POLICY "manager_insert_employees"
  ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'manager');

CREATE POLICY "manager_update_employees"
  ON employees
  FOR UPDATE
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager')
  WITH CHECK (get_employee_role(auth.uid()) = 'manager');

CREATE POLICY "manager_delete_employees"
  ON employees
  FOR DELETE
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager');

-- Sites table policies for managers
CREATE POLICY "manager_read_sites"
  ON sites
  FOR SELECT
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager');

CREATE POLICY "manager_insert_sites"
  ON sites
  FOR INSERT
  TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'manager');

CREATE POLICY "manager_update_sites"
  ON sites
  FOR UPDATE
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager')
  WITH CHECK (get_employee_role(auth.uid()) = 'manager');

CREATE POLICY "manager_delete_sites"
  ON sites
  FOR DELETE
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager');

-- Bins table policies for managers
CREATE POLICY "manager_read_bins"
  ON bins
  FOR SELECT
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager');

CREATE POLICY "manager_insert_bins"
  ON bins
  FOR INSERT
  TO authenticated
  WITH CHECK (get_employee_role(auth.uid()) = 'manager');

CREATE POLICY "manager_update_bins"
  ON bins
  FOR UPDATE
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager')
  WITH CHECK (get_employee_role(auth.uid()) = 'manager');

CREATE POLICY "manager_delete_bins"
  ON bins
  FOR DELETE
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager');

-- Attendance logs table policy for managers
CREATE POLICY "manager_read_attendance_logs"
  ON attendance_logs
  FOR SELECT
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager');

-- Waste management forms policies for managers
CREATE POLICY "manager_update_waste_forms"
  ON waste_management_forms
  FOR UPDATE
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager')
  WITH CHECK (get_employee_role(auth.uid()) = 'manager');

CREATE POLICY "manager_delete_waste_forms"
  ON waste_management_forms
  FOR DELETE
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager');
