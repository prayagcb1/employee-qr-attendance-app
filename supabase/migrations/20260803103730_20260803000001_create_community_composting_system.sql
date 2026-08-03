/*
# Create Community Composting System

## Summary
Adds a new community-centric composting management flow alongside the existing
waste management system. Communities are first-class entities with their own
bin configuration, composter selection, batch management, key people contacts,
daily wet waste monitoring, cocopeat usage tracking, and a full inventory
management system with ordering capability.

## New Tables

### composters
Master list of composter makes and models with capacities.
- make (text), model (text), capacity_liters (numeric)
- active flag so deprecated models can be hidden

### communities
Each community/society being managed. Holds wet waste bin configuration,
selected composter, and bins-per-batch setting.
- name, address
- wet_waste_bin_size_liters (bin size config)
- waste_density_kg_per_ltr (conversion factor, default 1.0)
- composter_id (FK to composters)
- bins_per_batch (how many bins form one batch)
- active flag

### community_key_people
Contact records for people associated with a community.
- community_id (FK)
- role_type: 'estate_manager' | 'mc_member' | 'caas_supervisor' | 'account_manager'
- name, phone, email
- Multiple MC members can exist per community

### community_batches
Batches within a community, each in a lifecycle stage.
- community_id (FK)
- batch_number (text label)
- status: 'loading' | 'harvesting' | 'maintenance' | 'completed'
- Color coding is derived from status in the frontend

### batch_bin_assignments
Which bins belong to which batch, with a selected flag for
loading/harvesting operations.
- batch_id (FK), bin_id (FK to bins)
- selected (boolean, default true)

### daily_wet_waste_entries
Daily record of wet waste bins received for composting.
- community_id, date, number_of_bins (numeric, supports fractions like 0.5, 1.25)
- employee_id, recorded_by, remarks

### cocopeat_usage_entries
Tracks cocopeat added to wet waste and to specific bins.
- community_id, date, bin_id (optional), quantity_kg
- employee_id, remarks

### inventory_items
Master list of trackable inventory items.
- name, unit, category, reorder_level
- Pre-seeded with: Cocopeat, Gloves, Apron, Uniform, Shoes, Mask, Fly Catcher, Fly Stickers

### inventory_transactions
Stock movements (in/out) per item per community.
- item_id, community_id, transaction_type ('in' | 'out'), quantity, balance_after
- employee_id, date, remarks

### inventory_orders
Orders placed by account managers/supervisors for inventory items.
- item_id, community_id, quantity_ordered, status, ordered_by, order_date, expected_date

## Security
- RLS enabled on all new tables
- Field workers and field supervisors can insert and read their own entries
- Managers and admins have full access to all records
- Uses the existing get_employee_role(auth.uid()) helper for role checks
*/

-- ============================================================
-- COMPOSTERS (master list)
-- ============================================================
CREATE TABLE IF NOT EXISTS composters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  model text NOT NULL,
  capacity_liters numeric NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (make, model)
);

ALTER TABLE composters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage composters" ON composters;
CREATE POLICY "Admins managers manage composters"
  ON composters FOR ALL
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

DROP POLICY IF EXISTS "All staff read composters" ON composters;
CREATE POLICY "All staff read composters"
  ON composters FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- COMMUNITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  wet_waste_bin_size_liters numeric NOT NULL DEFAULT 50,
  waste_density_kg_per_ltr numeric NOT NULL DEFAULT 1.0,
  composter_id uuid REFERENCES composters(id) ON DELETE SET NULL,
  bins_per_batch integer NOT NULL DEFAULT 4,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage communities" ON communities;
CREATE POLICY "Admins managers manage communities"
  ON communities FOR ALL
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

DROP POLICY IF EXISTS "All staff read communities" ON communities;
CREATE POLICY "All staff read communities"
  ON communities FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- COMMUNITY KEY PEOPLE
-- ============================================================
CREATE TABLE IF NOT EXISTS community_key_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  role_type text NOT NULL CHECK (role_type IN ('estate_manager', 'mc_member', 'caas_supervisor', 'account_manager')),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_key_people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage key people" ON community_key_people;
CREATE POLICY "Admins managers manage key people"
  ON community_key_people FOR ALL
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

