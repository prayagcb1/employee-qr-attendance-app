/*
  # Expand Waste Management System

  ## Summary
  Complete overhaul of the waste management data model to support detailed operations
  tracking for composting sites. Adds dedicated tables for loading entries, harvest
  entries, maintenance records, temperature checks, and consumables tracking.
  The existing waste_management_forms table is retained as the parent "session" record.

  ## New Tables

  ### waste_loading_entries
  Records each bin loaded during a collection session.
  - bin_id, bin_code, weight_loaded_kg, waste_type, loading_datetime, collector_name, remarks

  ### waste_harvest_entries
  Records each compost harvest from a bin.
  - bin_id, bin_code, compost_harvested_kg, harvest_date, compost_quality, moisture_level, remarks

  ### waste_maintenance_entries
  Records maintenance activities on bins.
  - bin_id, bin_code, maintenance_type, status, remarks, photo_url

  ### waste_temperature_entries
  Records temperature readings for bins.
  - bin_id, bin_code, temperature_celsius, auto_status (Normal/High/Low)

  ### waste_consumables_entries
  Tracks consumables usage per session.
  - item_name, opening_stock, used, remaining, date, session_id

  ## Modified Tables

  ### bins
  - Added bin_status column: 'empty' | 'under_process' | 'ready_for_harvest' | 'harvested' | 'maintenance_required'
  - Added capacity_liters column
  - Added current_weight_kg column

  ## Security
  - RLS enabled on all new tables
  - Field workers and field supervisors can insert and read their own entries
  - Managers and admins can read all entries
*/

-- Add bin_status and capacity to bins table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bins' AND column_name = 'bin_status'
  ) THEN
    ALTER TABLE bins ADD COLUMN bin_status text NOT NULL DEFAULT 'empty'
      CHECK (bin_status IN ('empty', 'under_process', 'ready_for_harvest', 'harvested', 'maintenance_required'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bins' AND column_name = 'capacity_liters'
  ) THEN
    ALTER TABLE bins ADD COLUMN capacity_liters numeric DEFAULT 50;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bins' AND column_name = 'current_weight_kg'
  ) THEN
    ALTER TABLE bins ADD COLUMN current_weight_kg numeric DEFAULT 0;
  END IF;
END $$;

-- Loading entries
CREATE TABLE IF NOT EXISTS waste_loading_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES waste_management_forms(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  site_id uuid REFERENCES sites(id),
  bin_id uuid REFERENCES bins(id),
  bin_code text NOT NULL DEFAULT '',
  weight_loaded_kg numeric NOT NULL DEFAULT 0,
  waste_type text NOT NULL DEFAULT 'wet_waste'
    CHECK (waste_type IN ('wet_waste', 'dry_waste', 'garden_waste', 'food_waste')),
  loading_datetime timestamptz NOT NULL DEFAULT now(),
  collector_name text NOT NULL DEFAULT '',
  remarks text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waste_loading_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Field workers insert own loading entries"
  ON waste_loading_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_id
        AND employees.user_id = auth.uid()
        AND employees.active = true
        AND employees.role IN ('field_worker', 'field_supervisor')
    )
  );

CREATE POLICY "Employees view own loading entries"
  ON waste_loading_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_id
        AND employees.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers and admins view all loading entries"
  ON waste_loading_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('manager', 'admin')
        AND employees.active = true
    )
  );

-- Harvest entries
CREATE TABLE IF NOT EXISTS waste_harvest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES waste_management_forms(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  site_id uuid REFERENCES sites(id),
  bin_id uuid REFERENCES bins(id),
  bin_code text NOT NULL DEFAULT '',
  compost_harvested_kg numeric NOT NULL DEFAULT 0,
  harvest_date date NOT NULL DEFAULT CURRENT_DATE,
  compost_quality text NOT NULL DEFAULT 'good'
    CHECK (compost_quality IN ('good', 'average', 'poor')),
  moisture_level text NOT NULL DEFAULT 'normal'
    CHECK (moisture_level IN ('low', 'normal', 'high')),
  remarks text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waste_harvest_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Field workers insert own harvest entries"
  ON waste_harvest_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_id
        AND employees.user_id = auth.uid()
        AND employees.active = true
        AND employees.role IN ('field_worker', 'field_supervisor')
    )
  );

