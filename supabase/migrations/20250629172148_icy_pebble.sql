/*
  # Add is_admin function for RLS policies

  1. New Functions
    - `is_admin()` - Checks if the current user has admin role
    - Uses auth.jwt() to check user metadata for admin role

  2. Security
    - Function is marked as SECURITY DEFINER to run with elevated privileges
    - Only checks the current authenticated user's metadata
*/

-- Create the is_admin function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has admin role in their metadata
  RETURN COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    false
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;