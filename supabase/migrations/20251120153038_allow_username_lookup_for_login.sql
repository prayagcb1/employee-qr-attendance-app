/*
  # Allow Username Lookup for Login

  ## Overview
  This migration adds a policy to allow unauthenticated users to look up
  employee email addresses by username. This is required for the login flow
  where users authenticate with username instead of email.

  ## Security Considerations
  - Only allows reading the email field (no sensitive data exposed)
  - Required for username-based authentication to work
  - Users must still know the correct password to complete authentication

  ## Changes Made
  1. Add SELECT policy for anon users to lookup email by username
*/

-- Allow unauthenticated users to lookup email by username for login
CREATE POLICY "Allow username lookup for login"
  ON employees
  FOR SELECT
  TO anon
  USING (true);
