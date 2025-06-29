/*
  # Sistema de Gestión de Impresoras

  1. Nueva Tabla: printers
    - `id` (uuid, primary key)
    - `name` (text) - Nombre de la impresora
    - `ip_address` (text) - Dirección IP
    - `model` (text) - Modelo de la impresora
    - `office` (text) - Oficina donde está ubicada
    - `status` (text) - Estado (Active, Inactive, Maintenance)
    - `location_details` (text) - Detalles de ubicación específica
    - `created_at` (timestamp)
    - `updated_at` (timestamp)

  2. Nueva Tabla: user_printer_assignments
    - Relación muchos a muchos entre usuarios e impresoras
    - Un usuario puede usar múltiples impresoras
    - Una impresora puede ser usada por múltiples usuarios

  3. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas para usuarios autenticados

  4. Funciones RPC
    - Consultas optimizadas para impresoras por oficina
    - Asignaciones de usuarios a impresoras
*/

-- Tabla de impresoras
CREATE TABLE IF NOT EXISTS printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ip_address text UNIQUE NOT NULL,
  model text NOT NULL,
  office text,
  status text DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Maintenance')),
  location_details text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de asignaciones usuario-impresora
CREATE TABLE IF NOT EXISTS user_printer_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  printer_id uuid NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  is_primary boolean DEFAULT false,
  notes text,
  UNIQUE(user_id, printer_id)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_printers_office ON printers(office);
CREATE INDEX IF NOT EXISTS idx_printers_status ON printers(status);
CREATE INDEX IF NOT EXISTS idx_printers_ip ON printers(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_printer_user ON user_printer_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_printer_printer ON user_printer_assignments(printer_id);

-- Habilitar RLS
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_printer_assignments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para printers
CREATE POLICY "Los usuarios pueden ver todas las impresoras"
  ON printers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Los usuarios autenticados pueden gestionar impresoras"
  ON printers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para user_printer_assignments
CREATE POLICY "Los usuarios pueden ver todas las asignaciones"
  ON user_printer_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Los usuarios autenticados pueden gestionar asignaciones"
  ON user_printer_assignments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at en printers
CREATE TRIGGER update_printers_updated_at 
  BEFORE UPDATE ON printers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función RPC: Impresoras por oficina
CREATE OR REPLACE FUNCTION printers_by_office(target_office text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  ip_address text,
  model text,
  office text,
  status text,
  location_details text,
  user_count bigint,
  created_at timestamptz
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

-- Función RPC: Usuarios asignados a una impresora
CREATE OR REPLACE FUNCTION users_by_printer(target_printer_id uuid)
RETURNS TABLE (
  user_id text,
  full_name text,
  email text,
  office text,
  department text,
  is_primary boolean,
  assigned_at timestamptz,
  notes text
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

-- Función RPC: Impresoras asignadas a un usuario
CREATE OR REPLACE FUNCTION printers_by_user(target_user_id text)
RETURNS TABLE (
  printer_id uuid,
  printer_name text,
  ip_address text,
  model text,
  office text,
  status text,
  is_primary boolean,
  assigned_at timestamptz
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

-- Insertar impresoras de ejemplo
INSERT INTO printers (name, ip_address, model, office, status, location_details) VALUES
  ('Impresora Principal Oficina Central', '192.168.1.100', 'HP LaserJet Pro M404dn', 'Oficina Central', 'Active', 'Primer piso, área de administración'),
  ('Impresora Color Oficina Central', '192.168.1.101', 'Canon imageCLASS MF644Cdw', 'Oficina Central', 'Active', 'Segundo piso, área de diseño'),
  ('Impresora Sucursal Norte', '192.168.2.100', 'Brother HL-L2350DW', 'Sucursal Norte', 'Active', 'Recepción principal'),
  ('Impresora Ventas Norte', '192.168.2.101', 'Epson WorkForce Pro WF-3720', 'Sucursal Norte', 'Active', 'Área de ventas'),
  ('Impresora Sucursal Sur', '192.168.3.100', 'HP OfficeJet Pro 9015e', 'Sucursal Sur', 'Active', 'Oficina gerencial'),
  ('Impresora Backup Central', '192.168.1.102', 'Samsung Xpress M2020W', 'Oficina Central', 'Inactive', 'Almacén, para emergencias')
ON CONFLICT (ip_address) DO NOTHING;

-- Asignar impresoras a usuarios demo
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