DROP POLICY IF EXISTS "All staff read key people" ON community_key_people;
CREATE POLICY "All staff read key people"
  ON community_key_people FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- COMMUNITY BATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS community_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  batch_number text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'loading'
    CHECK (status IN ('loading', 'harvesting', 'maintenance', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage batches" ON community_batches;
CREATE POLICY "Admins managers manage batches"
  ON community_batches FOR ALL
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

DROP POLICY IF EXISTS "Supervisors workers manage own batches" ON community_batches;
CREATE POLICY "Supervisors workers manage own batches"
  ON community_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('field_supervisor', 'field_worker')
        AND employees.active = true)
  );

DROP POLICY IF EXISTS "Supervisors workers update own batches" ON community_batches;
CREATE POLICY "Supervisors workers update own batches"
  ON community_batches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('field_supervisor', 'field_worker')
        AND employees.active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('field_supervisor', 'field_worker')
        AND employees.active = true)
  );

DROP POLICY IF EXISTS "All staff read batches" ON community_batches;
CREATE POLICY "All staff read batches"
  ON community_batches FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- BATCH BIN ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_bin_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES community_batches(id) ON DELETE CASCADE,
  bin_id uuid NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  selected boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, bin_id)
);

ALTER TABLE batch_bin_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage batch bins" ON batch_bin_assignments;
CREATE POLICY "Admins managers manage batch bins"
  ON batch_bin_assignments FOR ALL
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

DROP POLICY IF EXISTS "Supervisors workers manage batch bins" ON batch_bin_assignments;
CREATE POLICY "Supervisors workers manage batch bins"
  ON batch_bin_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('field_supervisor', 'field_worker')
        AND employees.active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('field_supervisor', 'field_worker')
        AND employees.active = true)
  );

-- ============================================================
-- DAILY WET WASTE ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_wet_waste_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  number_of_bins numeric NOT NULL DEFAULT 0,
  employee_id uuid NOT NULL REFERENCES employees(id),
  recorded_by text NOT NULL DEFAULT '',
  remarks text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE daily_wet_waste_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage daily wet waste" ON daily_wet_waste_entries;
CREATE POLICY "Admins managers manage daily wet waste"
  ON daily_wet_waste_entries FOR ALL
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

DROP POLICY IF EXISTS "Supervisors workers insert own daily wet waste" ON daily_wet_waste_entries;
CREATE POLICY "Supervisors workers insert own daily wet waste"
  ON daily_wet_waste_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.id = daily_wet_waste_entries.employee_id
        AND employees.user_id = auth.uid()
        AND employees.active = true)
  );

DROP POLICY IF EXISTS "Supervisors workers read own daily wet waste" ON daily_wet_waste_entries;
CREATE POLICY "Supervisors workers read own daily wet waste"
  ON daily_wet_waste_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.id = daily_wet_waste_entries.employee_id
        AND employees.user_id = auth.uid())
  );

-- ============================================================
-- COCOPEAT USAGE ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS cocopeat_usage_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  bin_id uuid REFERENCES bins(id) ON DELETE SET NULL,
  bin_code text NOT NULL DEFAULT '',
  quantity_kg numeric NOT NULL DEFAULT 0,
  employee_id uuid NOT NULL REFERENCES employees(id),
  remarks text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cocopeat_usage_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage cocopeat usage" ON cocopeat_usage_entries;
CREATE POLICY "Admins managers manage cocopeat usage"
  ON cocopeat_usage_entries FOR ALL
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

DROP POLICY IF EXISTS "Supervisors workers insert own cocopeat usage" ON cocopeat_usage_entries;
CREATE POLICY "Supervisors workers insert own cocopeat usage"
  ON cocopeat_usage_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.id = cocopeat_usage_entries.employee_id
        AND employees.user_id = auth.uid()
        AND employees.active = true)
  );

DROP POLICY IF EXISTS "Supervisors workers read own cocopeat usage" ON cocopeat_usage_entries;
CREATE POLICY "Supervisors workers read own cocopeat usage"
  ON cocopeat_usage_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.id = cocopeat_usage_entries.employee_id
        AND employees.user_id = auth.uid())
  );

-- ============================================================
-- INVENTORY ITEMS (master list)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  unit text NOT NULL DEFAULT 'pcs',
  category text NOT NULL DEFAULT 'general',
  reorder_level numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage inventory items" ON inventory_items;
