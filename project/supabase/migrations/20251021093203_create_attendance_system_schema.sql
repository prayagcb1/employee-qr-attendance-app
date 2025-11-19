/*
  # Employee Attendance Tracking System

  ## Overview
  This migration creates the complete database schema for an attendance tracking system
  that uses QR codes for clock-in/clock-out at multiple site locations.

  ## 1. New Tables

  ### `sites`
  Stores information about different work site locations
  - `id` (uuid, primary key) - Unique identifier for each site
  - `name` (text) - Name of the work site
  - `address` (text) - Physical address of the site
  - `qr_code_data` (text) - Unique QR code identifier for the site
  - `latitude` (numeric, optional) - Site GPS latitude
  - `longitude` (numeric, optional) - Site GPS longitude
  - `active` (boolean) - Whether the site is currently active
  - `created_at` (timestamptz) - When the site was created
  - `updated_at` (timestamptz) - Last update timestamp

  ### `employees`
  Stores employee information
  - `id` (uuid, primary key) - Unique identifier for each employee
  - `user_id` (uuid, foreign key) - Links to auth.users
  - `employee_code` (text, unique) - Unique employee identifier
  - `full_name` (text) - Employee's full name
  - `email` (text, unique) - Employee's email address
  - `phone` (text, optional) - Contact phone number
  - `role` (text) - Employee role (field_worker, supervisor, admin)
  - `active` (boolean) - Whether the employee is currently active
  - `created_at` (timestamptz) - When the employee record was created
  - `updated_at` (timestamptz) - Last update timestamp

  ### `attendance_logs`
  Records all clock-in and clock-out events
  - `id` (uuid, primary key) - Unique identifier for each log entry
  - `employee_id` (uuid, foreign key) - References employees table
  - `site_id` (uuid, foreign key) - References sites table
  - `event_type` (text) - Type of event (clock_in or clock_out)
  - `timestamp` (timestamptz) - When the event occurred
  - `latitude` (numeric) - GPS latitude at time of scan
  - `longitude` (numeric) - GPS longitude at time of scan
  - `notes` (text, optional) - Optional notes for the log entry
  - `created_at` (timestamptz) - When the log was created

  ## 2. Security

  ### Row Level Security (RLS)
  - All tables have RLS enabled
  - Employees can view their own records and attendance logs
  - Employees can create their own attendance logs
  - Admin users can view and manage all records
  - Site information is readable by authenticated users

  ### Policies Created
  - Sites: Authenticated users can view all sites
  - Sites: Admin users can manage sites
  - Employees: Users can view their own employee record
  - Employees: Admin users can manage all employees
  - Attendance: Employees can view their own logs
  - Attendance: Employees can create their own logs
  - Attendance: Admin users can view all logs

  ## 3. Important Notes
  - QR codes contain unique site identifiers stored in `qr_code_data`
  - GPS coordinates are captured at time of clock-in/clock-out for verification
  - Employee roles enable role-based access control
  - All timestamps use timezone-aware format
*/

-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  qr_code_data text UNIQUE NOT NULL,
  latitude numeric,
  longitude numeric,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'field_worker' CHECK (role IN ('field_worker', 'supervisor', 'admin')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create attendance_logs table
CREATE TABLE IF NOT EXISTS attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('clock_in', 'clock_out')),
  timestamp timestamptz DEFAULT now(),
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_id ON attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_site_id ON attendance_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_timestamp ON attendance_logs(timestamp);

-- Enable Row Level Security
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sites table
CREATE POLICY "Authenticated users can view active sites"
  ON sites FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admin users can insert sites"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

CREATE POLICY "Admin users can update sites"
  ON sites FOR UPDATE
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

CREATE POLICY "Admin users can delete sites"
  ON sites FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

-- RLS Policies for employees table
CREATE POLICY "Users can view their own employee record"
  ON employees FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin users can view all employees"
  ON employees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees AS emp
      WHERE emp.user_id = auth.uid()
      AND emp.role = 'admin'
      AND emp.active = true
    )
  );

CREATE POLICY "Admin users can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

CREATE POLICY "Admin users can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees AS emp
      WHERE emp.user_id = auth.uid()
      AND emp.role = 'admin'
      AND emp.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees AS emp
      WHERE emp.user_id = auth.uid()
      AND emp.role = 'admin'
      AND emp.active = true
    )
  );

-- RLS Policies for attendance_logs table
CREATE POLICY "Employees can view their own attendance logs"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_logs.employee_id
      AND employees.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin users can view all attendance logs"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
      AND employees.active = true
    )
  );

CREATE POLICY "Employees can create their own attendance logs"
  ON attendance_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance_logs.employee_id
      AND employees.user_id = auth.uid()
      AND employees.active = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();