/*
  # Complete Database Schema for Print Management System
  
  This file consolidates all migrations into a single script that can be run
  in the Supabase SQL Editor to set up the complete database schema.
  
  Run this script in your Supabase Dashboard > SQL Editor to create:
  - All tables (users, prints_raw, prints_monthly, import_log, printers, user_printer_assignments)
  - All functions (is_admin, dashboard_stats, total_by_user, etc.)
  - All RLS policies
  - Sample data for testing
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing objects if they exist (for clean setup)
DROP FUNCTION IF EXISTS dashboard_stats() CASCADE;
DROP FUNCTION IF EXISTS total_by_user(TEXT) CASCADE;
DROP FUNCTION IF EXISTS monthly_detail(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS printers_by_office(TEXT) CASCADE;
DROP FUNCTION IF EXISTS users_by_printer(UUID) CASCADE;
DROP FUNCTION IF EXISTS printers_by_user(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

DROP TABLE IF EXISTS user_printer_assignments CASCADE;
DROP TABLE IF EXISTS printers CASCADE;
DROP TABLE IF EXISTS import_log CASCADE;
DROP TABLE IF EXISTS prints_monthly CASCADE;
DROP TABLE IF EXISTS prints_raw CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Normal',
  email TEXT,
  full_name TEXT,
  office TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create prints_raw table
CREATE TABLE prints_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_timestamp TIMESTAMPTZ NOT NULL,
  
  -- Original CSV fields
  account_status TEXT,
  print_total INTEGER DEFAULT 0,
  print_color INTEGER DEFAULT 0,
  print_mono INTEGER DEFAULT 0,
  copy_total INTEGER DEFAULT 0,
  copy_color INTEGER DEFAULT 0,
  copy_mono INTEGER DEFAULT 0,
  scan_total INTEGER DEFAULT 0,
  fax_total INTEGER DEFAULT 0,
  
  -- Metadata
  import_batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create prints_monthly table
CREATE TABLE prints_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  
  -- Monthly totals
  print_total INTEGER DEFAULT 0,
  print_color INTEGER DEFAULT 0,
  print_mono INTEGER DEFAULT 0,
  copy_total INTEGER DEFAULT 0,
  copy_color INTEGER DEFAULT 0,
  copy_mono INTEGER DEFAULT 0,
  scan_total INTEGER DEFAULT 0,
  fax_total INTEGER DEFAULT 0,
  
  -- Differences vs previous month
  print_total_diff INTEGER DEFAULT 0,
  copy_total_diff INTEGER DEFAULT 0,
  scan_total_diff INTEGER DEFAULT 0,
  fax_total_diff INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, year, month)
);

-- Create import_log table
CREATE TABLE import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  imported_at TIMESTAMPTZ DEFAULT now(),
  rows_processed INTEGER DEFAULT 0,
  rows_success INTEGER DEFAULT 0,
  rows_failed INTEGER DEFAULT 0,
  error_details JSONB,
  imported_by UUID REFERENCES auth.users(id)
);

-- Create printers table
CREATE TABLE printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ip_address TEXT UNIQUE NOT NULL,
  model TEXT NOT NULL,
  office TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Maintenance')),
  location_details TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_printer_assignments table
CREATE TABLE user_printer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  UNIQUE(user_id, printer_id)
);

-- Create indexes for optimization
CREATE INDEX idx_prints_raw_user_timestamp ON prints_raw(user_id, report_timestamp);
CREATE INDEX idx_prints_monthly_user_date ON prints_monthly(user_id, year, month);
CREATE INDEX idx_import_log_batch ON import_log(batch_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_printers_office ON printers(office);
CREATE INDEX idx_printers_status ON printers(status);
CREATE INDEX idx_printers_ip ON printers(ip_address);
CREATE INDEX idx_user_printer_user ON user_printer_assignments(user_id);
CREATE INDEX idx_user_printer_printer ON user_printer_assignments(printer_id);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE prints_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE prints_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_printer_assignments ENABLE ROW LEVEL SECURITY;

-- Create utility functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies
CREATE POLICY "Users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage users"
  ON users FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view all raw data"
  ON prints_raw FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert raw data"
  ON prints_raw FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view monthly data"
  ON prints_monthly FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage monthly data"
  ON prints_monthly FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view import logs"
  ON import_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create logs"
  ON import_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view all printers"
  ON printers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage printers"
  ON printers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view all assignments"
  ON user_printer_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage assignments"
  ON user_printer_assignments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prints_monthly_updated_at 
  BEFORE UPDATE ON prints_monthly 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_printers_updated_at 
  BEFORE UPDATE ON printers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RPC functions
CREATE OR REPLACE FUNCTION dashboard_stats()
RETURNS TABLE (
  total_users BIGINT,
  active_users BIGINT,
  total_prints_month BIGINT,
  total_copies_month BIGINT,
  last_import TIMESTAMPTZ
) AS $$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM users)::BIGINT,
    (SELECT COUNT(DISTINCT user_id) FROM prints_monthly 
     WHERE year = current_year AND month = current_month)::BIGINT,
    (SELECT COALESCE(SUM(print_total), 0) FROM prints_monthly 
     WHERE year = current_year AND month = current_month)::BIGINT,
    (SELECT COALESCE(SUM(copy_total), 0) FROM prints_monthly 
     WHERE year = current_year AND month = current_month)::BIGINT,
    (SELECT MAX(imported_at) FROM import_log)::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION total_by_user(target_user_id TEXT DEFAULT NULL)
RETURNS TABLE (
  user_id TEXT,
  full_name TEXT,
  total_prints BIGINT,
  total_copies BIGINT,
  total_scans BIGINT,
  total_fax BIGINT,
  last_activity TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    COALESCE(SUM(pm.print_total), 0)::BIGINT as total_prints,
    COALESCE(SUM(pm.copy_total), 0)::BIGINT as total_copies,
    COALESCE(SUM(pm.scan_total), 0)::BIGINT as total_scans,
    COALESCE(SUM(pm.fax_total), 0)::BIGINT as total_fax,
    MAX(pr.report_timestamp) as last_activity
  FROM users u
  LEFT JOIN prints_monthly pm ON u.id = pm.user_id
  LEFT JOIN prints_raw pr ON u.id = pr.user_id
  WHERE (target_user_id IS NULL OR u.id = target_user_id)
  GROUP BY u.id, u.full_name
  ORDER BY total_prints DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION monthly_detail(
  target_user_id TEXT,
  target_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  month INTEGER,
  month_name TEXT,
  print_total INTEGER,
  print_color INTEGER,
  print_mono INTEGER,
  copy_total INTEGER,
  scan_total INTEGER,
  fax_total INTEGER,
  print_diff INTEGER,
  copy_diff INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.month,
    CASE pm.month
      WHEN 1 THEN 'Enero'
      WHEN 2 THEN 'Febrero'
      WHEN 3 THEN 'Marzo'
      WHEN 4 THEN 'Abril'
      WHEN 5 THEN 'Mayo'
      WHEN 6 THEN 'Junio'
      WHEN 7 THEN 'Julio'
      WHEN 8 THEN 'Agosto'
      WHEN 9 THEN 'Septiembre'
      WHEN 10 THEN 'Octubre'
      WHEN 11 THEN 'Noviembre'
      WHEN 12 THEN 'Diciembre'
    END as month_name,
    pm.print_total,
    pm.print_color,
    pm.print_mono,
    pm.copy_total,
    pm.scan_total,
    pm.fax_total,
    pm.print_total_diff,
    pm.copy_total_diff
  FROM prints_monthly pm
  WHERE pm.user_id = target_user_id 
    AND pm.year = target_year
  ORDER BY pm.month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION printers_by_office(target_office TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  ip_address TEXT,
  model TEXT,
  office TEXT,
  status TEXT,
  location_details TEXT,
  user_count BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.ip_address,
    p.model,
    p.office,
    p.status,
    p.location_details,
    COUNT(upa.user_id) as user_count,
    p.created_at
  FROM printers p
  LEFT JOIN user_printer_assignments upa ON p.id = upa.printer_id
  WHERE (target_office IS NULL OR p.office = target_office)
  GROUP BY p.id, p.name, p.ip_address, p.model, p.office, p.status, p.location_details, p.created_at
  ORDER BY p.office, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION users_by_printer(target_printer_id UUID)
RETURNS TABLE (
  user_id TEXT,
  full_name TEXT,
  email TEXT,
  office TEXT,
  department TEXT,
  is_primary BOOLEAN,
  assigned_at TIMESTAMPTZ,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    u.email,
    u.office,
    u.department,
    upa.is_primary,
    upa.assigned_at,
    upa.notes
  FROM users u
  INNER JOIN user_printer_assignments upa ON u.id = upa.user_id
  WHERE upa.printer_id = target_printer_id
  ORDER BY upa.is_primary DESC, u.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION printers_by_user(target_user_id TEXT)
RETURNS TABLE (
  printer_id UUID,
  printer_name TEXT,
  ip_address TEXT,
  model TEXT,
  office TEXT,
  status TEXT,
  is_primary BOOLEAN,
  assigned_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.ip_address,
    p.model,
    p.office,
    p.status,
    upa.is_primary,
    upa.assigned_at
  FROM printers p
  INNER JOIN user_printer_assignments upa ON p.id = upa.printer_id
  WHERE upa.user_id = target_user_id
  ORDER BY upa.is_primary DESC, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample data
INSERT INTO users (id, email, full_name, office, department, status) VALUES
  ('demo-admin-001', 'admin@demo.com', 'Admin Demo', 'Oficina Principal', 'Administración', 'Normal'),
  ('demo-user-001', 'user@demo.com', 'Usuario Demo', 'Sucursal A', 'Operaciones', 'Normal'),
  ('demo-user-002', 'user2@demo.com', 'Usuario Demo 2', 'Sucursal B', 'Ventas', 'Normal')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  office = EXCLUDED.office,
  department = EXCLUDED.department,
  updated_at = now();

INSERT INTO prints_raw (user_id, report_timestamp, account_status, print_total, print_color, print_mono, copy_total, copy_color, copy_mono, scan_total, fax_total) VALUES
  ('demo-admin-001', '2024-12-01 09:00:00+00', 'Normal', 250, 100, 150, 120, 50, 70, 80, 15),
  ('demo-admin-001', '2024-11-01 09:00:00+00', 'Normal', 200, 80, 120, 100, 40, 60, 60, 10),
  ('demo-user-001', '2024-12-01 09:00:00+00', 'Normal', 150, 60, 90, 80, 30, 50, 40, 8),
  ('demo-user-001', '2024-11-01 09:00:00+00', 'Normal', 120, 45, 75, 60, 25, 35, 30, 5),
  ('demo-user-002', '2024-12-01 09:00:00+00', 'Normal', 180, 70, 110, 90, 35, 55, 50, 12),
  ('demo-user-002', '2024-11-01 09:00:00+00', 'Normal', 160, 55, 105, 75, 30, 45, 45, 8)
ON CONFLICT DO NOTHING;

INSERT INTO prints_monthly (user_id, year, month, print_total, print_color, print_mono, copy_total, copy_color, copy_mono, scan_total, fax_total, print_total_diff, copy_total_diff, scan_total_diff, fax_total_diff) VALUES
  ('demo-admin-001', 2024, 12, 250, 100, 150, 120, 50, 70, 80, 15, 50, 20, 20, 5),
  ('demo-admin-001', 2024, 11, 200, 80, 120, 100, 40, 60, 60, 10, 200, 100, 60, 10),
  ('demo-user-001', 2024, 12, 150, 60, 90, 80, 30, 50, 40, 8, 30, 20, 10, 3),
  ('demo-user-001', 2024, 11, 120, 45, 75, 60, 25, 35, 30, 5, 120, 60, 30, 5),
  ('demo-user-002', 2024, 12, 180, 70, 110, 90, 35, 55, 50, 12, 20, 15, 5, 4),
  ('demo-user-002', 2024, 11, 160, 55, 105, 75, 30, 45, 45, 8, 160, 75, 45, 8)
ON CONFLICT (user_id, year, month) DO UPDATE SET
  print_total = EXCLUDED.print_total,
  print_color = EXCLUDED.print_color,
  print_mono = EXCLUDED.print_mono,
  copy_total = EXCLUDED.copy_total,
  copy_color = EXCLUDED.copy_color,
  copy_mono = EXCLUDED.copy_mono,
  scan_total = EXCLUDED.scan_total,
  fax_total = EXCLUDED.fax_total,
  print_total_diff = EXCLUDED.print_total_diff,
  copy_total_diff = EXCLUDED.copy_total_diff,
  scan_total_diff = EXCLUDED.scan_total_diff,
  fax_total_diff = EXCLUDED.fax_total_diff,
  updated_at = now();

INSERT INTO printers (name, ip_address, model, office, status, location_details) VALUES
  ('Impresora Principal Oficina Central', '192.168.1.100', 'HP LaserJet Pro M404dn', 'Oficina Central', 'Active', 'Primer piso, área de administración'),
  ('Impresora Color Oficina Central', '192.168.1.101', 'Canon imageCLASS MF644Cdw', 'Oficina Central', 'Active', 'Segundo piso, área de diseño'),
  ('Impresora Sucursal Norte', '192.168.2.100', 'Brother HL-L2350DW', 'Sucursal Norte', 'Active', 'Recepción principal'),
  ('Impresora Ventas Norte', '192.168.2.101', 'Epson WorkForce Pro WF-3720', 'Sucursal Norte', 'Active', 'Área de ventas'),
  ('Impresora Sucursal Sur', '192.168.3.100', 'HP OfficeJet Pro 9015e', 'Sucursal Sur', 'Active', 'Oficina gerencial'),
  ('Impresora Backup Central', '192.168.1.102', 'Samsung Xpress M2020W', 'Oficina Central', 'Inactive', 'Almacén, para emergencias')
ON CONFLICT (ip_address) DO NOTHING;

INSERT INTO user_printer_assignments (user_id, printer_id, is_primary, notes) 
SELECT 
  'demo-admin-001',
  p.id,
  CASE WHEN p.name = 'Impresora Principal Oficina Central' THEN true ELSE false END,
  'Asignación automática por oficina'
FROM printers p 
WHERE p.office = 'Oficina Central'
ON CONFLICT (user_id, printer_id) DO NOTHING;

INSERT INTO user_printer_assignments (user_id, printer_id, is_primary, notes) 
SELECT 
  'demo-user-001',
  p.id,
  CASE WHEN p.name = 'Impresora Sucursal Norte' THEN true ELSE false END,
  'Asignación automática por oficina'
FROM printers p 
WHERE p.office = 'Sucursal Norte'
ON CONFLICT (user_id, printer_id) DO NOTHING;