CREATE POLICY "Admins managers manage inventory items"
  ON inventory_items FOR ALL
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

DROP POLICY IF EXISTS "All staff read inventory items" ON inventory_items;
CREATE POLICY "All staff read inventory items"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- INVENTORY TRANSACTIONS (stock in/out)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  community_id uuid REFERENCES communities(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('in', 'out')),
  quantity numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL DEFAULT 0,
  employee_id uuid NOT NULL REFERENCES employees(id),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  remarks text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage inventory transactions" ON inventory_transactions;
CREATE POLICY "Admins managers manage inventory transactions"
  ON inventory_transactions FOR ALL
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

DROP POLICY IF EXISTS "Supervisors workers insert own inventory transactions" ON inventory_transactions;
CREATE POLICY "Supervisors workers insert own inventory transactions"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.id = inventory_transactions.employee_id
        AND employees.user_id = auth.uid()
        AND employees.active = true)
  );

DROP POLICY IF EXISTS "Supervisors workers read own inventory transactions" ON inventory_transactions;
CREATE POLICY "Supervisors workers read own inventory transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.id = inventory_transactions.employee_id
        AND employees.user_id = auth.uid())
  );

-- ============================================================
-- INVENTORY ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  community_id uuid REFERENCES communities(id) ON DELETE SET NULL,
  quantity_ordered numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'placed', 'received', 'cancelled')),
  ordered_by uuid NOT NULL REFERENCES employees(id),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  remarks text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventory_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins managers manage inventory orders" ON inventory_orders;
CREATE POLICY "Admins managers manage inventory orders"
  ON inventory_orders FOR ALL
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

DROP POLICY IF EXISTS "Supervisors insert own inventory orders" ON inventory_orders;
CREATE POLICY "Supervisors insert own inventory orders"
  ON inventory_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.id = inventory_orders.ordered_by
        AND employees.user_id = auth.uid()
        AND employees.active = true)
  );

DROP POLICY IF EXISTS "Supervisors workers read own inventory orders" ON inventory_orders;
CREATE POLICY "Supervisors workers read own inventory orders"
  ON inventory_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees
      WHERE employees.id = inventory_orders.ordered_by
        AND employees.user_id = auth.uid())
  );

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_communities_active ON communities(active);
CREATE INDEX IF NOT EXISTS idx_community_key_people_community ON community_key_people(community_id);
CREATE INDEX IF NOT EXISTS idx_community_batches_community ON community_batches(community_id);
CREATE INDEX IF NOT EXISTS idx_community_batches_status ON community_batches(status);
CREATE INDEX IF NOT EXISTS idx_batch_bin_assignments_batch ON batch_bin_assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_bin_assignments_bin ON batch_bin_assignments(bin_id);
CREATE INDEX IF NOT EXISTS idx_daily_wet_waste_community ON daily_wet_waste_entries(community_id);
CREATE INDEX IF NOT EXISTS idx_daily_wet_waste_date ON daily_wet_waste_entries(date);
CREATE INDEX IF NOT EXISTS idx_cocopeat_usage_community ON cocopeat_usage_entries(community_id);
CREATE INDEX IF NOT EXISTS idx_cocopeat_usage_date ON cocopeat_usage_entries(date);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_community ON inventory_transactions(community_id);
CREATE INDEX IF NOT EXISTS idx_inventory_orders_item ON inventory_orders(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_orders_status ON inventory_orders(status);

-- ============================================================
-- SEED INVENTORY ITEMS
-- ============================================================
INSERT INTO inventory_items (name, unit, category, reorder_level) VALUES
  ('Cocopeat', 'kg', 'consumable', 10),
  ('Gloves', 'pairs', 'ppe', 5),
  ('Apron', 'pcs', 'ppe', 3),
  ('Uniform', 'sets', 'ppe', 2),
  ('Shoes', 'pairs', 'ppe', 2),
  ('Mask', 'pcs', 'ppe', 10),
  ('Fly Catcher', 'pcs', 'pest_control', 3),
  ('Fly Stickers', 'pcs', 'pest_control', 5)
ON CONFLICT (name) DO NOTHING;
