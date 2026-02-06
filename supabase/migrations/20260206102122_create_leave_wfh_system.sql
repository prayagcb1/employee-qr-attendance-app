/*
  # Leave and WFH Request System

  1. New Tables
    - `leave_requests`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `request_type` (text, 'leave' or 'wfh')
      - `start_date` (date)
      - `end_date` (date)
      - `reason` (text)
      - `status` (text, 'pending', 'approved', 'rejected')
      - `requested_at` (timestamp)
      - `approved_by` (uuid, foreign key to employees, nullable)
      - `approved_at` (timestamp, nullable)
      - `rejection_reason` (text, nullable)
      
    - `wfh_attendance`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `date` (date)
      - `clock_in_time` (timestamp)
      - `clock_out_time` (timestamp, nullable)
      - `duration_minutes` (integer, nullable)
      - `status` (text, 'active', 'complete', 'incomplete')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      
    - `leave_attendance`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `date` (date)
      - `leave_request_id` (uuid, foreign key to leave_requests)
      - `marked_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Employees can create their own requests
    - Employees can view their own requests
    - Managers and Admins can view and approve requests
    - Employees can manage their own WFH attendance
    - Managers and Admins can view all WFH attendance

  3. Indexes
    - Index on employee_id for all tables
    - Index on date for wfh_attendance and leave_attendance
    - Index on status for leave_requests
*/

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('leave', 'wfh')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create wfh_attendance table
CREATE TABLE IF NOT EXISTS wfh_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  clock_in_time timestamptz NOT NULL,
  clock_out_time timestamptz,
  duration_minutes integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete', 'incomplete')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_wfh_per_day UNIQUE (employee_id, date)
);

-- Create leave_attendance table
CREATE TABLE IF NOT EXISTS leave_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  leave_request_id uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  marked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_leave_per_day UNIQUE (employee_id, date)
);

-- Enable RLS
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfh_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leave_requests
CREATE POLICY "Employees can create their own leave requests"
  ON leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Employees can view their own leave requests"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Managers and Admins can view all leave requests"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Managers and Admins can update leave requests"
  ON leave_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- RLS Policies for wfh_attendance
CREATE POLICY "Employees can create their own WFH attendance"
  ON wfh_attendance FOR INSERT
  TO authenticated
  WITH CHECK (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Employees can view their own WFH attendance"
  ON wfh_attendance FOR SELECT
  TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Employees can update their own WFH attendance"
  ON wfh_attendance FOR UPDATE
  TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ))
  WITH CHECK (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Managers and Admins can view all WFH attendance"
  ON wfh_attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- RLS Policies for leave_attendance
CREATE POLICY "Employees can view their own leave attendance"
  ON leave_attendance FOR SELECT
  TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Managers and Admins can view all leave attendance"
  ON leave_attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "System can insert leave attendance"
  ON leave_attendance FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_wfh_attendance_employee_id ON wfh_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_wfh_attendance_date ON wfh_attendance(date);
CREATE INDEX IF NOT EXISTS idx_leave_attendance_employee_id ON leave_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_attendance_date ON leave_attendance(date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON leave_requests;
CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wfh_attendance_updated_at ON wfh_attendance;
CREATE TRIGGER update_wfh_attendance_updated_at
  BEFORE UPDATE ON wfh_attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate WFH duration
CREATE OR REPLACE FUNCTION calculate_wfh_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out_time IS NOT NULL AND NEW.clock_in_time IS NOT NULL THEN
    NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 60;
    NEW.status = 'complete';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate duration
DROP TRIGGER IF EXISTS calculate_wfh_duration_trigger ON wfh_attendance;
CREATE TRIGGER calculate_wfh_duration_trigger
  BEFORE INSERT OR UPDATE ON wfh_attendance
  FOR EACH ROW
  EXECUTE FUNCTION calculate_wfh_duration();