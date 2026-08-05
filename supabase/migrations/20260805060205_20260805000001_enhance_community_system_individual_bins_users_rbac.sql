/*
# Enhance Community Composting System: Individual Bins, Community Users, RBAC

## Summary
Extends the existing community composting system with:
1. Individual bin lifecycle management (auto-generated per batch, with status tracking)
2. Community user authentication (separate from employees)
3. Bin status and maintenance history tracking
4. Batch start/expected harvest dates

## Changes to Existing Tables

### bins (extended)
- community_id, batch_id, bin_number, notes, last_activity

### community_batches (extended)
- start_date, expected_harvest_date

## New Tables
- community_users: portal users for community members (separate from employees)
- bin_status_history: tracks every status change for every bin
- bin_maintenance_history: tracks maintenance events on individual bins

## Security
- RLS on all new tables
- Community users scoped to their assigned community
- Role-based: estate_manager (read), mc_member (read), caas_supervisor (read/write), account_manager (read/write)
*/

-- ============================================================
-- EXTEND bins TABLE
-- ============================================================
DO $$ BEGIN
  ALTER TABLE bins ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES communities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE bins ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES community_batches(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE bins ADD COLUMN IF NOT EXISTS bin_number integer;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE bins ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE bins ADD COLUMN IF NOT EXISTS last_activity timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- EXTEND community_batches TABLE
-- ============================================================
DO $$ BEGIN
  ALTER TABLE community_batches ADD COLUMN IF NOT EXISTS start_date date;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE community_batches ADD COLUMN IF NOT EXISTS expected_harvest_date date;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- COMMUNITY USERS (must exist before policies that reference it)
-- ============================================================
CREATE TABLE IF NOT EXISTS community_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  role_type text NOT NULL CHECK (role_type IN ('estate_manager', 'mc_member', 'caas_supervisor', 'account_manager')),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Community users read own profile" ON community_users;
CREATE POLICY "Community users read own profile"
  ON community_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins managers manage community users" ON community_users;
CREATE POLICY "Admins managers manage community users"
  ON community_users FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'manager')
        AND employees.active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'manager')
        AND employees.active = true)
  );

DROP POLICY IF EXISTS "Community users read same community" ON community_users;
CREATE POLICY "Community users read same community"
  ON community_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.active = true
        AND cu.community_id = community_users.community_id)
  );

DROP POLICY IF EXISTS "Community users update own profile" ON community_users;
CREATE POLICY "Community users update own profile"
  ON community_users FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- BIN STATUS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS bin_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_id uuid NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  changed_by_type text NOT NULL DEFAULT 'employee' CHECK (changed_by_type IN ('employee', 'community_user')),
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bin_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage bin status history" ON bin_status_history;
CREATE POLICY "Admins managers manage bin status history"
  ON bin_status_history FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'manager')
        AND employees.active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'manager')
        AND employees.active = true)
  );

DROP POLICY IF EXISTS "Employees insert bin status history" ON bin_status_history;
CREATE POLICY "Employees insert bin status history"
  ON bin_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.active = true)
  );

DROP POLICY IF EXISTS "Community users insert bin status history" ON bin_status_history;
CREATE POLICY "Community users insert bin status history"
  ON bin_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true)
  );

DROP POLICY IF EXISTS "Community users read bin status history" ON bin_status_history;
CREATE POLICY "Community users read bin status history"
  ON bin_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.active = true
        AND EXISTS (SELECT 1 FROM bins WHERE bins.id = bin_status_history.bin_id AND bins.community_id = cu.community_id))
  );

DROP POLICY IF EXISTS "Employees read bin status history" ON bin_status_history;
CREATE POLICY "Employees read bin status history"
  ON bin_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.active = true)
  );

