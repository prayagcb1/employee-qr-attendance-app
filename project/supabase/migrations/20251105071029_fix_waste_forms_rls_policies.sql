/*
  # Fix Waste Management Forms RLS Policies

  1. Changes
    - Drop existing policies that are too restrictive
    - Create new policies that properly allow field workers to submit forms
    - Ensure admins can view all forms
*/

DROP POLICY IF EXISTS "Field workers can create forms" ON waste_management_forms;
DROP POLICY IF EXISTS "Field workers can view own forms" ON waste_management_forms;
DROP POLICY IF EXISTS "Admins can view all forms" ON waste_management_forms;

CREATE POLICY "Field workers can insert forms"
  ON waste_management_forms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.id = employee_id
      AND employees.role = 'field_worker'
      AND employees.active = true
    )
  );

CREATE POLICY "Employees can view own forms"
  ON waste_management_forms
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = employee_id
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );
