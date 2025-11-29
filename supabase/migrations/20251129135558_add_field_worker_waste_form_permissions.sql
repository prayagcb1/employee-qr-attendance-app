/*
  # Add Field Worker Permissions for Waste Forms

  ## Overview
  Allow field workers to submit waste management forms.
  The existing policy only allowed field supervisors, managers, and admins.

  ## Changes
  1. Drop existing insert policy
  2. Create new insert policy that includes field_worker role

  ## Security
  - Only authenticated field workers can insert their own forms
  - User must be active employee
  - Employee ID must match the authenticated user
*/

-- Drop existing policy
DROP POLICY IF EXISTS "supervisors_insert_waste_forms" ON waste_management_forms;

-- Create new policy that includes field_worker
CREATE POLICY "workers_insert_waste_forms"
  ON waste_management_forms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = waste_management_forms.employee_id
      AND employees.user_id = auth.uid()
      AND employees.role IN ('field_worker', 'field_supervisor', 'manager', 'admin')
      AND employees.active = true
    )
  );
