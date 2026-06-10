-- Allow admins and managers to insert waste entries (needed for Excel import of historic data)

CREATE POLICY "Admins and managers insert loading entries"
  ON waste_loading_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'manager')
        AND employees.active = true
    )
  );

CREATE POLICY "Admins and managers insert harvest entries"
  ON waste_harvest_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'manager')
        AND employees.active = true
    )
  );

CREATE POLICY "Admins and managers insert maintenance entries"
  ON waste_maintenance_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'manager')
        AND employees.active = true
    )
  );

CREATE POLICY "Admins and managers insert consumables entries"
  ON waste_consumables_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'manager')
        AND employees.active = true
    )
  );

CREATE POLICY "Admins and managers insert waste management forms"
  ON waste_management_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'manager')
        AND employees.active = true
    )
  );
