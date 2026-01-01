/*
  # Add Field Supervisor Attendance Permissions

  1. Changes
    - Add SELECT policy for field_supervisor role to view all attendance logs
    
  2. Security
    - Field supervisors can view all employee attendance records
    - Enables supervisory oversight of team attendance
*/

CREATE POLICY "field_supervisor_read_all_attendance"
  ON attendance_logs FOR SELECT TO authenticated
  USING ((SELECT get_employee_role(auth.uid())) = 'field_supervisor');