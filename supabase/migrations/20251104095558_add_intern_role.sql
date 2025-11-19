/*
  # Add Intern Role to Employee System

  1. Changes
    - Update the role CHECK constraint on employees table to include 'intern' role
    - Add 'intern' as a valid role option alongside field_worker, supervisor, and admin
  
  2. Security
    - No changes to RLS policies needed
    - Existing policies will work with the new role
*/

DO $$
BEGIN
  -- Drop the existing check constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'employees' 
    AND constraint_name LIKE '%role%check%'
  ) THEN
    ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
  END IF;

  -- Add the new check constraint with intern role
  ALTER TABLE employees 
    ADD CONSTRAINT employees_role_check 
    CHECK (role IN ('field_worker', 'supervisor', 'admin', 'intern'));
END $$;
