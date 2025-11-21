/*
  # Add Performance Indexes

  ## Overview
  This migration adds database indexes to improve query performance
  for common operations like login, QR scanning, and attendance tracking.

  ## Performance Improvements
  1. Faster user lookups by email and user_id
  2. Faster site lookups by QR code data
  3. Faster attendance log queries by employee and site
  4. Better query performance for active employees and sites

  ## Indexes Created
  - employees(email) - For login email lookup
  - employees(user_id) - For session-based employee data fetching
  - sites(qr_code_data) - For QR code scanning
  - attendance_logs(employee_id, timestamp) - For attendance history
  - attendance_logs(site_id, timestamp) - For site-based reports
*/

-- Index for faster email lookups during authentication
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

-- Index for faster user_id lookups when fetching employee data after login
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

-- Index for faster QR code lookups when scanning
CREATE INDEX IF NOT EXISTS idx_sites_qr_code ON sites(qr_code_data);

-- Composite index for faster attendance queries by employee
CREATE INDEX IF NOT EXISTS idx_attendance_employee_time ON attendance_logs(employee_id, timestamp DESC);

-- Composite index for faster attendance queries by site
CREATE INDEX IF NOT EXISTS idx_attendance_site_time ON attendance_logs(site_id, timestamp DESC);

-- Index for active employees only (used in many queries)
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active) WHERE active = true;

-- Index for active sites only (used in many queries)
CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(active) WHERE active = true;
