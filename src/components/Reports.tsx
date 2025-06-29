import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Users, 
  Download, 
  Filter,
  PieChart,
  LineChart,
  FileText,
  Printer,
  Copy,
  Scan,
  Send,
  Building,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
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
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Cell,
  Pie,
  Area,
  AreaChart
} from 'recharts';

interface ReportFilters {
  dateRange: 'last3months' | 'last6months' | 'lastyear' | 'custom';
  startDate?: string;
  endDate?: string;
  userId?: string;
  office?: string;
  department?: string;
  reportType: 'summary' | 'detailed' | 'trends' | 'comparison';
}

interface MonthlyTrend {
  month: string;
  year: number;
  monthNum: number;
  prints: number;
  copies: number;
  scans: number;
  fax: number;
  total: number;
}

interface UserReport {
  user_id: string;
  full_name: string;
  office: string;
  department: string;
  total_prints: number;
  total_copies: number;
  total_scans: number;
  total_fax: number;
  total_operations: number;
  avg_monthly: number;
  last_activity: string;
}

interface OfficeReport {
  office: string;
  user_count: number;
  total_prints: number;
  total_copies: number;
  total_scans: number;
  total_fax: number;
  avg_per_user: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export function Reports() {
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: 'last6months',
    reportType: 'summary'
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'users' | 'offices'>('overview');

  // Calcular rango de fechas
  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    
    switch (filters.dateRange) {
      case 'last3months':
        start = subMonths(now, 3);
        break;
      case 'last6months':
        start = subMonths(now, 6);
        break;
      case 'lastyear':
        start = subMonths(now, 12);
        break;
      case 'custom':
        start = filters.startDate ? new Date(filters.startDate) : subMonths(now, 6);
        break;
      default:
        start = subMonths(now, 6);
    }
    
    return {
      start: startOfMonth(start),
      end: filters.dateRange === 'custom' && filters.endDate 
        ? endOfMonth(new Date(filters.endDate))
        : endOfMonth(now)
    };
  };

  const dateRange = getDateRange();

