/*
  # Fix Security and Performance Issues

  ## Overview
  This migration addresses multiple security and performance issues identified in the database audit.

  ## Changes Made

  ### 1. RLS Policy Performance Optimization
  - Replaced `auth.uid()` with `(select auth.uid())` in all policies
  - This prevents re-evaluation of auth functions for each row, improving query performance at scale
  - Affected tables: employees, attendance_logs, waste_management_forms

  ### 2. Remove Unused Indexes
  - Drops unused indexes that are not being utilized by queries
  - Reduces storage overhead and maintenance costs
  - Indexes removed: idx_employees_email, idx_attendance_logs_site_id, idx_waste_forms_employee, idx_waste_forms_community

  ### 3. Fix Multiple Permissive Policies
  - Combines multiple SELECT policies into single policies with OR conditions
  - Reduces policy evaluation overhead
  - Affected tables: employees, attendance_logs, waste_management_forms

  ### 4. Fix Function Search Path
  - Makes update_updated_at_column function immutable search_path
  - Prevents potential security vulnerabilities from search_path manipulation

  ## Security Notes
  - All changes maintain the same security posture
  - Performance improvements do not compromise data access controls
  - Function search path is now secure against manipulation
*/

-- Drop and recreate RLS policies with optimized auth function calls

-- ============================================
-- EMPLOYEES TABLE POLICIES
-- ============================================

-- Drop existing employee SELECT policies
DROP POLICY IF EXISTS "Users can view their own employee record" ON employees;
DROP POLICY IF EXISTS "Admin users can view all employees" ON employees;

-- Create combined SELECT policy for employees (fixes multiple permissive policies issue)
CREATE POLICY "Employees can view own record and admins view all"
  ON employees FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM employees AS emp
      WHERE emp.user_id = (select auth.uid())
      AND emp.role = 'admin'
      AND emp.active = true
    )
  );

-- Update INSERT policy
DROP POLICY IF EXISTS "Admin users can insert employees" ON employees;
CREATE POLICY "Admin users can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = (select auth.uid())
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

-- Update UPDATE policy
DROP POLICY IF EXISTS "Admin users can update employees" ON employees;
CREATE POLICY "Admin users can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees AS emp
      WHERE emp.user_id = (select auth.uid())
      AND emp.role = 'admin'
      AND emp.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees AS emp
      WHERE emp.user_id = (select auth.uid())
      AND emp.role = 'admin'
      AND emp.active = true
    )
  );

-- ============================================
-- ATTENDANCE_LOGS TABLE POLICIES
-- ============================================

-- Drop existing attendance_logs SELECT policies
DROP POLICY IF EXISTS "Employees can view their own attendance logs" ON attendance_logs;
DROP POLICY IF EXISTS "Admin users can view all attendance logs" ON attendance_logs;

-- Create combined SELECT policy (fixes multiple permissive policies issue)
CREATE POLICY "Employees view own logs and admins view all"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_logs.employee_id
      AND employees.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = (select auth.uid())
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

-- Update INSERT policy
DROP POLICY IF EXISTS "Employees can create their own attendance logs" ON attendance_logs;
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
-- SITES TABLE POLICIES
-- ============================================

-- Update sites policies to use optimized auth function calls
DROP POLICY IF EXISTS "Admin users can insert sites" ON sites;
CREATE POLICY "Admin users can insert sites"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = (select auth.uid())
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

DROP POLICY IF EXISTS "Admin users can update sites" ON sites;
CREATE POLICY "Admin users can update sites"
  ON sites FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = (select auth.uid())
      AND employees.role = 'admin'
      AND employees.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = (select auth.uid())
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

DROP POLICY IF EXISTS "Admin users can delete sites" ON sites;
CREATE POLICY "Admin users can delete sites"
  ON sites FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = (select auth.uid())
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

-- ============================================
-- WASTE MANAGEMENT FORMS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Field workers can create forms" ON waste_management_forms;
DROP POLICY IF EXISTS "Field workers can view own forms" ON waste_management_forms;
DROP POLICY IF EXISTS "Admins can view all forms" ON waste_management_forms;

-- Create combined SELECT policy (fixes multiple permissive policies)
CREATE POLICY "Field workers view own forms and admins view all"
  ON waste_management_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = waste_management_forms.employee_id
      AND employees.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = (select auth.uid())
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

-- Create INSERT policy with optimized auth function
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

-- ============================================
-- DROP UNUSED INDEXES
-- ============================================

DROP INDEX IF EXISTS idx_employees_email;
DROP INDEX IF EXISTS idx_attendance_logs_site_id;
DROP INDEX IF EXISTS idx_waste_forms_employee;
DROP INDEX IF EXISTS idx_waste_forms_community;

-- ============================================
-- FIX FUNCTION SEARCH PATH
-- ============================================

-- Recreate function with secure search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;