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

// Función helper para obtener totales por usuario directamente de las tablas
export const getTotalByUser = async (targetUserId?: string): Promise<UserTotal[]> => {
  try {
    console.log('🔍 Obteniendo totales por usuario...');
    
    // Obtener todos los usuarios
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name')
      .order('id');
    
    if (usersError) {
      console.error('Error obteniendo usuarios:', usersError);
      throw usersError;
    }

    console.log(`📊 Usuarios encontrados: ${users?.length || 0}`);

    // Obtener datos mensuales agregados
    let monthlyQuery = supabase
      .from('prints_monthly')
      .select('user_id, print_total, copy_total, scan_total, fax_total');
    
    if (targetUserId) {
      monthlyQuery = monthlyQuery.eq('user_id', targetUserId);
    }
    
    const { data: monthlyData, error: monthlyError } = await monthlyQuery;
    
    if (monthlyError) {
      console.error('Error obteniendo datos mensuales:', monthlyError);
      throw monthlyError;
    }

    console.log(`📈 Registros mensuales encontrados: ${monthlyData?.length || 0}`);

    // Obtener última actividad de datos raw
    let rawQuery = supabase
      .from('prints_raw')
      .select('user_id, report_timestamp')
      .order('report_timestamp', { ascending: false });
    
    if (targetUserId) {
      rawQuery = rawQuery.eq('user_id', targetUserId);
    }
    
    const { data: rawData, error: rawError } = await rawQuery;
    
    if (rawError) {
      console.warn('Error obteniendo datos raw (no crítico):', rawError);
    }

    console.log(`📅 Registros raw encontrados: ${rawData?.length || 0}`);

    // Crear mapa de totales por usuario
    const userTotalsMap = new Map<string, UserTotal>();

    // Inicializar todos los usuarios
    users?.forEach(user => {
      userTotalsMap.set(user.id, {
        user_id: user.id,
        full_name: user.full_name,
        total_prints: 0,
        total_copies: 0,
        total_scans: 0,
        total_fax: 0,
        last_activity: null
      });
    });

    // Agregar datos mensuales
    monthlyData?.forEach(row => {
      const existing = userTotalsMap.get(row.user_id);
      if (existing) {
        existing.total_prints += row.print_total || 0;
        existing.total_copies += row.copy_total || 0;
        existing.total_scans += row.scan_total || 0;
        existing.total_fax += row.fax_total || 0;
      }
    });

    // Agregar última actividad
    const lastActivityMap = new Map<string, string>();
    rawData?.forEach(row => {
      if (!lastActivityMap.has(row.user_id)) {
        lastActivityMap.set(row.user_id, row.report_timestamp);
      }
    });

    lastActivityMap.forEach((timestamp, userId) => {
      const existing = userTotalsMap.get(userId);
      if (existing) {
        existing.last_activity = timestamp;
      }
    });

    const result = Array.from(userTotalsMap.values())
      .sort((a, b) => b.total_prints - a.total_prints);

    console.log(`✅ Totales calculados para ${result.length} usuarios`);
    console.log('📊 Muestra de datos:', result.slice(0, 3));

    return result;
  } catch (error) {
    console.error('💥 Error en getTotalByUser:', error);
    throw error;
  }
};

// Función helper para obtener estadísticas del dashboard
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    console.log('🔍 Obteniendo estadísticas del dashboard...');
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Total de usuarios
    const { data: totalUsersData, error: totalUsersError } = await supabase
      .from('users')
      .select('id', { count: 'exact' });
    
    if (totalUsersError) throw totalUsersError;

    // Usuarios activos este mes
    const { data: activeUsersData, error: activeUsersError } = await supabase
      .from('prints_monthly')
      .select('user_id')
      .eq('year', currentYear)
      .eq('month', currentMonth);
    
    if (activeUsersError) throw activeUsersError;

    // Impresiones del mes actual
    const { data: monthlyPrintsData, error: monthlyPrintsError } = await supabase
      .from('prints_monthly')
      .select('print_total')
      .eq('year', currentYear)
      .eq('month', currentMonth);
    
    if (monthlyPrintsError) throw monthlyPrintsError;

    // Copias del mes actual
    const { data: monthlyCopiesData, error: monthlyCopiesError } = await supabase
      .from('prints_monthly')
      .select('copy_total')
      .eq('year', currentYear)
      .eq('month', currentMonth);
    
    if (monthlyCopiesError) throw monthlyCopiesError;

    // Última importación
    const { data: lastImportData, error: lastImportError } = await supabase
      .from('import_log')
      .select('imported_at')
      .order('imported_at', { ascending: false })
      .limit(1);
    
    if (lastImportError) throw lastImportError;

    const totalPrints = monthlyPrintsData.reduce((sum, row) => sum + (row.print_total || 0), 0);
    const totalCopies = monthlyCopiesData.reduce((sum, row) => sum + (row.copy_total || 0), 0);
    const uniqueActiveUsers = new Set(activeUsersData.map(row => row.user_id)).size;

    const stats = {
      total_users: totalUsersData?.length || 0,
      active_users: uniqueActiveUsers,
      total_prints_month: totalPrints,
      total_copies_month: totalCopies,
      last_import: lastImportData?.[0]?.imported_at || null
    };

    console.log('✅ Estadísticas calculadas:', stats);
    return stats;
  } catch (error) {
    console.error('💥 Error en getDashboardStats:', error);
    throw error;
  }
};

// Función helper para obtener detalle mensual
export const getMonthlyDetail = async (userId: string, year?: number): Promise<MonthlyDetail[]> => {
  try {
    const targetYear = year || new Date().getFullYear();
    
    const { data, error } = await supabase
      .from('prints_monthly')
      .select('*')
      .eq('user_id', userId)
      .eq('year', targetYear)
      .order('month');
    
    if (error) throw error;

    const monthNames = [
      '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return data.map(row => ({
      month: row.month,
      month_name: monthNames[row.month],
      print_total: row.print_total,
      print_color: row.print_color,
      print_mono: row.print_mono,
      copy_total: row.copy_total,
      scan_total: row.scan_total,
      fax_total: row.fax_total,
      print_diff: row.print_total_diff,
      copy_diff: row.copy_total_diff
    }));
  } catch (error) {
    console.error('Error en getMonthlyDetail:', error);
    throw error;
  }
};