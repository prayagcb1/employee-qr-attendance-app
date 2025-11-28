/*
  # Add Date of Joining Field to Employees

  ## Overview
  This migration adds a date_of_joining field to the employees table
  to track when each employee started working.

  ## Changes Made
  1. Add date_of_joining column (date type, not null with default)
  2. For existing employees, set date_of_joining to their created_at date
  3. New employees will have their joining date explicitly set

  ## Notes
  - Existing employees will have date_of_joining = created_at::date
  - New employees must provide date_of_joining during creation
*/

-- Add date_of_joining column with default as today
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS date_of_joining DATE NOT NULL DEFAULT CURRENT_DATE;

-- Update existing employees to use their created_at date
UPDATE employees 
  SET date_of_joining = created_at::date 
  WHERE date_of_joining = CURRENT_DATE;
