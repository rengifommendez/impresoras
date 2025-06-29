/*
  # Sistema de Gestión de Conteos de Impresión

  1. Nuevas Tablas
    - `users` - Usuarios del sistema con información de cuenta
    - `prints_raw` - Datos brutos de cada importación CSV
    - `prints_monthly` - Agregados mensuales por usuario optimizados para consultas
    - `import_log` - Registro de auditoría de importaciones

  2. Seguridad
    - Habilitar RLS en todas las tablas
    - Políticas para usuarios autenticados y administradores
    - Función de verificación de roles

  3. Funciones RPC
    - Consultas optimizadas para totales por usuario
    - Reportes mensuales y comparativos
    - Estadísticas agregadas
*/

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios del sistema
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- ID de la cuenta desde CSV
  status TEXT NOT NULL DEFAULT 'Normal',
  email TEXT,
  full_name TEXT,
  office TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de datos brutos de importación
CREATE TABLE IF NOT EXISTS prints_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_timestamp TIMESTAMPTZ NOT NULL,
  
  -- Campos originales del CSV
  account_status TEXT,
  print_total INTEGER DEFAULT 0,
  print_color INTEGER DEFAULT 0,
  print_mono INTEGER DEFAULT 0,
  copy_total INTEGER DEFAULT 0,
  copy_color INTEGER DEFAULT 0,
  copy_mono INTEGER DEFAULT 0,
  scan_total INTEGER DEFAULT 0,
  fax_total INTEGER DEFAULT 0,
  
  -- Metadatos
  import_batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de agregados mensuales
CREATE TABLE IF NOT EXISTS prints_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  
  -- Totales mensuales
  print_total INTEGER DEFAULT 0,
  print_color INTEGER DEFAULT 0,
  print_mono INTEGER DEFAULT 0,
  copy_total INTEGER DEFAULT 0,
  copy_color INTEGER DEFAULT 0,
  copy_mono INTEGER DEFAULT 0,
  scan_total INTEGER DEFAULT 0,
  fax_total INTEGER DEFAULT 0,
  
  -- Diferencias vs mes anterior
  print_total_diff INTEGER DEFAULT 0,
  copy_total_diff INTEGER DEFAULT 0,
  scan_total_diff INTEGER DEFAULT 0,
  fax_total_diff INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, year, month)
);

-- Tabla de log de importaciones
CREATE TABLE IF NOT EXISTS import_log (
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

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_prints_raw_user_timestamp ON prints_raw(user_id, report_timestamp);
CREATE INDEX IF NOT EXISTS idx_prints_monthly_user_date ON prints_monthly(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_import_log_batch ON import_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE prints_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE prints_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_log ENABLE ROW LEVEL SECURITY;

-- Función para verificar si el usuario es admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT raw_user_meta_data->>'role' = 'admin' 
     FROM auth.users 
     WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas RLS para users
CREATE POLICY "Los usuarios pueden ver todos los usuarios"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar usuarios"
  ON users FOR ALL
  TO authenticated
  USING (is_admin());

-- Políticas RLS para prints_raw
CREATE POLICY "Los usuarios pueden ver todos los datos raw"
  ON prints_raw FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden insertar datos raw"
  ON prints_raw FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Políticas RLS para prints_monthly
CREATE POLICY "Los usuarios pueden ver datos mensuales"
  ON prints_monthly FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar datos mensuales"
  ON prints_monthly FOR ALL
  TO authenticated
  USING (is_admin());

-- Políticas RLS para import_log
CREATE POLICY "Los usuarios pueden ver logs de importación"
  ON import_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear logs"
  ON import_log FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Función RPC: Total de impresiones por usuario
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

-- Función RPC: Detalle mensual por usuario
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

-- Función RPC: Estadísticas generales
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

-- Función para actualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prints_monthly_updated_at 
  BEFORE UPDATE ON prints_monthly 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();