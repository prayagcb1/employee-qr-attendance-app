/*
  # Remove Email and Phone Verification Fields

  1. Changes to `employees` table
    - Drop `email_verified` column
    - Drop `phone_verified` column
    - Drop `phone_otp` column
    - Drop `phone_otp_expires_at` column

  2. Notes
    - Safely removes verification fields if they exist
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE employees DROP COLUMN email_verified;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'phone_verified'
  ) THEN
    ALTER TABLE employees DROP COLUMN phone_verified;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'phone_otp'
  ) THEN
    ALTER TABLE employees DROP COLUMN phone_otp;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'phone_otp_expires_at'
  ) THEN
    ALTER TABLE employees DROP COLUMN phone_otp_expires_at;
  END IF;
END $$;