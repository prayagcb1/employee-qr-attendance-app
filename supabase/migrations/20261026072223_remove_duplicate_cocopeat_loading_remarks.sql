/*
# Remove duplicate generated cocopeat remarks

1. Data correction
- Remove legacy remarks exactly matching `Cocopeat added: <number> kg` when the same quantity is already stored in `cocopeat_kg`.
- Keep the dedicated cocopeat quantity unchanged.

2. Safety rules
- Only exact generated strings are changed.
- The numeric value in the remark must equal the existing `cocopeat_kg` value.
- Remarks containing additional text are not changed by this cleanup.
- No unrelated remarks, records, columns, tables, permissions, or policies are deleted or recreated.
*/

UPDATE public.waste_loading_entries
SET remarks = ''
WHERE cocopeat_kg IS NOT NULL
  AND remarks ~ '^Cocopeat added:[[:space:]]*([0-9]+[.][0-9]+|[0-9]+)[[:space:]]*kg$'
  AND cocopeat_kg = (regexp_match(
    remarks,
    '^Cocopeat added:[[:space:]]*([0-9]+[.][0-9]+|[0-9]+)[[:space:]]*kg$'
  ))[1]::numeric;
