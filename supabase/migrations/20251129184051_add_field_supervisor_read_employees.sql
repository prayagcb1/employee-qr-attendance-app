/*
  # Add Field Supervisor Permission to Read Employees

  ## Overview
  Field supervisors need to read employee data when viewing waste forms
  because waste forms have a join to the employees table.

  ## Changes
  1. Add SELECT policy for field_supervisor role on employees table

  ## Security
  - Only authenticated field supervisors can read employee data
  - This allows waste forms to properly display employee information
*/

-- Add policy for field supervisors to read employees
CREATE POLICY "field_supervisor_read_employees"
  ON employees
  FOR SELECT
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'field_supervisor');
