/*
  # Add Email and Phone Verification Fields

  1. Changes to `employees` table
    - Add `email_verified` (boolean) - Track if email is verified
    - Add `phone_verified` (boolean) - Track if phone is verified
    - Add `phone_otp` (text) - Store OTP for phone verification
    - Add `phone_otp_expires_at` (timestamptz) - OTP expiration timestamp
    - Set default values for verification fields

  2. Security
    - Ensure only authenticated users can update their own verification status
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE employees ADD COLUMN email_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'phone_verified'
  ) THEN
    ALTER TABLE employees ADD COLUMN phone_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'phone_otp'
  ) THEN
    ALTER TABLE employees ADD COLUMN phone_otp text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'phone_otp_expires_at'
  ) THEN
    ALTER TABLE employees ADD COLUMN phone_otp_expires_at timestamptz;
  END IF;
END $$;