import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipos de datos
export interface User {
  id: string;
  status: string;
  email?: string;
  full_name?: string;
  office?: string;
  department?: string;
  created_at: string;
  updated_at: string;
}

export interface PrintsRaw {
  id: string;
  user_id: string;
  report_timestamp: string;
  account_status?: string;
  print_total: number;
  print_color: number;
  print_mono: number;
  copy_total: number;
  copy_color: number;
  copy_mono: number;
  scan_total: number;
  fax_total: number;
  import_batch_id?: string;
  created_at: string;
}

export interface PrintsMonthly {
  id: string;
  user_id: string;
  year: number;
  month: number;
  print_total: number;
  print_color: number;
  print_mono: number;
  copy_total: number;
  copy_color: number;
  copy_mono: number;
  scan_total: number;
  fax_total: number;
  print_total_diff: number;
  copy_total_diff: number;
  scan_total_diff: number;
  fax_total_diff: number;
  created_at: string;
  updated_at: string;
}

export interface ImportLog {
  id: string;
  file_name: string;
  batch_id: string;
  imported_at: string;
  rows_processed: number;
  rows_success: number;
  rows_failed: number;
  error_details?: any;
  imported_by?: string;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  total_prints_month: number;
  total_copies_month: number;
  last_import: string | null;
}

export interface UserTotal {
  user_id: string;
  full_name: string | null;
  total_prints: number;
  total_copies: number;
  total_scans: number;
  total_fax: number;
  last_activity: string | null;
}

export interface MonthlyDetail {
  month: number;
  month_name: string;
  print_total: number;
  print_color: number;
  print_mono: number;
  copy_total: number;
  scan_total: number;
  fax_total: number;
  print_diff: number;
  copy_diff: number;
}