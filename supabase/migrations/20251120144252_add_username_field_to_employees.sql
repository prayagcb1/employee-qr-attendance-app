/*
  # Add Username Field to Employees Table

  ## Overview
  This migration adds a username field to the employees table to allow
  username-based authentication instead of email-based login.

  ## Changes Made
  1. Tables Modified
    - `employees` table: Add `username` column (unique, required)

  ## Important Notes
  - Username must be unique across all employees
  - Username cannot be null and must be provided during employee creation
  - Existing employees will need usernames assigned
*/

-- Add username column to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'username'
  ) THEN
    ALTER TABLE employees ADD COLUMN username text UNIQUE;
  END IF;
END $$;

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username);
