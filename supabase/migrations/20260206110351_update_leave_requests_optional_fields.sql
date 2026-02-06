/*
  # Update Leave Requests - Make End Date and Reason Optional

  1. Changes
    - Make `end_date` optional (nullable)
    - Make `reason` optional (nullable)
    - Update constraint to handle null end_date

  2. Notes
    - When end_date is null, it means single day request (only start_date)
    - When reason is null, no reason was provided
*/

-- Drop the existing constraint
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS valid_date_range;

-- Make end_date nullable
ALTER TABLE leave_requests ALTER COLUMN end_date DROP NOT NULL;

-- Make reason nullable
ALTER TABLE leave_requests ALTER COLUMN reason DROP NOT NULL;

-- Add new constraint that handles null end_date
ALTER TABLE leave_requests ADD CONSTRAINT valid_date_range 
  CHECK (end_date IS NULL OR end_date >= start_date);
