/*
  # Add Office Employee Role

  1. Changes
    - Update the role CHECK constraint on employees table to include 'office_employee' role
    - Add 'office_employee' as a valid role option
  
  2. Security
    - No changes to RLS policies needed
    - Existing policies will work with the new role
*/

DO $$
BEGIN
  -- Drop the existing check constraint
  ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;

  -- Add the new check constraint with office_employee role
  ALTER TABLE employees 
    ADD CONSTRAINT employees_role_check 
    CHECK (role IN ('field_worker', 'supervisor', 'admin', 'intern', 'office_employee'));
END $$;
