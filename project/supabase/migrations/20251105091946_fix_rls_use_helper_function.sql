/*
  # Fix RLS Policies to Use Helper Function

  ## Overview
  The recent security migration broke the RLS policies by not using the is_admin() helper function.
  This caused infinite recursion to return.

  ## Solution
  - Restore all admin policies to use the is_admin() helper function
  - Keep the optimized (select auth.uid()) pattern for non-admin policies
  - This prevents recursion while maintaining performance

  ## Changes
  - Update all admin-related policies to use is_admin()
  - Keep user-specific policies with optimized auth calls
*/

-- ============================================
-- EMPLOYEES TABLE POLICIES
-- ============================================

-- Drop all existing employee policies
DROP POLICY IF EXISTS "Users can view their own employee record" ON employees;
DROP POLICY IF EXISTS "Admin users can view all employees" ON employees;
DROP POLICY IF EXISTS "Admin users can insert employees" ON employees;
DROP POLICY IF EXISTS "Admin users can update employees" ON employees;

-- Recreate with correct pattern
CREATE POLICY "Users can view their own employee record"
  ON employees FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

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

-- ============================================
-- SITES TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admin users can insert sites" ON sites;
DROP POLICY IF EXISTS "Admin users can update sites" ON sites;
DROP POLICY IF EXISTS "Admin users can delete sites" ON sites;

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

-- ============================================
-- ATTENDANCE_LOGS TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Employees can view their own attendance logs" ON attendance_logs;
DROP POLICY IF EXISTS "Admin users can view all attendance logs" ON attendance_logs;
DROP POLICY IF EXISTS "Employees can create their own attendance logs" ON attendance_logs;

CREATE POLICY "Employees can view their own attendance logs"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_logs.employee_id
      AND employees.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Admin users can view all attendance logs"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Employees can create their own attendance logs"
  ON attendance_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_logs.employee_id
      AND employees.user_id = (select auth.uid())
      AND employees.active = true
    )
  );

-- ============================================
-- WASTE MANAGEMENT FORMS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Field workers can view own forms" ON waste_management_forms;
DROP POLICY IF EXISTS "Admins can view all waste forms" ON waste_management_forms;
DROP POLICY IF EXISTS "Field workers can create forms" ON waste_management_forms;

CREATE POLICY "Field workers can view own forms"
  ON waste_management_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = waste_management_forms.employee_id
      AND employees.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Admins can view all waste forms"
  ON waste_management_forms FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Field workers can create forms"
  ON waste_management_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = waste_management_forms.employee_id
      AND employees.user_id = (select auth.uid())
      AND employees.active = true
    )
  );