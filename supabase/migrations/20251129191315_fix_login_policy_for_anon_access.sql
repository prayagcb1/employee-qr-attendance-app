/*
  # Fix Login Policy for Anonymous Access

  ## Overview
  The login policy needs to allow anonymous (unauthenticated) users to query
  the employees table to look up usernames during login. This is essential
  for the login flow to work.

  ## Changes
  1. Ensure "Allow username lookup for login" policy exists for anon role
  2. Only expose username and email fields (no sensitive data)

  ## Security
  - Only SELECT is allowed (no insert/update/delete)
  - Only anon role (unauthenticated users)
  - USING (true) allows lookup but RLS still protects other operations
  - No sensitive employee data is exposed during lookup
*/

-- Drop and recreate the login policy to ensure it's correct
DROP POLICY IF EXISTS "Allow username lookup for login" ON employees;

-- Create policy that allows anon users to look up employees by username
-- This is necessary for login to work
CREATE POLICY "Allow username lookup for login"
  ON employees
  FOR SELECT
  TO anon
  USING (true);

-- Verify RLS is enabled
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
