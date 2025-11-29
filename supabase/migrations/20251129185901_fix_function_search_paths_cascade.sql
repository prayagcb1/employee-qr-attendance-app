/*
  # Fix Function Search Paths with CASCADE

  ## Overview
  Set immutable search paths for security functions. This requires
  recreating dependent policies.

  ## Changes
  1. Drop and recreate get_employee_role with proper search path
  2. Drop and recreate is_active_employee with proper search path

  ## Security Impact
  - Prevents search_path manipulation attacks
  - Ensures functions always use correct schema
*/

-- Drop functions with CASCADE (this will drop dependent policies)
DROP FUNCTION IF EXISTS get_employee_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_active_employee() CASCADE;

-- Recreate get_employee_role with proper search path
CREATE OR REPLACE FUNCTION get_employee_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM employees
  WHERE employees.user_id = get_employee_role.user_id
  AND active = true;
  
  RETURN user_role;
END;
$$;

-- Recreate is_active_employee with proper search path
CREATE OR REPLACE FUNCTION is_active_employee()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  is_active boolean;
BEGIN
  SELECT active INTO is_active
  FROM employees
  WHERE user_id = auth.uid();
  
  RETURN COALESCE(is_active, false);
END;
$$;
