/*
  # Add Field Worker Permission to Read Employees

  ## Overview
  Field workers need to read employee data for various features like
  viewing their own profile and seeing who submitted waste forms.

  ## Changes
  1. Add SELECT policy for field_worker role on employees table

  ## Security
  - Only authenticated field workers can read employee data
  - This allows proper display of employee information across the app
*/

-- Add policy for field workers to read employees
CREATE POLICY "field_worker_read_employees"
  ON employees
  FOR SELECT
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'field_worker');
