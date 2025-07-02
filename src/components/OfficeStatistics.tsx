import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Building, 
  Users, 
  TrendingUp, 
  Crown, 
  Medal, 
  Award,
  Printer,
  Copy,
  Scan,
  Send,
  BarChart3,
  PieChart,
  Download,
  Filter,
  Search,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';

interface OfficeStats {
  office: string;
  user_count: number;
  total_prints: number;
  total_copies: number;
  total_scans: number;
  total_fax: number;
  total_operations: number;
  avg_per_user: number;
}

interface UserRanking {
  user_id: string;
  full_name: string;
  office: string;
  total_prints: number;
  total_copies: number;
  total_scans: number;
  total_fax: number;
  total_operations: number;
  rank_prints: number;
  rank_copies: number;
  rank_scans: number;
  rank_fax: number;
  rank_overall: number;
}

interface OfficeDetail {
  office: string;
  stats: OfficeStats;
  users: UserRanking[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export function OfficeStatistics() {
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'prints' | 'copies' | 'scans' | 'fax' | 'total'>('total');
  const [expandedOffices, setExpandedOffices] = useState<Set<string>>(new Set());

  // Query para estadísticas por oficina
  const { data: officeStats, isLoading: statsLoading } = useQuery({
    queryKey: ['office-statistics'],
    queryFn: async () => {
      // Obtener datos de usuarios con totales
      const { data: userTotals, error } = await supabase.rpc('total_by_user', { target_user_id: null });
      if (error) throw error;

      // Obtener información de usuarios
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, office, department');
      if (usersError) throw usersError;

      // Combinar datos
      const combinedData = userTotals.map((total: any) => {
        const user = users.find(u => u.id === total.user_id);
        return {
          ...total,
          full_name: user?.full_name || 'Sin nombre',
          office: user?.office || 'Sin oficina',
          department: user?.department || 'Sin departamento'
        };
      });

      // Agrupar por oficina
      const officeGroups = combinedData.reduce((acc: any, user) => {
        const office = user.office || 'Sin oficina';
        if (!acc[office]) {
          acc[office] = {
            office,
            users: [],
            total_prints: 0,
            total_copies: 0,
            total_scans: 0,
            total_fax: 0
          };
        }
        
        acc[office].users.push(user);
        acc[office].total_prints += user.total_prints || 0;
        acc[office].total_copies += user.total_copies || 0;
        acc[office].total_scans += user.total_scans || 0;
        acc[office].total_fax += user.total_fax || 0;
        
        return acc;
      }, {});

      // Procesar estadísticas por oficina
      const officeStatsArray = Object.values(officeGroups).map((group: any) => {
        const totalOperations = group.total_prints + group.total_copies + group.total_scans + group.total_fax;
        return {
          office: group.office,
          user_count: group.users.length,
          total_prints: group.total_prints,
          total_copies: group.total_copies,
          total_scans: group.total_scans,
          total_fax: group.total_fax,
          total_operations: totalOperations,
          avg_per_user: group.users.length > 0 ? Math.round(totalOperations / group.users.length) : 0
        } as OfficeStats;
      }).sort((a, b) => b.total_operations - a.total_operations);

      // Procesar ranking de usuarios por oficina
      const officeDetails = Object.entries(officeGroups).map(([officeName, group]: [string, any]) => {
        // Ordenar usuarios y asignar rankings
        const sortedByPrints = [...group.users].sort((a, b) => (b.total_prints || 0) - (a.total_prints || 0));
        const sortedByCopies = [...group.users].sort((a, b) => (b.total_copies || 0) - (a.total_copies || 0));
        const sortedByScans = [...group.users].sort((a, b) => (b.total_scans || 0) - (a.total_scans || 0));
        const sortedByFax = [...group.users].sort((a, b) => (b.total_fax || 0) - (a.total_fax || 0));
        const sortedByTotal = [...group.users].sort((a, b) => {
          const totalA = (a.total_prints || 0) + (a.total_copies || 0) + (a.total_scans || 0) + (a.total_fax || 0);
          const totalB = (b.total_prints || 0) + (b.total_copies || 0) + (b.total_scans || 0) + (b.total_fax || 0);
          return totalB - totalA;
        });

        const usersWithRanking = group.users.map((user: any) => {
          const totalOperations = (user.total_prints || 0) + (user.total_copies || 0) + (user.total_scans || 0) + (user.total_fax || 0);
          return {
            user_id: user.user_id,
            full_name: user.full_name,
            office: user.office,
            total_prints: user.total_prints || 0,
            total_copies: user.total_copies || 0,
            total_scans: user.total_scans || 0,
            total_fax: user.total_fax || 0,
            total_operations: totalOperations,
            rank_prints: sortedByPrints.findIndex(u => u.user_id === user.user_id) + 1,
            rank_copies: sortedByCopies.findIndex(u => u.user_id === user.user_id) + 1,
            rank_scans: sortedByScans.findIndex(u => u.user_id === user.user_id) + 1,
            rank_fax: sortedByFax.findIndex(u => u.user_id === user.user_id) + 1,
            rank_overall: sortedByTotal.findIndex(u => u.user_id === user.user_id) + 1
          } as UserRanking;
        });

        const officeStats = officeStatsArray.find(stat => stat.office === officeName);
        
        return {
          office: officeName,
          stats: officeStats!,
          users: usersWithRanking
        } as OfficeDetail;
      });

      return { officeStats: officeStatsArray, officeDetails };
    },
  });

  const toggleOfficeExpansion = (office: string) => {
    const newExpanded = new Set(expandedOffices);
    if (newExpanded.has(office)) {
      newExpanded.delete(office);
    } else {
      newExpanded.add(office);
    }
    setExpandedOffices(newExpanded);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-4 w-4 text-yellow-500" />;
      case 2: return <Medal className="h-4 w-4 text-gray-400" />;
      case 3: return <Award className="h-4 w-4 text-amber-600" />;
      default: return <span className="text-xs font-medium text-gray-500">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 2: return 'bg-gray-100 text-gray-800 border-gray-200';
      case 3: return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const exportToCSV = () => {
    if (!officeStats?.officeDetails) return;

    const csvData: any[] = [];
    
    officeStats.officeDetails.forEach(office => {
      office.users.forEach(user => {
        csvData.push({
          'Oficina': office.office,
          'Usuario ID': user.user_id,
          'Nombre Completo': user.full_name,
          'Total Impresiones': user.total_prints,
          'Ranking Impresiones': user.rank_prints,
          'Total Copias': user.total_copies,
          'Ranking Copias': user.rank_copies,
          'Total Escaneos': user.total_scans,
          'Ranking Escaneos': user.rank_scans,
          'Total Fax': user.total_fax,
          'Ranking Fax': user.rank_fax,
          'Total Operaciones': user.total_operations,
          'Ranking General': user.rank_overall
        });
      });
    });

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `estadisticas_oficinas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (statsLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm h-32"></div>
          ))}
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm h-96"></div>
      </div>
    );
  }

  const { officeStats: stats, officeDetails } = officeStats || { officeStats: [], officeDetails: [] };

  // Filtrar oficinas
  const filteredOffices = officeDetails?.filter(office => 
    !searchTerm || office.office.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Estadísticas por Oficina
            </h2>
            <p className="text-gray-600">
              Análisis detallado de uso por oficina con ranking de usuarios
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Resumen General */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <Building className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Total Oficinas</p>
                <p className="text-2xl font-bold text-blue-900">
                  {stats?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Total Usuarios</p>
                <p className="text-2xl font-bold text-green-900">
                  {stats?.reduce((sum, office) => sum + office.user_count, 0) || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-600">Total Operaciones</p>
                <p className="text-2xl font-bold text-purple-900">
                  {stats?.reduce((sum, office) => sum + office.total_operations, 0).toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-600">Promedio por Usuario</p>
                <p className="text-2xl font-bold text-orange-900">
                  {stats?.length > 0 ? Math.round(stats.reduce((sum, office) => sum + office.avg_per_user, 0) / stats.length).toLocaleString() : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar oficina..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="total">Ordenar por Total</option>
              <option value="prints">Ordenar por Impresiones</option>
              <option value="copies">Ordenar por Copias</option>
              <option value="scans">Ordenar por Escaneos</option>
              <option value="fax">Ordenar por Fax</option>
            </select>
          </div>
        </div>
      </div>

      {/* Gráfico Comparativo */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Comparativo por Oficina
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={stats}>
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

      {/* Detalle por Oficina */}
      <div className="space-y-4">
        {filteredOffices.map((office) => {
          const isExpanded = expandedOffices.has(office.office);
          
          return (
            <div key={office.office} className="bg-white rounded-lg shadow-sm border">
              {/* Header de Oficina */}
              <div 
                className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleOfficeExpansion(office.office)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Building className="h-6 w-6 text-blue-600 mr-3" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {office.office}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {office.stats.user_count} usuarios • {office.stats.total_operations.toLocaleString()} operaciones totales
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="flex items-center justify-center">
                          <Printer className="h-4 w-4 text-blue-600 mr-1" />
                          <span className="text-sm font-medium text-gray-900">
                            {office.stats.total_prints.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">Impresiones</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center">
                          <Copy className="h-4 w-4 text-green-600 mr-1" />
                          <span className="text-sm font-medium text-gray-900">
                            {office.stats.total_copies.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">Copias</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center">
                          <Scan className="h-4 w-4 text-yellow-600 mr-1" />
                          <span className="text-sm font-medium text-gray-900">
                            {office.stats.total_scans.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">Escaneos</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center">
                          <Send className="h-4 w-4 text-red-600 mr-1" />
                          <span className="text-sm font-medium text-gray-900">
                            {office.stats.total_fax.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">Fax</p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Detalle de Usuarios */}
              {isExpanded && (
                <div className="p-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">
                    Ranking de Usuarios - {office.office}
                  </h4>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usuario
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center">
                              <Printer className="h-4 w-4 mr-1" />
                              Impresiones
                            </div>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center">
                              <Copy className="h-4 w-4 mr-1" />
                              Copias
                            </div>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center">
                              <Scan className="h-4 w-4 mr-1" />
                              Escaneos
                            </div>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="flex items-center">
                              <Send className="h-4 w-4 mr-1" />
                              Fax
                            </div>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {office.users
                          .sort((a, b) => {
                            switch (sortBy) {
                              case 'prints': return b.total_prints - a.total_prints;
                              case 'copies': return b.total_copies - a.total_copies;
                              case 'scans': return b.total_scans - a.total_scans;
                              case 'fax': return b.total_fax - a.total_fax;
                              default: return b.total_operations - a.total_operations;
                            }
                          })
                          .map((user) => (
                            <tr key={user.user_id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                    <Users className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {user.full_name}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      ID: {user.user_id}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900">
                                    {user.total_prints.toLocaleString()}
                                  </span>
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getRankColor(user.rank_prints)}`}>
                                    {getRankIcon(user.rank_prints)}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900">
                                    {user.total_copies.toLocaleString()}
                                  </span>
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getRankColor(user.rank_copies)}`}>
                                    {getRankIcon(user.rank_copies)}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900">
                                    {user.total_scans.toLocaleString()}
                                  </span>
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getRankColor(user.rank_scans)}`}>
                                    {getRankIcon(user.rank_scans)}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900">
                                    {user.total_fax.toLocaleString()}
                                  </span>
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getRankColor(user.rank_fax)}`}>
                                    {getRankIcon(user.rank_fax)}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-gray-900">
                                    {user.total_operations.toLocaleString()}
                                  </span>
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getRankColor(user.rank_overall)}`}>
                                    {getRankIcon(user.rank_overall)}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredOffices.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No se encontraron oficinas
          </h3>
          <p className="text-gray-600">
            Ajusta los filtros de búsqueda para ver más resultados.
          </p>
        </div>
      )}
    </div>
  );
}