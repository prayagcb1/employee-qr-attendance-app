/*
# Link communities to sites for valid bin generation

## Problem
The bins table requires site_id NOT NULL, but communities have no site link.
When generating bins for a community batch, there's no site_id to use,
causing a NOT NULL constraint violation.

## Fix
1. Add site_id column to communities (nullable FK to sites).
2. Backfill existing community with its known site (Stone Soup).
3. Update the auto_generate_batch_bins trigger to use the community's site_id.
4. Add a check constraint / trigger guard: prevent batch creation if community
   has no site_id.
*/

-- ============================================================
-- 1. Add site_id to communities
-- ============================================================
ALTER TABLE communities ADD COLUMN IF NOT EXISTS site_id uuid;
ALTER TABLE communities ADD CONSTRAINT communities_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES sites(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- ============================================================
-- 2. Backfill: set site_id for the existing community based on its bins
-- ============================================================
UPDATE communities c
SET site_id = (
  SELECT b.site_id
  FROM bins b
  WHERE b.community_id = c.id AND b.site_id IS NOT NULL
  LIMIT 1
)
WHERE c.site_id IS NULL
  AND EXISTS (SELECT 1 FROM bins b WHERE b.community_id = c.id AND b.site_id IS NOT NULL);

-- ============================================================
-- 3. Update the auto_generate_batch_bins trigger function
--    Use the community's site_id instead of a random site.
--    If the community has no site_id, raise an exception to prevent
--    batch creation (and thus bin generation with NULL site_id).
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_generate_batch_bins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bins_per_batch integer;
  v_bin_size numeric;
  v_site_id uuid;
BEGIN
  -- Get community settings including site_id
  SELECT c.bins_per_batch, c.wet_waste_bin_size_liters, c.site_id
  INTO v_bins_per_batch, v_bin_size, v_site_id
  FROM public.communities c
  WHERE c.id = NEW.community_id;

  -- If community has no site linked, prevent bin generation
  IF v_site_id IS NULL THEN
    RAISE EXCEPTION 'This community must be linked to a Site before batches can be created.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_bins_per_batch IS NULL OR v_bins_per_batch < 1 THEN
    RETURN NEW;
  END IF;

  -- Insert bins with the community's site_id
  INSERT INTO public.bins (bin_code, bin_type, bin_status, capacity_liters, current_weight_kg, community_id, batch_id, bin_number, site_id, qr_code_data, active)
  SELECT
    NEW.batch_number || ' - Bin ' || gs.n,
    'wet_waste',
    'available',
    COALESCE(v_bin_size, 50),
    0,
    NEW.community_id,
    NEW.id,
    gs.n,
    v_site_id,
    '',
    true
  FROM generate_series(1, v_bins_per_batch) AS gs(n);

  RETURN NEW;
END;
$$;

-- Trigger already exists from previous migration, but recreate to be safe
DROP TRIGGER IF EXISTS trg_auto_generate_batch_bins ON community_batches;
CREATE TRIGGER trg_auto_generate_batch_bins
  AFTER INSERT ON community_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_batch_bins();
