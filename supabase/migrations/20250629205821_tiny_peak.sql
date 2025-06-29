/*
  # Fix total_by_user function parameter handling
  
  This migration fixes the total_by_user function to properly handle optional parameters
  by using a jsonb parameter instead of a TEXT parameter with default value.
  
  Changes:
  - Drop and recreate total_by_user function with jsonb parameter
  - Update GRANT statement to match new signature
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS total_by_user(TEXT);

-- Recreate the function with jsonb parameter
CREATE OR REPLACE FUNCTION total_by_user(params jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE (
  user_id TEXT,
  full_name TEXT,
  total_prints BIGINT,
  total_copies BIGINT,
  total_scans BIGINT,
  total_fax BIGINT,
  last_activity TIMESTAMPTZ
) AS $$
DECLARE
  target_user_id TEXT := params->>'target_user_id';
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

-- Grant execute permission for the updated function
GRANT EXECUTE ON FUNCTION total_by_user(jsonb) TO authenticated;