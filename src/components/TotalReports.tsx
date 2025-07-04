import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Users, 
  Download, 
  Filter,
  Printer,
  Copy,
  Scan,
  Send,
  Building,
  Clock,
  Database,
  FileText,
  Activity,
  Target
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface TotalReportFilters {
  dateRange: 'all' | 'current_year' | 'last_year' | 'last_6_months' | 'last_3_months' | 'custom';
  startDate?: string;
  endDate?: string;
  office?: string;
  includeInactive?: boolean;
}

interface GlobalTotals {
  total_users: number;
  active_users: number;
  total_prints: number;
  total_copies: number;
  total_scans: number;
  total_fax: number;
  total_operations: number;
  period_start: string;
  period_end: string;
  avg_per_user: number;
  avg_per_month: number;
}

interface OfficeTotal {
  office: string;
  user_count: number;
  total_prints: number;
  total_copies: number;
  total_scans: number;
  total_fax: number;
  total_operations: number;
  avg_per_user: number;
}

interface MonthlyTotal {
  year: number;
  month: number;
  month_name: string;
  total_prints: number;
  total_copies: number;
  total_scans: number;
  total_fax: number;
  total_operations: number;
  active_users: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export function TotalReports() {
  const [filters, setFilters] = useState<TotalReportFilters>({
    dateRange: 'current_year',
    includeInactive: false
  });

  // Calcular rango de fechas - CORREGIDO
  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    let end: Date;
    
    switch (filters.dateRange) {
      case 'all':
        // Para "todos los datos", usar desde hace 5 años hasta ahora
        start = new Date(now.getFullYear() - 5, 0, 1);
        end = now;
        break;
        
      case 'current_year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
        
      case 'last_year':
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);
        start = startOfYear(lastYear);
        end = endOfYear(lastYear);
        break;
        
      case 'last_6_months':
        start = startOfMonth(subMonths(now, 6));
        end = endOfMonth(now);
        break;
        
      case 'last_3_months':
        start = startOfMonth(subMonths(now, 3));
        end = endOfMonth(now);
        break;
        
      case 'custom':
        start = filters.startDate ? startOfMonth(new Date(filters.startDate)) : startOfMonth(subMonths(now, 6));
        end = filters.endDate ? endOfMonth(new Date(filters.endDate)) : endOfMonth(now);
        break;
        
      default:
        start = startOfYear(now);
        end = endOfYear(now);
    }
    