-- ============================================================
-- BIN MAINTENANCE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS bin_maintenance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_id uuid NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  issue_type text NOT NULL CHECK (issue_type IN ('broken_handle', 'crack', 'lid_missing', 'wheel_broken', 'qr_missing', 'cleaning', 'other')),
  issue_description text NOT NULL DEFAULT '',
  resolution_description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  reported_by uuid,
  reported_by_type text NOT NULL DEFAULT 'employee' CHECK (reported_by_type IN ('employee', 'community_user')),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bin_maintenance_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage maintenance history" ON bin_maintenance_history;
CREATE POLICY "Admins managers manage maintenance history"
  ON bin_maintenance_history FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'manager')
        AND employees.active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'manager')
        AND employees.active = true)
  );

DROP POLICY IF EXISTS "Employees manage maintenance history" ON bin_maintenance_history;
CREATE POLICY "Employees manage maintenance history"
  ON bin_maintenance_history FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.active = true)
  );

DROP POLICY IF EXISTS "Community users manage maintenance history" ON bin_maintenance_history;
CREATE POLICY "Community users manage maintenance history"
  ON bin_maintenance_history FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.active = true
        AND cu.role_type IN ('caas_supervisor', 'account_manager')
        AND EXISTS (SELECT 1 FROM bins WHERE bins.id = bin_maintenance_history.bin_id AND bins.community_id = cu.community_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM community_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.active = true
        AND cu.role_type IN ('caas_supervisor', 'account_manager')
        AND EXISTS (SELECT 1 FROM bins WHERE bins.id = bin_maintenance_history.bin_id AND bins.community_id = cu.community_id))
  );

DROP POLICY IF EXISTS "Community users read maintenance history" ON bin_maintenance_history;
CREATE POLICY "Community users read maintenance history"
  ON bin_maintenance_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.active = true
        AND EXISTS (SELECT 1 FROM bins WHERE bins.id = bin_maintenance_history.bin_id AND bins.community_id = cu.community_id))
  );

-- ============================================================
-- ADD COMMUNITY USER POLICIES TO EXISTING TABLES
-- ============================================================

-- bins: community users read/update
DROP POLICY IF EXISTS "Community users read bins in their community" ON bins;
CREATE POLICY "Community users read bins in their community"
  ON bins FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.community_id = bins.community_id)
  );

DROP POLICY IF EXISTS "Community users update bins in their community" ON bins;
CREATE POLICY "Community users update bins in their community"
  ON bins FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.community_id = bins.community_id
        AND community_users.role_type IN ('caas_supervisor', 'account_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.community_id = bins.community_id
        AND community_users.role_type IN ('caas_supervisor', 'account_manager'))
  );

-- community_batches: community users read/update
DROP POLICY IF EXISTS "Community users read own community batches" ON community_batches;
CREATE POLICY "Community users read own community batches"
  ON community_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.community_id = community_batches.community_id)
  );

DROP POLICY IF EXISTS "Community users update own community batches" ON community_batches;
CREATE POLICY "Community users update own community batches"
  ON community_batches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.active = true
        AND cu.community_id = community_batches.community_id
        AND cu.role_type IN ('caas_supervisor', 'account_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM community_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.active = true
        AND cu.community_id = community_batches.community_id
        AND cu.role_type IN ('caas_supervisor', 'account_manager'))
  );

-- daily_wet_waste_entries: community users read
DROP POLICY IF EXISTS "Community users read daily wet waste" ON daily_wet_waste_entries;
CREATE POLICY "Community users read daily wet waste"
  ON daily_wet_waste_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.community_id = daily_wet_waste_entries.community_id)
  );

-- cocopeat_usage_entries: community users read
DROP POLICY IF EXISTS "Community users read cocopeat usage" ON cocopeat_usage_entries;
CREATE POLICY "Community users read cocopeat usage"
  ON cocopeat_usage_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.community_id = cocopeat_usage_entries.community_id)
  );

-- inventory_transactions: community users read/insert
DROP POLICY IF EXISTS "Community users read inventory transactions" ON inventory_transactions;
CREATE POLICY "Community users read inventory transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND (community_users.community_id = inventory_transactions.community_id OR inventory_transactions.community_id IS NULL))
  );

