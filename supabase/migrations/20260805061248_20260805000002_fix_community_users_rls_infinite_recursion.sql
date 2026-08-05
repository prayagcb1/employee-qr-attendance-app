/*
# Fix infinite recursion in community_users RLS policy

## Problem
The "Community users read same community" SELECT policy on community_users
contains a subquery against community_users itself, causing infinite recursion
when Postgres evaluates RLS.

## Fix
1. Create a SECURITY DEFINER function get_my_community_id() that reads
   community_users with RLS bypassed (security definer + fixed search_path).
   This function returns the community_id for the current auth.uid(), or NULL.
2. Drop and recreate the recursive policy to use the function instead of a
   self-referencing subquery.
3. Preserve all other policies and permissions exactly as they were.
*/

-- ============================================================
-- Helper function: get_my_community_id
-- SECURITY DEFINER so it bypasses RLS (avoids recursion).
-- Returns the community_id of the current community_user, or NULL.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_community_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community_id uuid;
BEGIN
  SELECT community_id INTO v_community_id
  FROM public.community_users
  WHERE user_id = auth.uid()
    AND active = true
  LIMIT 1;

  RETURN v_community_id;
END;
$$;

-- Grant execute to authenticated so RLS policies can call it
REVOKE ALL ON FUNCTION public.get_my_community_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_community_id() TO authenticated;

-- ============================================================
-- Fix the recursive policy on community_users
-- ============================================================

-- Drop the recursive policy
DROP POLICY IF EXISTS "Community users read same community" ON community_users;

-- Recreate it using the SECURITY DEFINER function instead of a self-join
CREATE POLICY "Community users read same community"
  ON community_users FOR SELECT
  TO authenticated
  USING (
    get_my_community_id() IS NOT NULL
    AND community_users.community_id = get_my_community_id()
  );
