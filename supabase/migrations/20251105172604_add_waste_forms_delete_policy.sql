/*
  # Add DELETE policy for waste management forms

  1. Security
    - Add DELETE policy for admin users on waste_management_forms table
    - Allows admins to delete waste management form records
*/

CREATE POLICY "Admins can delete waste forms"
  ON waste_management_forms
  FOR DELETE
  TO authenticated
  USING (is_admin());
