/*
# Backfill missing bins for existing batches + auto-generate trigger

## 1. Update bin_status check constraint
The existing constraint only allows: empty, under_process, ready_for_harvest,
harvested, maintenance_required. The app uses the new lifecycle statuses:
available, loaded, composting, harvesting, maintenance, completed, blocked.
Update the constraint to allow both old and new values.

## 2. Backfill
Two existing batches have 0 bins. Insert bins based on community settings.

## 3. Trigger
Auto-generate bins whenever a new batch is inserted.
*/

-- ============================================================
-- 1. Update bin_status check constraint
-- ============================================================
ALTER TABLE bins DROP CONSTRAINT IF EXISTS bins_bin_status_check;
ALTER TABLE bins ADD CONSTRAINT bins_bin_status_check
  CHECK (bin_status = ANY (ARRAY[
    'empty', 'under_process', 'ready_for_harvest', 'harvested', 'maintenance_required',
    'available', 'loaded', 'composting', 'harvesting', 'maintenance', 'completed', 'blocked'
  ]));

-- ============================================================
-- 2. Backfill existing batches missing bins
-- ============================================================
INSERT INTO bins (bin_code, bin_type, bin_status, capacity_liters, current_weight_kg, community_id, batch_id, bin_number, site_id, qr_code_data, active)
SELECT
  cb.batch_number || ' - Bin ' || gs.n,
  'wet_waste',
  'available',
  c.wet_waste_bin_size_liters,
  0,
  cb.community_id,
  cb.id,
  gs.n,
  (SELECT id FROM sites LIMIT 1),
  '',
  true
FROM community_batches cb
JOIN communities c ON c.id = cb.community_id
CROSS JOIN generate_series(1, c.bins_per_batch) AS gs(n)
WHERE NOT EXISTS (SELECT 1 FROM bins b WHERE b.batch_id = cb.id)
ORDER BY cb.id, gs.n;

-- ============================================================
-- 3. Auto-generate bins on batch insert trigger
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
  SELECT c.bins_per_batch, c.wet_waste_bin_size_liters
  INTO v_bins_per_batch, v_bin_size
  FROM public.communities c
  WHERE c.id = NEW.community_id;

  IF v_bins_per_batch IS NULL OR v_bins_per_batch < 1 THEN
    RETURN NEW;
  END IF;

  SELECT s.id INTO v_site_id FROM public.sites s LIMIT 1;

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

DROP TRIGGER IF EXISTS trg_auto_generate_batch_bins ON community_batches;
CREATE TRIGGER trg_auto_generate_batch_bins
  AFTER INSERT ON community_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_batch_bins();
