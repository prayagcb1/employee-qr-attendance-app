/*
  # Fix Waste Management Forms RLS to use user_id

  ## Changes
  - Drop existing policies
  - Create helper function to check if user is a field worker
  - Create correct policies that use user_id to match auth.uid()
  
  ## Security
  - Field workers can insert their own forms
  - Employees can view their own forms
  - Admins can view all forms
*/

DROP POLICY IF EXISTS "Field workers can insert forms" ON waste_management_forms;
DROP POLICY IF EXISTS "Employees can view own forms" ON waste_management_forms;

CREATE OR REPLACE FUNCTION is_field_worker()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid()
    AND role = 'field_worker'
    AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION get_employee_id_from_user()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM employees WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "Field workers can insert forms"
  ON waste_management_forms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_field_worker()
    AND employee_id = get_employee_id_from_user()
  );

CREATE POLICY "Employees can view own forms"
  ON waste_management_forms
  FOR SELECT
  TO authenticated
  USING (
    employee_id = get_employee_id_from_user()
    OR is_admin()
  );
