/*
# Allow submitters to clean up incomplete waste forms

1. Purpose
- Allow a field worker or field supervisor to remove the parent waste form created by their own submission when a child section fails.
- This supports the existing submission workflow's cleanup behavior and prevents incomplete parent records from remaining visible in Admin Waste Forms.

2. Modified Tables
- `waste_management_forms`
- No columns, data types, relationships, or historical rows are changed.

3. Security
- Adds one DELETE policy for authenticated active employees with the `field_worker` or `field_supervisor` role.
- The policy only permits deletion when the form's `employee_id` belongs to the authenticated employee.
- Admin and manager deletion policies remain unchanged.

4. Important Notes
- This does not allow submitters to delete another employee's form.
- Child records remain protected by the existing foreign-key cascade when the authorized parent cleanup succeeds.
*/

DROP POLICY IF EXISTS "submitters_delete_own_waste_forms" ON public.waste_management_forms;

CREATE POLICY "submitters_delete_own_waste_forms"
ON public.waste_management_forms
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.employees
    WHERE employees.id = waste_management_forms.employee_id
      AND employees.user_id = auth.uid()
      AND employees.active = true
      AND employees.role IN ('field_worker', 'field_supervisor')
  )
);