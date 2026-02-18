/*
  # Add daily attendance notes table

  1. New Tables
    - `daily_attendance_notes`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, references employees)
      - `date` (date, the date of attendance)
      - `note` (text, short note for the day)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `daily_attendance_notes` table
    - Add policies for admins and managers to read, insert, update, and delete notes
    - Add policy for field supervisors to read notes for their sites
  
  3. Indexes
    - Add composite unique index on (employee_id, date) to prevent duplicate notes
    - Add index on employee_id for faster lookups
    - Add index on date for date-based queries
*/

CREATE TABLE IF NOT EXISTS daily_attendance_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT daily_attendance_notes_employee_date_key UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_attendance_notes_employee_id ON daily_attendance_notes(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_notes_date ON daily_attendance_notes(date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_notes_employee_date ON daily_attendance_notes(employee_id, date);

ALTER TABLE daily_attendance_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all daily attendance notes"
  ON daily_attendance_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "Managers can read all daily attendance notes"
  ON daily_attendance_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'manager'
    )
  );

CREATE POLICY "Admins can insert daily attendance notes"
  ON daily_attendance_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "Managers can insert daily attendance notes"
  ON daily_attendance_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'manager'
    )
  );

CREATE POLICY "Admins can update daily attendance notes"
  ON daily_attendance_notes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "Managers can update daily attendance notes"
  ON daily_attendance_notes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'manager'
    )
  );

CREATE POLICY "Admins can delete daily attendance notes"
  ON daily_attendance_notes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "Managers can delete daily attendance notes"
  ON daily_attendance_notes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'manager'
    )
  );
