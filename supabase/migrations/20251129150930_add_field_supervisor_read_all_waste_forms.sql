/*
  # Add Field Supervisor Permission to View All Waste Forms

  ## Overview
  Field supervisors should be able to view all waste forms submitted by anyone,
  not just their own forms. This aligns with their supervisory role.

  ## Changes
  1. Add SELECT policy for field_supervisor role to view all waste forms

  ## Security
  - Only authenticated field supervisors can view all forms
  - This allows proper oversight and supervision
*/

-- Add policy for field supervisors to read all waste forms
CREATE POLICY "field_supervisor_read_all_waste_forms"
  ON waste_management_forms
  FOR SELECT
  TO authenticated
  USING (get_employee_role(auth.uid()) = 'field_supervisor');
