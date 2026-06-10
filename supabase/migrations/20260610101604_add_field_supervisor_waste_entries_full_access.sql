-- Allow field supervisors to see ALL waste entries (loading, harvest, maintenance)
-- so they can view site-level reports from all field workers

CREATE POLICY "Field supervisors view all loading entries"
  ON waste_loading_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role = 'field_supervisor'
        AND employees.active = true
    )
  );

CREATE POLICY "Field supervisors view all harvest entries"
  ON waste_harvest_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role = 'field_supervisor'
        AND employees.active = true
    )
  );

CREATE POLICY "Field supervisors view all maintenance entries"
  ON waste_maintenance_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role = 'field_supervisor'
        AND employees.active = true
    )
  );

CREATE POLICY "Field supervisors view all consumables entries"
  ON waste_consumables_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role = 'field_supervisor'
        AND employees.active = true
    )
  );