CREATE POLICY "Employees view own harvest entries"
  ON waste_harvest_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_id
        AND employees.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers and admins view all harvest entries"
  ON waste_harvest_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('manager', 'admin')
        AND employees.active = true
    )
  );

-- Maintenance entries
CREATE TABLE IF NOT EXISTS waste_maintenance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES waste_management_forms(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  site_id uuid REFERENCES sites(id),
  bin_id uuid REFERENCES bins(id),
  bin_code text NOT NULL DEFAULT '',
  maintenance_type text NOT NULL DEFAULT 'cleaning'
    CHECK (maintenance_type IN ('cleaning', 'aeration', 'mixing', 'repair', 'temperature_check')),
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'pending')),
  remarks text NOT NULL DEFAULT '',
  photo_url text DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waste_maintenance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Field workers insert own maintenance entries"
  ON waste_maintenance_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_id
        AND employees.user_id = auth.uid()
        AND employees.active = true
        AND employees.role IN ('field_worker', 'field_supervisor')
    )
  );

CREATE POLICY "Employees view own maintenance entries"
  ON waste_maintenance_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_id
        AND employees.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers and admins view all maintenance entries"
  ON waste_maintenance_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('manager', 'admin')
        AND employees.active = true
    )
  );

-- Temperature entries
CREATE TABLE IF NOT EXISTS waste_temperature_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES waste_management_forms(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  site_id uuid REFERENCES sites(id),
  bin_id uuid REFERENCES bins(id),
  bin_code text NOT NULL DEFAULT '',
  temperature_celsius numeric NOT NULL DEFAULT 0,
  auto_status text NOT NULL DEFAULT 'normal'
    CHECK (auto_status IN ('normal', 'high', 'low')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waste_temperature_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Field workers insert own temperature entries"
  ON waste_temperature_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_id
        AND employees.user_id = auth.uid()
        AND employees.active = true
        AND employees.role IN ('field_worker', 'field_supervisor')
    )
  );

CREATE POLICY "Employees view own temperature entries"
  ON waste_temperature_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_id
        AND employees.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers and admins view all temperature entries"
  ON waste_temperature_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('manager', 'admin')
        AND employees.active = true
    )
  );

-- Consumables entries
CREATE TABLE IF NOT EXISTS waste_consumables_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES waste_management_forms(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  site_id uuid REFERENCES sites(id),
  item_name text NOT NULL DEFAULT '',
  opening_stock numeric NOT NULL DEFAULT 0,
  used numeric NOT NULL DEFAULT 0,
  remaining numeric GENERATED ALWAYS AS (opening_stock - used) STORED,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waste_consumables_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Field workers insert own consumables entries"
  ON waste_consumables_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_id
        AND employees.user_id = auth.uid()
        AND employees.active = true
        AND employees.role IN ('field_worker', 'field_supervisor')
    )
  );

CREATE POLICY "Employees view own consumables entries"
  ON waste_consumables_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_id
        AND employees.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers and admins view all consumables entries"
  ON waste_consumables_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('manager', 'admin')
        AND employees.active = true
    )
  );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_waste_loading_employee ON waste_loading_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_waste_loading_site ON waste_loading_entries(site_id);
CREATE INDEX IF NOT EXISTS idx_waste_loading_date ON waste_loading_entries(loading_datetime);
CREATE INDEX IF NOT EXISTS idx_waste_harvest_employee ON waste_harvest_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_waste_harvest_site ON waste_harvest_entries(site_id);
CREATE INDEX IF NOT EXISTS idx_waste_maintenance_employee ON waste_maintenance_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_waste_temperature_employee ON waste_temperature_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_waste_consumables_employee ON waste_consumables_entries(employee_id);
