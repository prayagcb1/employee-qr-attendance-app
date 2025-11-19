/*
  # Update employee roles and add new roles

  1. Changes
    - Update existing 'field_worker' role to 'field_supervisor'
    - Update existing 'supervisor' role to 'field_supervisor'
    - Add new roles: 'manager' and 'field_worker'
    - Update role check constraint to include all roles
  
  2. Notes
    - Existing field_worker and supervisor employees will be updated to field_supervisor
    - No data loss - only role names are being updated
*/

-- Drop existing constraint first
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;

-- Update existing roles to field_supervisor
UPDATE employees 
SET role = 'field_supervisor' 
WHERE role IN ('field_worker', 'supervisor');

-- Add new constraint with updated roles
ALTER TABLE employees ADD CONSTRAINT employees_role_check 
  CHECK (role IN ('admin', 'field_supervisor', 'manager', 'field_worker', 'office_employee', 'intern'));