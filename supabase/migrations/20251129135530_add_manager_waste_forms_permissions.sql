/*
  # Add Manager Permissions for Waste Forms

  ## Overview
  Grant managers the same viewing permissions as admins for waste management forms.
  Managers should be able to view all waste forms submitted by any employee.

  ## Changes
  1. Add SELECT policy for managers to view all waste forms
  2. Managers maintain insert permissions from existing policy

  ## Security
  - Only authenticated users with manager role can view all forms
  - Insert permissions remain restricted to authorized roles
*/

-- Add policy for managers to read all waste forms
CREATE POLICY "manager_read_all_waste_forms"
  ON waste_management_forms
  FOR SELECT
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'manager');
