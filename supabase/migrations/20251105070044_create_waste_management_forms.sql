/*
  # Create Waste Management Forms System

  1. New Tables
    - `waste_management_forms`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `community` (text)
      - `date` (date)
      - `recorded_by` (text)
      - `waste_segregated` (boolean)
      - `total_bins_50kg` (integer)
      - `issues_identified` (text array)
      - `composter_status` (jsonb) - stores C1-C10 status
      - `remarks` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `waste_management_forms` table
    - Add policy for field workers to create and view their own forms
    - Add policy for admins to view all forms
*/

CREATE TABLE IF NOT EXISTS waste_management_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) NOT NULL,
  community text NOT NULL,
  date date NOT NULL,
  recorded_by text NOT NULL,
  waste_segregated boolean NOT NULL,
  total_bins_50kg integer NOT NULL,
  issues_identified text[] DEFAULT '{}',
  composter_status jsonb DEFAULT '{}',
  remarks text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE waste_management_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Field workers can create forms"
  ON waste_management_forms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = employee_id
    AND EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'field_worker'
      AND employees.active = true
    )
  );

CREATE POLICY "Field workers can view own forms"
  ON waste_management_forms
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = employee_id
    AND EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'field_worker'
      AND employees.active = true
    )
  );

CREATE POLICY "Admins can view all forms"
  ON waste_management_forms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_waste_forms_employee ON waste_management_forms(employee_id);
CREATE INDEX IF NOT EXISTS idx_waste_forms_date ON waste_management_forms(date);
CREATE INDEX IF NOT EXISTS idx_waste_forms_community ON waste_management_forms(community);
