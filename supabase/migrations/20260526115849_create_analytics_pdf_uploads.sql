/*
  # Analytics PDF Uploads

  ## Summary
  Adds support for uploading PDF reports linked to the waste management analytics view.

  ## New Tables
  - `analytics_pdf_uploads`
    - `id` (uuid, pk)
    - `employee_id` (uuid, FK → auth.users) — uploader
    - `site_id` (uuid, nullable FK → sites) — optional site association
    - `file_name` (text) — original filename shown in UI
    - `storage_path` (text) — path in the `analytics-reports` storage bucket
    - `file_size_bytes` (bigint)
    - `description` (text, nullable) — optional note about the PDF
    - `uploaded_at` (timestamptz)

  ## Storage
  - Creates the `analytics-reports` bucket (private, 20 MB file limit)
  - Storage policies allow authenticated users to upload and read their own files

  ## Security
  - RLS enabled; authenticated users can insert and read their own uploads
  - Managers and admins can read all uploads (checked via employees table role)
*/

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'analytics-reports',
  'analytics-reports',
  false,
  20971520,
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload analytics PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'analytics-reports');

CREATE POLICY "Users can read own analytics PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'analytics-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Managers and admins can read all analytics PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'analytics-reports' AND
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('manager', 'admin')
    )
  );

CREATE POLICY "Users can delete own analytics PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'analytics-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Metadata table
CREATE TABLE IF NOT EXISTS analytics_pdf_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  file_name text NOT NULL DEFAULT '',
  storage_path text NOT NULL DEFAULT '',
  file_size_bytes bigint NOT NULL DEFAULT 0,
  description text DEFAULT '',
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE analytics_pdf_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own PDF uploads"
  ON analytics_pdf_uploads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Users can view own PDF uploads"
  ON analytics_pdf_uploads FOR SELECT
  TO authenticated
  USING (auth.uid() = employee_id);

CREATE POLICY "Managers and admins can view all PDF uploads"
  ON analytics_pdf_uploads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('manager', 'admin')
    )
  );

CREATE POLICY "Users can delete own PDF uploads"
  ON analytics_pdf_uploads FOR DELETE
  TO authenticated
  USING (auth.uid() = employee_id);

CREATE INDEX IF NOT EXISTS idx_analytics_pdf_uploads_employee ON analytics_pdf_uploads(employee_id);
CREATE INDEX IF NOT EXISTS idx_analytics_pdf_uploads_site ON analytics_pdf_uploads(site_id);