DROP POLICY IF EXISTS "Community users insert inventory transactions" ON inventory_transactions;
CREATE POLICY "Community users insert inventory transactions"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.role_type IN ('caas_supervisor', 'account_manager')
        AND (community_users.community_id = inventory_transactions.community_id OR inventory_transactions.community_id IS NULL))
  );

-- inventory_orders: community users read/insert/update
DROP POLICY IF EXISTS "Community users read inventory orders" ON inventory_orders;
CREATE POLICY "Community users read inventory orders"
  ON inventory_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND (community_users.community_id = inventory_orders.community_id OR inventory_orders.community_id IS NULL))
  );

DROP POLICY IF EXISTS "Community users insert inventory orders" ON inventory_orders;
CREATE POLICY "Community users insert inventory orders"
  ON inventory_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.role_type IN ('caas_supervisor', 'account_manager')
        AND (community_users.community_id = inventory_orders.community_id OR inventory_orders.community_id IS NULL))
  );

DROP POLICY IF EXISTS "Community users update inventory orders" ON inventory_orders;
CREATE POLICY "Community users update inventory orders"
  ON inventory_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.role_type IN ('caas_supervisor', 'account_manager')
        AND (community_users.community_id = inventory_orders.community_id OR inventory_orders.community_id IS NULL))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.role_type IN ('caas_supervisor', 'account_manager')
        AND (community_users.community_id = inventory_orders.community_id OR inventory_orders.community_id IS NULL))
  );

-- batch_bin_assignments: community users read/manage
DROP POLICY IF EXISTS "Community users read batch bin assignments" ON batch_bin_assignments;
CREATE POLICY "Community users read batch bin assignments"
  ON batch_bin_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.active = true
        AND EXISTS (SELECT 1 FROM community_batches cb
          WHERE cb.id = batch_bin_assignments.batch_id
            AND cb.community_id = cu.community_id))
  );

DROP POLICY IF EXISTS "Community users manage batch bin assignments" ON batch_bin_assignments;
CREATE POLICY "Community users manage batch bin assignments"
  ON batch_bin_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.active = true
        AND cu.role_type IN ('caas_supervisor', 'account_manager')
        AND EXISTS (SELECT 1 FROM community_batches cb
          WHERE cb.id = batch_bin_assignments.batch_id
            AND cb.community_id = cu.community_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM community_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.active = true
        AND cu.role_type IN ('caas_supervisor', 'account_manager')
        AND EXISTS (SELECT 1 FROM community_batches cb
          WHERE cb.id = batch_bin_assignments.batch_id
            AND cb.community_id = cu.community_id))
  );

-- communities: community users read their own community
DROP POLICY IF EXISTS "Community users read own community" ON communities;
CREATE POLICY "Community users read own community"
  ON communities FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.community_id = communities.id)
  );

-- composters: community users read (already has "All staff read composters" but that's TO authenticated)
-- inventory_items: already has "All staff read inventory items" TO authenticated
-- community_key_people: community users read
DROP POLICY IF EXISTS "Community users read key people" ON community_key_people;
CREATE POLICY "Community users read key people"
  ON community_key_people FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM community_users
      WHERE community_users.user_id = auth.uid()
        AND community_users.active = true
        AND community_users.community_id = community_key_people.community_id)
  );

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bins_community ON bins(community_id);
CREATE INDEX IF NOT EXISTS idx_bins_batch ON bins(batch_id);
CREATE INDEX IF NOT EXISTS idx_bins_status ON bins(bin_status);
CREATE INDEX IF NOT EXISTS idx_community_users_user ON community_users(user_id);
CREATE INDEX IF NOT EXISTS idx_community_users_community ON community_users(community_id);
CREATE INDEX IF NOT EXISTS idx_bin_status_history_bin ON bin_status_history(bin_id);
CREATE INDEX IF NOT EXISTS idx_bin_maintenance_history_bin ON bin_maintenance_history(bin_id);
CREATE INDEX IF NOT EXISTS idx_bin_maintenance_history_status ON bin_maintenance_history(status);
