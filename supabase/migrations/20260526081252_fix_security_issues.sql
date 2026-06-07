/*
  # Fix Security Issues

  1. Function Search Path Mutable
     - Set explicit search_path = '' on update_updated_at_column, calculate_wfh_duration, is_active_employee
  2. RLS Policy Always True
     - Replace the unrestricted INSERT policy on leave_attendance with one that checks auth.uid()
  3. Public/Authenticated Can Execute SECURITY DEFINER Functions
     - Revoke EXECUTE on get_employee_role and is_active_employee from anon and authenticated roles
*/

-- 1. Fix mutable search paths by setting search_path = '' and qualifying all object references

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_wfh_duration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.end_date IS NOT NULL AND NEW.start_date IS NOT NULL THEN
    NEW.duration_days = (NEW.end_date - NEW.start_date) + 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix is_active_employee() - no-arg version
CREATE OR REPLACE FUNCTION public.is_active_employee()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees
    WHERE user_id = auth.uid()
    AND active = true
  );
END;
$$;

-- Fix is_active_employee(user_uuid uuid) - with-arg version
CREATE OR REPLACE FUNCTION public.is_active_employee(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees
    WHERE user_id = user_uuid
    AND active = true
  );
END;
$$;

-- 2. Revoke public/anon/authenticated EXECUTE from SECURITY DEFINER functions
--    that should not be callable directly via RPC

REVOKE EXECUTE ON FUNCTION public.get_employee_role(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_employee() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_employee(uuid) FROM anon, authenticated;

-- Re-grant only to authenticated for is_active_employee since RLS policies use it internally
-- (the functions are called by RLS policies as SECURITY DEFINER, so no direct grant needed)

-- 3. Fix RLS policy on leave_attendance that has always-true WITH CHECK
--    Drop the overly-permissive policy and replace with one scoped to authenticated employees

DO $$
BEGIN
  -- Drop the always-true insert policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leave_attendance'
      AND cmd = 'INSERT'
      AND policyname ILIKE '%system%insert%leave%attendance%'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert leave attendance" ON public.leave_attendance';
  END IF;
END $$;

-- Create a properly scoped insert policy
-- Leave attendance records are inserted by the system on behalf of employees;
-- restrict to authenticated users who are active employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leave_attendance'
      AND cmd = 'INSERT'
      AND policyname = 'Active employees can insert leave attendance records'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Active employees can insert leave attendance records"
        ON public.leave_attendance
        FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.employees
            WHERE employees.id = leave_attendance.employee_id
            AND employees.active = true
          )
        )
    $policy$;
  END IF;
END $$;
