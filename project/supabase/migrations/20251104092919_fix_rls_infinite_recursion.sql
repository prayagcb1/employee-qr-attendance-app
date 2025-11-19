/*
  # Fix Infinite Recursion in RLS Policies

  ## Changes
  1. Drop existing policies that cause recursion
  2. Create a helper function to check admin role without recursion
  3. Recreate policies using the helper function
  
  ## Security
  - Maintains same security model
  - Fixes infinite recursion issue
  - Uses security definer function to bypass RLS when checking roles
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Admin users can view all employees" ON employees;
DROP POLICY IF EXISTS "Admin users can insert employees" ON employees;
DROP POLICY IF EXISTS "Admin users can update employees" ON employees;
DROP POLICY IF EXISTS "Admin users can insert sites" ON sites;
DROP POLICY IF EXISTS "Admin users can update sites" ON sites;
DROP POLICY IF EXISTS "Admin users can delete sites" ON sites;
DROP POLICY IF EXISTS "Admin users can view all attendance logs" ON attendance_logs;

-- Create a helper function to check if current user is an admin
-- Using SECURITY DEFINER to bypass RLS when checking role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid()
    AND role = 'admin'
    AND active = true
  );
$$;

-- Recreate policies using the helper function

-- Employees table policies
CREATE POLICY "Admin users can view all employees"
  ON employees FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admin users can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admin users can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Sites table policies
CREATE POLICY "Admin users can insert sites"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admin users can update sites"
  ON sites FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin users can delete sites"
  ON sites FOR DELETE
  TO authenticated
  USING (is_admin());

-- Attendance logs table policies
CREATE POLICY "Admin users can view all attendance logs"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (is_admin());