  // Query para tendencias mensuales
  const { data: monthlyTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ['monthly-trends', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prints_monthly')
        .select(`
          year,
          month,
          print_total,
          copy_total,
          scan_total,
          fax_total
        `)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (error) throw error;

      // Agrupar por mes/año
      const grouped = data.reduce((acc: any, row) => {
        const key = `${row.year}-${row.month.toString().padStart(2, '0')}`;
        if (!acc[key]) {
          acc[key] = {
            month: format(new Date(row.year, row.month - 1), 'MMM yyyy', { locale: es }),
            year: row.year,
            monthNum: row.month,
            prints: 0,
            copies: 0,
            scans: 0,
            fax: 0,
            total: 0
          };
        }
        
        acc[key].prints += row.print_total || 0;
        acc[key].copies += row.copy_total || 0;
        acc[key].scans += row.scan_total || 0;
        acc[key].fax += row.fax_total || 0;
        acc[key].total += (row.print_total || 0) + (row.copy_total || 0) + (row.scan_total || 0) + (row.fax_total || 0);
        
        return acc;
      }, {});

      return Object.values(grouped) as MonthlyTrend[];
    },
  });

  // Query para reporte de usuarios
  const { data: userReports, isLoading: usersLoading } = useQuery({
    queryKey: ['user-reports', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          office,
          department,
          prints_monthly!inner (
            print_total,
            copy_total,
            scan_total,
            fax_total,
            year,
            month
          ),
          prints_raw (
            report_timestamp
          )
        `)
        .gte('prints_monthly.created_at', dateRange.start.toISOString())
        .lte('prints_monthly.created_at', dateRange.end.toISOString());

      if (error) throw error;

      return data.map(user => {
        const totalPrints = user.prints_monthly.reduce((sum, m) => sum + (m.print_total || 0), 0);
        const totalCopies = user.prints_monthly.reduce((sum, m) => sum + (m.copy_total || 0), 0);
        const totalScans = user.prints_monthly.reduce((sum, m) => sum + (m.scan_total || 0), 0);
        const totalFax = user.prints_monthly.reduce((sum, m) => sum + (m.fax_total || 0), 0);
        const totalOperations = totalPrints + totalCopies + totalScans + totalFax;
        const monthsActive = user.prints_monthly.length;
        const lastActivity = user.prints_raw.length > 0 
          ? Math.max(...user.prints_raw.map(r => new Date(r.report_timestamp).getTime()))
          : 0;

        return {
          user_id: user.id,
          full_name: user.full_name || 'Sin nombre',
          office: user.office || 'Sin oficina',
          department: user.department || 'Sin departamento',
          total_prints: totalPrints,
          total_copies: totalCopies,
          total_scans: totalScans,
          total_fax: totalFax,
          total_operations: totalOperations,
          avg_monthly: monthsActive > 0 ? Math.round(totalOperations / monthsActive) : 0,
          last_activity: lastActivity > 0 ? new Date(lastActivity).toISOString() : ''
        };
      }) as UserReport[];
    },
  });

  // Query para reporte de oficinas
  const { data: officeReports, isLoading: officesLoading } = useQuery({
    queryKey: ['office-reports', dateRange],
    queryFn: async () => {
      if (!userReports) return [];

      const grouped = userReports.reduce((acc: any, user) => {
        const office = user.office || 'Sin oficina';
        if (!acc[office]) {
          acc[office] = {
            office,
            user_count: 0,
            total_prints: 0,
            total_copies: 0,
            total_scans: 0,
            total_fax: 0,
            avg_per_user: 0
          };
        }

        acc[office].user_count++;
        acc[office].total_prints += user.total_prints;
        acc[office].total_copies += user.total_copies;
        acc[office].total_scans += user.total_scans;
        acc[office].total_fax += user.total_fax;

        return acc;
      }, {});

      return Object.values(grouped).map((office: any) => ({
        ...office,
        avg_per_user: office.user_count > 0 
          ? Math.round((office.total_prints + office.total_copies + office.total_scans + office.total_fax) / office.user_count)
          : 0
      })) as OfficeReport[];
    },
    enabled: !!userReports
  });

  // Datos para gráficos de resumen
  const summaryData = monthlyTrends ? [
    {
      name: 'Impresiones',
      value: monthlyTrends.reduce((sum, m) => sum + m.prints, 0),
      color: COLORS[0]
    },
    {
      name: 'Copias',
      value: monthlyTrends.reduce((sum, m) => sum + m.copies, 0),
      color: COLORS[1]
    },
    {
      name: 'Escaneos',
      value: monthlyTrends.reduce((sum, m) => sum + m.scans, 0),
      color: COLORS[2]
    },
    {
      name: 'Fax',
      value: monthlyTrends.reduce((sum, m) => sum + m.fax, 0),
      color: COLORS[3]
    }
  ] : [];

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs = [
    { id: 'overview', name: 'Resumen General', icon: BarChart3 },
    { id: 'trends', name: 'Tendencias', icon: TrendingUp },
    { id: 'users', name: 'Por Usuario', icon: Users },
    { id: 'offices', name: 'Por Oficina', icon: Building }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Reportes Avanzados
            </h2>
            <p className="text-gray-600">
              Análisis detallado de uso de equipos de impresión
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                const currentData = activeTab === 'users' ? userReports : 
                                 activeTab === 'offices' ? officeReports :
                                 activeTab === 'trends' ? monthlyTrends : summaryData;
                exportToCSV(currentData || [], `reporte_${activeTab}`);
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="last3months">Últimos 3 meses</option>
              <option value="last6months">Últimos 6 meses</option>
              <option value="lastyear">Último año</option>
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
              Tipo de reporte
            </label>
            <select
              value={filters.reportType}
              onChange={(e) => setFilters(prev => ({ ...prev, reportType: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="summary">Resumen</option>
              <option value="detailed">Detallado</option>
              <option value="trends">Tendencias</option>
              <option value="comparison">Comparativo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${isActive 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Resumen General */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Métricas principales */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <div className="flex items-center">
                    <Printer className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-blue-600">Total Impresiones</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {summaryData.find(d => d.name === 'Impresiones')?.value.toLocaleString() || '0'}
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
                        {summaryData.find(d => d.name === 'Copias')?.value.toLocaleString() || '0'}
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
                        {summaryData.find(d => d.name === 'Escaneos')?.value.toLocaleString() || '0'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                  <div className="flex items-center">
                    <Send className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-red-600">Total Fax</p>
                      <p className="text-2xl font-bold text-red-900">
                        {summaryData.find(d => d.name === 'Fax')?.value.toLocaleString() || '0'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico de distribución */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Distribución por Tipo de Operación
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={summaryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {summaryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => value.toLocaleString()} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Evolución Mensual Total
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => value.toLocaleString()} />
                      <Area 
                        type="monotone" 
                        dataKey="total" 
                        stroke="#3B82F6" 
                        fill="#3B82F6" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Tendencias */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Tendencias por Tipo de Operación
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <RechartsLineChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => value.toLocaleString()} />
                    <Legend />
                    <Line type="monotone" dataKey="prints" stroke={COLORS[0]} name="Impresiones" strokeWidth={2} />
                    <Line type="monotone" dataKey="copies" stroke={COLORS[1]} name="Copias" strokeWidth={2} />
                    <Line type="monotone" dataKey="scans" stroke={COLORS[2]} name="Escaneos" strokeWidth={2} />
                    <Line type="monotone" dataKey="fax" stroke={COLORS[3]} name="Fax" strokeWidth={2} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Comparativo Mensual (Barras)
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => value.toLocaleString()} />
                    <Legend />
                    <Bar dataKey="prints" fill={COLORS[0]} name="Impresiones" />
                    <Bar dataKey="copies" fill={COLORS[1]} name="Copias" />
                    <Bar dataKey="scans" fill={COLORS[2]} name="Escaneos" />
                    <Bar dataKey="fax" fill={COLORS[3]} name="Fax" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Por Usuario */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuario
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Oficina/Depto
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
                        Promedio/Mes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Última Actividad
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {usersLoading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 text-center">
                          <div className="animate-pulse">Cargando datos...</div>
                        </td>
                      </tr>
                    ) : userReports?.map((user) => (
                      <tr key={user.user_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.full_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {user.user_id}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{user.office}</div>
                          <div className="text-sm text-gray-500">{user.department}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.total_prints.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.total_copies.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.total_scans.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.total_operations.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.avg_monthly.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.last_activity 
                            ? format(new Date(user.last_activity), 'dd/MM/yyyy', { locale: es })
                            : 'Sin actividad'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Top 10 usuarios */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Top 10 Usuarios por Actividad Total
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart 
                    data={userReports?.slice(0, 10).sort((a, b) => b.total_operations - a.total_operations)}
                    layout="horizontal"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="full_name" type="category" width={120} />
                    <Tooltip formatter={(value: any) => value.toLocaleString()} />
                    <Bar dataKey="total_operations" fill={COLORS[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Por Oficina */}
          {activeTab === 'offices' && (
            <div className="space-y-6">
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
                    {officesLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center">
                          <div className="animate-pulse">Cargando datos...</div>
                        </td>
                      </tr>
                    ) : officeReports?.map((office) => (
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
                          {(office.total_prints + office.total_copies + office.total_scans + office.total_fax).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {office.avg_per_user.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Gráfico de oficinas */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Comparativo por Oficina
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={officeReports}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="office" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => value.toLocaleString()} />
                    <Legend />
                    <Bar dataKey="total_prints" fill={COLORS[0]} name="Impresiones" />
                    <Bar dataKey="total_copies" fill={COLORS[1]} name="Copias" />
                    <Bar dataKey="total_scans" fill={COLORS[2]} name="Escaneos" />
                    <Bar dataKey="total_fax" fill={COLORS[3]} name="Fax" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}