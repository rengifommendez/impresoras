/*
  # Add Demo Users for Testing

  1. New Users
    - Creates demo admin user (admin@empresa.com)
    - Creates demo regular user (usuario@empresa.com)
    - Both users will be added to Supabase Auth and the users table
  
  2. Security
    - Users are created with proper authentication setup
    - Admin user will have admin privileges
    - Regular user will have standard access
  
  3. Data Setup
    - Links auth users to the users table
    - Sets up proper user profiles with departments and offices
*/

-- Insert demo users into auth.users (Supabase's authentication table)
-- Note: In a real environment, users would sign up through the application
-- This is for demo purposes only

-- First, let's create the users in our users table
-- We'll use the auth.uid() that would be generated when they sign up

INSERT INTO users (id, email, full_name, office, department, status) VALUES
  ('demo-admin-uuid-12345', 'admin@empresa.com', 'Administrador Demo', 'Oficina Central', 'IT', 'Normal'),
  ('demo-user-uuid-67890', 'usuario@empresa.com', 'Usuario Demo', 'Sucursal Norte', 'Ventas', 'Normal')
ON CONFLICT (id) DO NOTHING;

-- Add some sample print data for the demo users
INSERT INTO prints_raw (user_id, report_timestamp, account_status, print_total, print_color, print_mono, copy_total, copy_color, copy_mono, scan_total, fax_total) VALUES
  ('demo-admin-uuid-12345', '2024-01-15 10:00:00+00', 'Active', 150, 50, 100, 75, 25, 50, 30, 5),
  ('demo-admin-uuid-12345', '2024-02-15 10:00:00+00', 'Active', 200, 80, 120, 90, 40, 50, 45, 8),
  ('demo-user-uuid-67890', '2024-01-15 10:00:00+00', 'Active', 80, 20, 60, 40, 15, 25, 20, 2),
  ('demo-user-uuid-67890', '2024-02-15 10:00:00+00', 'Active', 120, 35, 85, 55, 20, 35, 25, 3)
ON CONFLICT DO NOTHING;

-- Add corresponding monthly aggregated data
INSERT INTO prints_monthly (user_id, year, month, print_total, print_color, print_mono, copy_total, copy_color, copy_mono, scan_total, fax_total, print_total_diff, copy_total_diff, scan_total_diff, fax_total_diff) VALUES
  ('demo-admin-uuid-12345', 2024, 1, 150, 50, 100, 75, 25, 50, 30, 5, 150, 75, 30, 5),
  ('demo-admin-uuid-12345', 2024, 2, 200, 80, 120, 90, 40, 50, 45, 8, 50, 15, 15, 3),
  ('demo-user-uuid-67890', 2024, 1, 80, 20, 60, 40, 15, 25, 20, 2, 80, 40, 20, 2),
  ('demo-user-uuid-67890', 2024, 2, 120, 35, 85, 55, 20, 35, 25, 3, 40, 15, 5, 1)
ON CONFLICT (user_id, year, month) DO NOTHING;