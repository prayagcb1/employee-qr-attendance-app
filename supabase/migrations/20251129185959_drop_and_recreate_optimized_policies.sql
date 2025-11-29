/*
  # Drop and Recreate All RLS Policies with Optimized Auth Functions

  ## Overview
  Drop all existing policies and recreate them using (SELECT auth.uid()) 
  instead of auth.uid() to avoid re-evaluation per row.

  ## Performance Impact
  - Auth functions evaluated once per query instead of per row
  - Significant performance improvement for large datasets
*/

-- ============================================
-- DROP ALL EXISTING POLICIES
-- ============================================

-- Drop employee policies
DROP POLICY IF EXISTS "Employee can read own record" ON employees;
DROP POLICY IF EXISTS "admin_read_employees" ON employees;
DROP POLICY IF EXISTS "admin_insert_employees" ON employees;
DROP POLICY IF EXISTS "admin_update_employees" ON employees;
DROP POLICY IF EXISTS "admin_delete_employees" ON employees;
DROP POLICY IF EXISTS "manager_read_employees" ON employees;
DROP POLICY IF EXISTS "manager_insert_employees" ON employees;
DROP POLICY IF EXISTS "manager_update_employees" ON employees;
DROP POLICY IF EXISTS "manager_delete_employees" ON employees;
DROP POLICY IF EXISTS "field_supervisor_read_employees" ON employees;
DROP POLICY IF EXISTS "field_worker_read_employees" ON employees;

-- Drop site policies
DROP POLICY IF EXISTS "admin_read_sites" ON sites;
DROP POLICY IF EXISTS "admin_insert_sites" ON sites;
DROP POLICY IF EXISTS "admin_update_sites" ON sites;
DROP POLICY IF EXISTS "admin_delete_sites" ON sites;
DROP POLICY IF EXISTS "manager_read_sites" ON sites;
DROP POLICY IF EXISTS "manager_insert_sites" ON sites;
DROP POLICY IF EXISTS "manager_update_sites" ON sites;
DROP POLICY IF EXISTS "manager_delete_sites" ON sites;
DROP POLICY IF EXISTS "workers_read_sites" ON sites;

-- Drop bin policies
DROP POLICY IF EXISTS "admin_read_bins" ON bins;
DROP POLICY IF EXISTS "admin_insert_bins" ON bins;
DROP POLICY IF EXISTS "admin_update_bins" ON bins;
DROP POLICY IF EXISTS "admin_delete_bins" ON bins;
DROP POLICY IF EXISTS "manager_read_bins" ON bins;
DROP POLICY IF EXISTS "manager_insert_bins" ON bins;
DROP POLICY IF EXISTS "manager_update_bins" ON bins;
DROP POLICY IF EXISTS "manager_delete_bins" ON bins;
DROP POLICY IF EXISTS "workers_read_bins" ON bins;

-- Drop attendance policies
DROP POLICY IF EXISTS "admin_read_all_attendance" ON attendance_logs;
DROP POLICY IF EXISTS "manager_read_attendance_logs" ON attendance_logs;
DROP POLICY IF EXISTS "workers_read_own_attendance" ON attendance_logs;
DROP POLICY IF EXISTS "workers_insert_attendance" ON attendance_logs;

-- Drop waste form policies
DROP POLICY IF EXISTS "admin_read_waste_forms" ON waste_management_forms;
DROP POLICY IF EXISTS "admin_update_waste_forms" ON waste_management_forms;
DROP POLICY IF EXISTS "admin_delete_waste_forms" ON waste_management_forms;
DROP POLICY IF EXISTS "manager_read_all_waste_forms" ON waste_management_forms;
DROP POLICY IF EXISTS "manager_update_waste_forms" ON waste_management_forms;
DROP POLICY IF EXISTS "manager_delete_waste_forms" ON waste_management_forms;
DROP POLICY IF EXISTS "field_supervisor_read_all_waste_forms" ON waste_management_forms;
DROP POLICY IF EXISTS "workers_read_own_waste_forms" ON waste_management_forms;
DROP POLICY IF EXISTS "workers_insert_waste_forms" ON waste_management_forms;

-- ============================================
-- RECREATE OPTIMIZED POLICIES
-- ============================================

-- Employee policies
CREATE POLICY "Employee can read own record"
  ON employees FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "admin_read_employees"
  ON employees FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "admin_insert_employees"
  ON employees FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "admin_update_employees"
  ON employees FOR UPDATE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin')
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "admin_delete_employees"
  ON employees FOR DELETE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "manager_read_employees"
  ON employees FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "manager_insert_employees"
  ON employees FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "manager_update_employees"
  ON employees FOR UPDATE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager')
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "manager_delete_employees"
  ON employees FOR DELETE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "field_supervisor_read_employees"
  ON employees FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'field_supervisor');

CREATE POLICY "field_worker_read_employees"
  ON employees FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'field_worker');

-- Site policies
CREATE POLICY "admin_read_sites"
  ON sites FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "admin_insert_sites"
  ON sites FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "admin_update_sites"
  ON sites FOR UPDATE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin')
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "admin_delete_sites"
  ON sites FOR DELETE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "manager_read_sites"
  ON sites FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "manager_insert_sites"
  ON sites FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "manager_update_sites"
  ON sites FOR UPDATE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager')
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "manager_delete_sites"
  ON sites FOR DELETE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "workers_read_sites"
  ON sites FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) IN ('field_worker', 'field_supervisor'));

-- Bin policies
CREATE POLICY "admin_read_bins"
  ON bins FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "admin_insert_bins"
  ON bins FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "admin_update_bins"
  ON bins FOR UPDATE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin')
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "admin_delete_bins"
  ON bins FOR DELETE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "manager_read_bins"
  ON bins FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "manager_insert_bins"
  ON bins FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "manager_update_bins"
  ON bins FOR UPDATE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager')
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "manager_delete_bins"
  ON bins FOR DELETE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "workers_read_bins"
  ON bins FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) IN ('field_worker', 'field_supervisor'));

-- Attendance policies
CREATE POLICY "admin_read_all_attendance"
  ON attendance_logs FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "manager_read_attendance_logs"
  ON attendance_logs FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "workers_read_own_attendance"
  ON attendance_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_logs.employee_id
      AND employees.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "workers_insert_attendance"
  ON attendance_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_logs.employee_id
      AND employees.user_id = (SELECT auth.uid())
      AND employees.active = true
    )
  );

-- Waste form policies
CREATE POLICY "admin_read_waste_forms"
  ON waste_management_forms FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "admin_update_waste_forms"
  ON waste_management_forms FOR UPDATE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin')
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "admin_delete_waste_forms"
  ON waste_management_forms FOR DELETE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'admin');

CREATE POLICY "manager_read_all_waste_forms"
  ON waste_management_forms FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "manager_update_waste_forms"
  ON waste_management_forms FOR UPDATE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager')
  WITH CHECK ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "manager_delete_waste_forms"
  ON waste_management_forms FOR DELETE TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'manager');

CREATE POLICY "field_supervisor_read_all_waste_forms"
  ON waste_management_forms FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'field_supervisor');

CREATE POLICY "workers_read_own_waste_forms"
  ON waste_management_forms FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = waste_management_forms.employee_id
      AND employees.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "workers_insert_waste_forms"
  ON waste_management_forms FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = waste_management_forms.employee_id
      AND employees.user_id = (SELECT auth.uid())
      AND employees.role IN ('field_worker', 'field_supervisor', 'manager', 'admin')
      AND employees.active = true
    )
  );