    return { start, end };
  };

  const dateRange = getDateRange();

  // Query para totales globales
  const { data: globalTotals, isLoading: totalsLoading } = useQuery({
    queryKey: ['global-totals', dateRange, filters.office, filters.includeInactive],
    queryFn: async () => {
      console.log('🔍 Obteniendo totales globales para período:', {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        office: filters.office,
        includeInactive: filters.includeInactive
      });

      // Construir query base
      let query = supabase
        .from('prints_monthly')
        .select(`
          print_total,
          copy_total,
          scan_total,
          fax_total,
          user_id,
          year,
          month,
          users!inner(
            id,
            status,
            office,
            full_name
          )
        `)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      // Aplicar filtros
      if (filters.office) {
        query = query.eq('users.office', filters.office);
      }

      if (!filters.includeInactive) {
        query = query.eq('users.status', 'Normal');
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error obteniendo datos:', error);
        throw error;
      }

      console.log(`📊 Datos obtenidos: ${data?.length || 0} registros`);

      // Calcular totales
      const totalPrints = data.reduce((sum, row) => sum + (row.print_total || 0), 0);
      const totalCopies = data.reduce((sum, row) => sum + (row.copy_total || 0), 0);
      const totalScans = data.reduce((sum, row) => sum + (row.scan_total || 0), 0);
      const totalFax = data.reduce((sum, row) => sum + (row.fax_total || 0), 0);
      const totalOperations = totalPrints + totalCopies + totalScans + totalFax;

      // Usuarios únicos
      const uniqueUsers = new Set(data.map(row => row.user_id));
      const totalUsers = uniqueUsers.size;
      const activeUsers = data.filter(row => 
        (row.print_total || 0) + (row.copy_total || 0) + (row.scan_total || 0) + (row.fax_total || 0) > 0
      ).length;

      // Calcular promedios
      const avgPerUser = totalUsers > 0 ? totalOperations / totalUsers : 0;
      
      // Calcular meses en el período
      const monthsDiff = Math.max(1, 
        (dateRange.end.getFullYear() - dateRange.start.getFullYear()) * 12 + 
        (dateRange.end.getMonth() - dateRange.start.getMonth()) + 1
      );
      const avgPerMonth = monthsDiff > 0 ? totalOperations / monthsDiff : 0;

      const result = {
        total_users: totalUsers,
        active_users: activeUsers,
        total_prints: totalPrints,
        total_copies: totalCopies,
        total_scans: totalScans,
        total_fax: totalFax,
        total_operations: totalOperations,
        period_start: dateRange.start.toISOString(),
        period_end: dateRange.end.toISOString(),
        avg_per_user: avgPerUser,
        avg_per_month: avgPerMonth
      } as GlobalTotals;

      console.log('✅ Totales calculados:', result);
      return result;
    },
  });

  // Query para totales por oficina
  const { data: officeTotals, isLoading: officesLoading } = useQuery({
    queryKey: ['office-totals', dateRange, filters.includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('prints_monthly')
        .select(`
          print_total,
          copy_total,
          scan_total,
          fax_total,
          user_id,
          users!inner(
            office,
            status
          )
        `)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      if (!filters.includeInactive) {
        query = query.eq('users.status', 'Normal');
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por oficina
      const officeGroups = data.reduce((acc: any, row) => {
        const office = row.users.office || 'Sin oficina';
        if (!acc[office]) {
          acc[office] = {
            office,
            users: new Set(),
            total_prints: 0,
            total_copies: 0,
            total_scans: 0,
            total_fax: 0
          };
        }
        
        acc[office].users.add(row.user_id);
        acc[office].total_prints += row.print_total || 0;
        acc[office].total_copies += row.copy_total || 0;
        acc[office].total_scans += row.scan_total || 0;
        acc[office].total_fax += row.fax_total || 0;
        
        return acc;
      }, {});

      return Object.values(officeGroups).map((group: any) => ({
        office: group.office,
        user_count: group.users.size,
        total_prints: group.total_prints,
        total_copies: group.total_copies,
        total_scans: group.total_scans,
        total_fax: group.total_fax,
        total_operations: group.total_prints + group.total_copies + group.total_scans + group.total_fax,
        avg_per_user: group.users.size > 0 ? 
          (group.total_prints + group.total_copies + group.total_scans + group.total_fax) / group.users.size : 0
      })) as OfficeTotal[];
    },
  });

  // Query para totales mensuales
  const { data: monthlyTotals, isLoading: monthlyLoading } = useQuery({
    queryKey: ['monthly-totals', dateRange, filters.office, filters.includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('prints_monthly')
        .select(`
          year,
          month,
          print_total,
          copy_total,
          scan_total,
          fax_total,
          user_id,
          users!inner(
            office,
            status
          )
        `)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('year')
        .order('month');

      if (filters.office) {
        query = query.eq('users.office', filters.office);
      }

      if (!filters.includeInactive) {
        query = query.eq('users.status', 'Normal');
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por año/mes
      const monthlyGroups = data.reduce((acc: any, row) => {
        const key = `${row.year}-${row.month}`;
        if (!acc[key]) {
          acc[key] = {
            year: row.year,
            month: row.month,
            month_name: format(new Date(row.year, row.month - 1), 'MMM yyyy', { locale: es }),
            users: new Set(),
            total_prints: 0,
            total_copies: 0,
            total_scans: 0,
            total_fax: 0
          };
        }
        
        acc[key].users.add(row.user_id);
        acc[key].total_prints += row.print_total || 0;
        acc[key].total_copies += row.copy_total || 0;
        acc[key].total_scans += row.scan_total || 0;
        acc[key].total_fax += row.fax_total || 0;
        
        return acc;
      }, {});

      return Object.values(monthlyGroups).map((group: any) => ({
        year: group.year,
        month: group.month,
        month_name: group.month_name,
        total_prints: group.total_prints,
        total_copies: group.total_copies,
        total_scans: group.total_scans,
        total_fax: group.total_fax,
        total_operations: group.total_prints + group.total_copies + group.total_scans + group.total_fax,
        active_users: group.users.size
      })) as MonthlyTotal[];
    },
  });

  // Query para obtener oficinas únicas
  const { data: offices } = useQuery({
    queryKey: ['offices-for-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('office')
        .not('office', 'is', null);
      
      if (error) throw error;
      
      const uniqueOffices = [...new Set(data.map(u => u.office))].filter(Boolean);
      return uniqueOffices.sort();
    },
  });

  // Datos para gráfico de distribución
  const distributionData = globalTotals ? [
    { name: 'Impresiones', value: globalTotals.total_prints, color: COLORS[0] },
    { name: 'Copias', value: globalTotals.total_copies, color: COLORS[1] },
    { name: 'Escaneos', value: globalTotals.total_scans, color: COLORS[2] },
    { name: 'Fax', value: globalTotals.total_fax, color: COLORS[3] }
  ].filter(item => item.value > 0) : [];

  const exportToCSV = () => {
    if (!globalTotals) return;

    const reportData = {
      'Período': `${format(new Date(globalTotals.period_start), 'dd/MM/yyyy')} - ${format(new Date(globalTotals.period_end), 'dd/MM/yyyy')}`,
      'Total de Usuarios': globalTotals.total_users,
      'Usuarios Activos': globalTotals.active_users,
      'Total de Impresiones': globalTotals.total_prints,
      'Total de Copias': globalTotals.total_copies,
      'Total de Escaneos': globalTotals.total_scans,
      'Total de Fax': globalTotals.total_fax,
      'Total de Operaciones': globalTotals.total_operations,
      'Promedio por Usuario': Math.round(globalTotals.avg_per_user),
      'Promedio por Mes': Math.round(globalTotals.avg_per_month)
    };

    const headers = Object.keys(reportData);
    const values = Object.values(reportData);
    
    const csvContent = [
      headers.join(','),
      values.map(v => `"${v}"`).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_total_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (totalsLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm h-32"></div>
          ))}
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm h-96"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Reporte Total de Impresiones
            </h2>
            <p className="text-gray-600">
              Análisis completo y exacto de todas las operaciones del sistema
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Reporte
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período de Análisis
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los datos</option>
              <option value="current_year">Año actual</option>
              <option value="last_year">Año anterior</option>
              <option value="last_6_months">Últimos 6 meses</option>
              <option value="last_3_months">Últimos 3 meses</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {filters.dateRange === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha inicio
                </label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha fin
                </label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Oficina
            </label>
            <select
              value={filters.office || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, office: e.target.value || undefined }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las oficinas</option>
              {offices?.map(office => (
                <option key={office} value={office}>{office}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.includeInactive}
                onChange={(e) => setFilters(prev => ({ ...prev, includeInactive: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Incluir usuarios inactivos</span>
            </label>
          </div>
        </div>
      </div>

      {/* Totales Principales */}
      {globalTotals && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <Printer className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Total Impresiones</p>
                <p className="text-2xl font-bold text-blue-900">
                  {globalTotals.total_prints.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <div className="flex items-center">
              <Copy className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Total Copias</p>
                <p className="text-2xl font-bold text-green-900">
                  {globalTotals.total_copies.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
            <div className="flex items-center">
              <Scan className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-600">Total Escaneos</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {globalTotals.total_scans.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600">Total Operaciones</p>
                <p className="text-2xl font-bold text-purple-900">
                  {globalTotals.total_operations.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas Adicionales */}
      {globalTotals && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-gray-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Usuarios Totales</p>
                <p className="text-2xl font-bold text-gray-900">
                  {globalTotals.total_users.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-gray-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Usuarios Activos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {globalTotals.active_users.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-gray-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Promedio por Usuario</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(globalTotals.avg_per_user).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-gray-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Promedio por Mes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(globalTotals.avg_per_month).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Tipo */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Distribución por Tipo de Operación
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => value.toLocaleString()} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Evolución Mensual */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Evolución Mensual
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTotals}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month_name" />
              <YAxis />
              <Tooltip formatter={(value: any) => value.toLocaleString()} />
              <Bar dataKey="total_operations" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Totales por Oficina */}
      {officeTotals && officeTotals.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Totales por Oficina
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Oficina
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuarios
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Impresiones
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Copias
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Escaneos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Promedio/Usuario
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {officeTotals.map((office) => (
                  <tr key={office.office} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building className="h-5 w-5 text-gray-400 mr-3" />
                        <div className="text-sm font-medium text-gray-900">
                          {office.office}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {office.user_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {office.total_prints.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {office.total_copies.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {office.total_scans.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {office.total_operations.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Math.round(office.avg_per_user).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Información del Período */}
      {globalTotals && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Clock className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                Información del Período Analizado
              </h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>
                  <strong>Período:</strong> {format(new Date(globalTotals.period_start), 'dd/MM/yyyy', { locale: es })}  {format(new Date(globalTotals.period_end), \'dd/MM/yyyy', { locale: es })}
                </p>
                <p>
                  <strong>Filtros aplicados:</strong> {filters.office ? `Oficina: ${filters.office}` : 'Todas las oficinas'} 
                  {filters.includeInactive ? ' (incluye usuarios inactivos)' : ' (solo usuarios activos)'}
                </p>
                <p>
                  <strong>Última actualización:</strong> {format(new Date(), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}