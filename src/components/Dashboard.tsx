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
      const { data, error } = await supabase.rpc('total_by_user');
      if (error) throw error;
      return data as UserTotal[];
    },
  });

  if (statsLoading) {
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

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Usuarios"
          value={stats?.total_users?.toLocaleString() || '0'}
          icon={Users}
          color="blue"
        />
        
        <StatsCard
          title="Usuarios Activos"
          value={stats?.active_users?.toLocaleString() || '0'}
          icon={TrendingUp}
          color="green"
          subtitle="Este mes"
        />
        
        <StatsCard
          title="Impresiones del Mes"
          value={stats?.total_prints_month?.toLocaleString() || '0'}
          icon={Printer}
          color="purple"
        />
        
        <StatsCard
          title="Copias del Mes"
          value={stats?.total_copies_month?.toLocaleString() || '0'}
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
              {formatLastImport(stats?.last_import || null)}
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