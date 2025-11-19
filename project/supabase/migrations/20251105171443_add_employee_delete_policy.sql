/*
  # Add DELETE policy for employees table

  1. Security
    - Add DELETE policy for admin users on employees table
    - Allows admins to delete employee records during testing and cleanup
*/

CREATE POLICY "Admin users can delete employees"
  ON employees
  FOR DELETE
  TO authenticated
  USING (is_admin());
