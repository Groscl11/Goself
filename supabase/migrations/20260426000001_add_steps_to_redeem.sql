-- Add steps_to_redeem column to rewards table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'steps_to_redeem'
  ) THEN
    ALTER TABLE rewards ADD COLUMN steps_to_redeem text;
  END IF;
END $$;
