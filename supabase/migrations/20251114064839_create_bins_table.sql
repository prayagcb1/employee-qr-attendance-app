/*
  # Create bins table for waste management

  1. New Tables
    - `bins`
      - `id` (uuid, primary key)
      - `site_id` (uuid, foreign key to sites)
      - `bin_code` (text, unique identifier for the bin)
      - `bin_type` (text, type of waste: organic, recyclable, etc.)
      - `capacity_kg` (integer, capacity in kilograms)
      - `qr_code_data` (text, unique QR code data)
      - `location_details` (text, specific location within site)
      - `active` (boolean, whether bin is active)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `bins` table
    - Add policy for authenticated users to read bins
    - Add policy for admins to manage bins

  3. Indexes
    - Index on site_id for faster queries
    - Unique index on qr_code_data
*/

CREATE TABLE IF NOT EXISTS bins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  bin_code text NOT NULL,
  bin_type text NOT NULL CHECK (bin_type IN ('organic', 'recyclable', 'non_recyclable', 'hazardous')),
  capacity_kg integer NOT NULL DEFAULT 50,
  qr_code_data text NOT NULL UNIQUE,
  location_details text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bins ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bins_site_id ON bins(site_id);
CREATE INDEX IF NOT EXISTS idx_bins_qr_code ON bins(qr_code_data);

CREATE POLICY "Authenticated users can view bins"
  ON bins
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert bins"
  ON bins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

CREATE POLICY "Admins can update bins"
  ON bins
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
      AND employees.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

CREATE POLICY "Admins can delete bins"
  ON bins
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );