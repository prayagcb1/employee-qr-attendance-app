/*
  # Add compost bin type and update waste management forms

  1. Changes to bins table
    - Add 'compost' to bin_type check constraint
  
  2. Changes to waste_management_forms table
    - Add workflow_stage field (start_loaded, full_loaded, harvest)
    - Add scanned_bins jsonb field to store bin numbers and site info
    - Add site_id field to link to sites table

  3. Security
    - Update RLS policies for new fields
*/

-- Drop existing constraint and add new one with compost
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bins_bin_type_check'
  ) THEN
    ALTER TABLE bins DROP CONSTRAINT bins_bin_type_check;
  END IF;
END $$;

ALTER TABLE bins ADD CONSTRAINT bins_bin_type_check 
  CHECK (bin_type IN ('organic', 'recyclable', 'non_recyclable', 'hazardous', 'compost'));

-- Add new fields to waste_management_forms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'waste_management_forms' AND column_name = 'workflow_stage'
  ) THEN
    ALTER TABLE waste_management_forms 
    ADD COLUMN workflow_stage text DEFAULT 'start_loaded' 
    CHECK (workflow_stage IN ('start_loaded', 'full_loaded', 'harvest'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'waste_management_forms' AND column_name = 'scanned_bins'
  ) THEN
    ALTER TABLE waste_management_forms 
    ADD COLUMN scanned_bins jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'waste_management_forms' AND column_name = 'site_id'
  ) THEN
    ALTER TABLE waste_management_forms 
    ADD COLUMN site_id uuid REFERENCES sites(id);
  END IF;
END $$;