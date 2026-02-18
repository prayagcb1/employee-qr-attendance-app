/*
  # Restrict Field Supervisor Employee Access

  ## Overview
  Field supervisors should only be able to view field staff (field workers and field supervisors),
  not all employees in the system.

  ## Changes
  1. Drop the existing field_supervisor_read_employees policy
  2. Create a new policy that restricts field supervisors to only view field staff

  ## Security
  - Field supervisors can only read employees with roles: field_worker, field_supervisor
  - This ensures proper data access control and privacy
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "field_supervisor_read_employees" ON employees;

-- Create new restricted policy for field supervisors
CREATE POLICY "field_supervisor_read_field_staff_only"
  ON employees
  FOR SELECT
  TO authenticated
  USING (
    get_employee_role(auth.uid()) = 'field_supervisor'
    AND role IN ('field_worker', 'field_supervisor')
  );
