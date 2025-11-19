/*
  # Fix Missing Indexes and Duplicate Policies

  ## Overview
  This migration addresses remaining security and performance issues.

  ## Changes Made

  ### 1. Add Missing Foreign Key Indexes
  - Add index on attendance_logs.site_id (foreign key to sites)
  - Add index on waste_management_forms.employee_id (foreign key to employees)
  - These indexes improve JOIN performance and foreign key constraint checks

  ### 2. Remove Duplicate Policies
  - Remove duplicate INSERT policy on waste_management_forms
  - Remove duplicate SELECT policies on waste_management_forms
  - Keep only one policy per action while maintaining all access patterns

  ### 3. Consolidate Multiple Permissive Policies
  - Note: Multiple permissive SELECT policies on employees and attendance_logs are intentional
  - They use OR logic (user can see own data OR admin can see all)
  - This is the correct pattern to avoid infinite recursion
  - These are not changed to maintain stability

  ## Security Notes
  - All changes maintain existing security posture
  - Performance improvements through proper indexing
  - Cleaner policy structure without duplicates
*/

-- ============================================
-- ADD MISSING FOREIGN KEY INDEXES
-- ============================================

-- Index for attendance_logs.site_id foreign key
CREATE INDEX IF NOT EXISTS idx_attendance_logs_site_id 
ON attendance_logs(site_id);

-- Index for waste_management_forms.employee_id foreign key
CREATE INDEX IF NOT EXISTS idx_waste_forms_employee_id 
ON waste_management_forms(employee_id);

-- ============================================
-- REMOVE DUPLICATE POLICIES
-- ============================================

-- Remove duplicate INSERT policies on waste_management_forms
-- Keep "Field workers can create forms" and drop "Field workers can insert forms"
DROP POLICY IF EXISTS "Field workers can insert forms" ON waste_management_forms;

-- Remove duplicate/outdated SELECT policies on waste_management_forms
-- Keep "Field workers can view own forms" and "Admins can view all waste forms"
-- Drop the generic "Employees can view own forms" which is redundant
DROP POLICY IF EXISTS "Employees can view own forms" ON waste_management_forms;

-- ============================================
-- NOTES ON REMAINING MULTIPLE PERMISSIVE POLICIES
-- ============================================

/*
  The following tables still have multiple permissive SELECT policies, but this is INTENTIONAL:
  
  1. employees table:
     - "Users can view their own employee record" (allows users to see themselves)
     - "Admin users can view all employees" (allows admins to see everyone)
     - These cannot be combined without causing infinite recursion
  
  2. attendance_logs table:
     - "Employees can view their own attendance logs" (allows users to see their logs)
     - "Admin users can view all attendance logs" (allows admins to see all logs)
     - These cannot be combined without causing infinite recursion
  
  This is the recommended pattern for avoiding RLS recursion while maintaining
  performance with the is_admin() helper function.
*/