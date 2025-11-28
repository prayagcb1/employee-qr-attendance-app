/*
  # Make Email Optional for Employees

  ## Overview
  This migration makes the email field optional in the employees table,
  allowing employees to be created without an email address.

  ## Changes Made
  1. Remove NOT NULL constraint from email column in employees table
  2. This allows flexibility for employees who may not have email addresses

  ## Notes
  - Existing employees with emails remain unchanged
  - New employees can be created with or without email
  - System will use username@temp.local format for authentication if no email provided
*/

-- Make email column optional
ALTER TABLE employees 
  ALTER COLUMN email DROP NOT NULL;
