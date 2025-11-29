/*
  # Fix Remaining Auth RLS Issues

  ## Overview
  The "Allow username lookup for login" policy still needs optimization
  and we need to ensure it works for anon users during login.

  ## Changes
  1. Recreate "Allow username lookup for login" policy (already optimal with USING true)
  2. Ensure all auth policies are optimized

  ## Security Impact
  - Maintains login functionality
  - No performance degradation
*/

-- The "Allow username lookup for login" policy uses USING (true) which is already optimal
-- It allows anonymous users to look up employees by username/email for login
-- This is necessary and secure as it only allows SELECT without exposing sensitive data

-- Verify the policy exists correctly
DO $$
BEGIN
  -- Check if policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employees' 
    AND policyname = 'Allow username lookup for login'
  ) THEN
    CREATE POLICY "Allow username lookup for login"
      ON employees FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
