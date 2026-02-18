/*
  # Update Dismissed Notifications Tracking

  1. Changes
    - Add `dismissed_from` column to track where notification was dismissed (banner or dropdown)
    - Banner dismissals: notification won't show in banner but stays in dropdown for 3 days
    - Dropdown dismissals: notification disappears completely
    
  2. New Logic
    - dismissed_from = 'banner': Hide from banner only, show in dropdown until 3 days old
    - dismissed_from = 'dropdown': Hide from both banner and dropdown completely
*/

-- Add dismissed_from column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dismissed_notifications' AND column_name = 'dismissed_from'
  ) THEN
    ALTER TABLE dismissed_notifications ADD COLUMN dismissed_from text NOT NULL DEFAULT 'dropdown';
  END IF;
END $$;

-- Add check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'dismissed_notifications_dismissed_from_check'
  ) THEN
    ALTER TABLE dismissed_notifications 
    ADD CONSTRAINT dismissed_notifications_dismissed_from_check 
    CHECK (dismissed_from IN ('banner', 'dropdown'));
  END IF;
END $$;