import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Copy, Scan, Fan as Fax, TrendingUp, Users, Calendar } from 'lucide-react';
import { supabase, DashboardStats, UserTotal } from '../lib/supabase';
import { StatsCard } from './StatsCard';
import { UsersTable } from './UsersTable';

export function Dashboard() {
  // Consultar estadísticas generales
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_stats');
      if (error) throw error;
      return data[0] as DashboardStats;
    },
  });

  // Consultar totales por usuario
  const { data: userTotals, isLoading: usersLoading } = useQuery({
    queryKey: ['user-totals'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('total_by_user', { target_user_id: null });
      if (error) throw error;
      return data as UserTotal[];
    },
  });

  // Consultar estadísticas adicionales para métricas más precisas
  const { data: additionalStats, isLoading: additionalLoading } = useQuery({
    queryKey: ['additional-stats'],
    queryFn: async () => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Total de usuarios
      const { data: totalUsersData, error: totalUsersError } = await supabase
        .from('users')
        .select('id', { count: 'exact' });
      
      if (totalUsersError) throw totalUsersError;
      
      // Usuarios activos (que tienen datos en el mes actual)
      const { data: activeUsersData, error: activeUsersError } = await supabase
        .from('prints_monthly')
        .select('user_id', { count: 'exact' })
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
      
      return {
        total_users: totalUsersData?.length || 0,
        active_users: activeUsersData?.length || 0,
        total_prints_month: totalPrints,
        total_copies_month: totalCopies,
        last_import: lastImportData?.[0]?.imported_at || null
      };
    },
  });

  if (statsLoading || additionalLoading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm h-32"></div>
          ))}
        </div>
      </div>
    );
  }

  const formatLastImport = (dateString: string | null) => {
    if (!dateString) return 'Sin importaciones';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Usar datos adicionales si están disponibles, sino usar los datos de stats
  const displayStats = additionalStats || stats;

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Usuarios"
          value={displayStats?.total_users?.toLocaleString() || '0'}
          icon={Users}
          color="blue"
        />
        
        <StatsCard
          title="Usuarios Activos"
          value={displayStats?.active_users?.toLocaleString() || '0'}
          icon={TrendingUp}
          color="green"
          subtitle="Este mes"
        />
        
        <StatsCard
          title="Impresiones del Mes"
          value={displayStats?.total_prints_month?.toLocaleString() || '0'}
          icon={Printer}
          color="purple"
        />
        
        <StatsCard
          title="Copias del Mes"
          value={displayStats?.total_copies_month?.toLocaleString() || '0'}
          icon={Copy}
          color="orange"
        />
      </div>

      {/* Last Import Info */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center">
          <Calendar className="h-5 w-5 text-gray-400 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-gray-900">Última Importación</h3>
            <p className="text-sm text-gray-600">
              {formatLastImport(displayStats?.last_import || null)}
            </p>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Usuarios y Totales
          </h2>
          <p className="text-sm text-gray-600">
            Resumen de actividad por usuario
          </p>
        </div>
        
        <UsersTable 
          users={userTotals || []} 
          loading={usersLoading}
        />
      </div>
    </div>
  );
}