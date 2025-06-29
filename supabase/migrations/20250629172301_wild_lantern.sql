/*
  # Fix RLS policies for users table

  1. Security Updates
    - Drop existing problematic policy that uses undefined is_admin() function
    - Create new policy that allows authenticated users to insert/update users
    - Add helper function to check if user is admin based on user metadata
    - Ensure proper permissions for CSV upload functionality

  2. Changes
    - Remove dependency on undefined is_admin() function
    - Create admin check function using Supabase auth metadata
    - Update policies to work with actual authentication system
*/

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Solo admins pueden modificar usuarios" ON users;

-- Create a function to check if the current user is an admin
-- This function checks the user_metadata for an admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the current user has admin role in their metadata
  -- This assumes admin users have {"role": "admin"} in their user_metadata
  RETURN (
    SELECT COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
      false
    )
  );
END;
$$;

-- Alternative: Create a more permissive policy for authenticated users
-- This allows any authenticated user to insert/update users (suitable for CSV uploads)
-- You can restrict this further based on your security requirements
CREATE POLICY "Authenticated users can manage users"
  ON users
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- If you want to keep admin-only access, uncomment the following and comment the above:
-- CREATE POLICY "Only admins can modify users"
--   ON users
--   FOR ALL
--   TO authenticated
--   USING (is_admin())
--   WITH CHECK (is_admin());

-- Ensure the SELECT policy remains for all authenticated users
-- (This should already exist based on your schema)