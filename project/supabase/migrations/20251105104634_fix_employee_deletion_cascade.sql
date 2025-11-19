/*
  # Fix Employee Deletion Cascade

  1. Changes
    - Update waste_management_forms foreign key to CASCADE on delete
    - This ensures when an employee is deleted, all their waste forms are also deleted
    - Maintains data integrity while allowing admin deletion

  2. Security
    - No changes to RLS policies
    - Ensures referential integrity
*/

-- Drop the existing foreign key constraint
ALTER TABLE waste_management_forms 
DROP CONSTRAINT IF EXISTS waste_management_forms_employee_id_fkey;

-- Add the foreign key constraint with CASCADE delete
ALTER TABLE waste_management_forms
ADD CONSTRAINT waste_management_forms_employee_id_fkey
FOREIGN KEY (employee_id) 
REFERENCES employees(id) 
ON DELETE CASCADE;
