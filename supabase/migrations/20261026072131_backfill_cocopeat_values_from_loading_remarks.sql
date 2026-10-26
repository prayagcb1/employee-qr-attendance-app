/*
# Separate legacy cocopeat values from loading remarks

1. Data correction
- Recover cocopeat quantities from legacy `waste_loading_entries.remarks` values that begin with `Cocopeat added: <number> kg`.
- Store the extracted quantity in the existing dedicated `cocopeat_kg` column.
- Remove only the generated cocopeat prefix from `remarks`.
- Preserve any remaining text after the quantity as the original remark.

2. Safety rules
- Update only rows where `cocopeat_kg` is currently NULL.
- Update only rows matching the complete, reliable legacy format.
- Leave rows with existing dedicated cocopeat values unchanged.
- Leave unrelated remarks unchanged.
- No records, columns, tables, permissions, or policies are deleted or recreated.

3. Result
- Cocopeat and remarks are independent for recovered historical loading entries.
- New form submissions already write `cocopeat_kg` and `remarks` as separate fields.
*/

UPDATE public.waste_loading_entries AS entries
SET
  cocopeat_kg = parsed.parts[1]::numeric,
  remarks = btrim(coalesce(parsed.parts[3], ''))
FROM (
  SELECT
    id,
    regexp_match(
      remarks,
      '^Cocopeat added:[[:space:]]*([0-9]+[.][0-9]+|[0-9]+)[[:space:]]*kg([[:space:]]*(.*))?$'
    ) AS parts
  FROM public.waste_loading_entries
  WHERE cocopeat_kg IS NULL
) AS parsed
WHERE entries.id = parsed.id
  AND parsed.parts IS NOT NULL;
