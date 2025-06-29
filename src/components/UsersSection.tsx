import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  User, 
  Users, 
  Search,
  Building,
  UserCheck,
  Activity,
  Calendar,
  TrendingUp,
  Filter,
  Download,
  Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UsersTable } from './UsersTable';

interface UserData {
  id: string;
  status: string;
  email?: string;
  full_name?: string;
  office?: string;
  department?: string;
  created_at: string;
  updated_at: string;
}

interface UserWithActivity extends UserData {
  total_prints: number;
  total_copies: number;
  total_scans: number;
  total_fax: number;
  last_activity: string | null;
  months_active: number;
}

interface UserStats {
  total_users: number;
  active_users: number;
  users_with_names: number;
  users_with_offices: number;
}

export function UsersSection() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Query para obtener usuarios con actividad
  const { data: usersWithActivity, isLoading: usersLoading } = useQuery({
    queryKey: ['users-with-activity'],
    queryFn: async () => {
      // Primero obtener todos los usuarios
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('id');
      
      if (usersError) throw usersError;

      // Luego obtener totales por usuario usando la función RPC
      const { data: userTotals, error: totalsError } = await supabase
        .rpc('total_by_user');
      
      if (totalsError) {
        console.warn('Error getting user totals:', totalsError);
        // Si falla la función RPC, devolver usuarios sin actividad
        return users.map(user => ({
          ...user,
          total_prints: 0,
          total_copies: 0,
          total_scans: 0,
          total_fax: 0,
          last_activity: null,
          months_active: 0
        })) as UserWithActivity[];
      }

      // Combinar datos de usuarios con totales
      const usersWithTotals = users.map(user => {
        const userTotal = userTotals?.find((ut: any) => ut.user_id === user.id);
        return {
          ...user,
          total_prints: userTotal?.total_prints || 0,
          total_copies: userTotal?.total_copies || 0,
          total_scans: userTotal?.total_scans || 0,
          total_fax: userTotal?.total_fax || 0,
          last_activity: userTotal?.last_activity || null,
          months_active: userTotal?.months_active || 0
        };
      });

      return usersWithTotals as UserWithActivity[];
    },
  });

  // Query para estadísticas de usuarios
  const { data: userStats } = useQuery({
    queryKey: ['users-stats'],
    queryFn: async () => {
      if (!usersWithActivity) return null;
      
      const total = usersWithActivity.length;
      const active = usersWithActivity.filter(u => 
        u.total_prints > 0 || u.total_copies > 0 || u.total_scans > 0 || u.total_fax > 0
      ).length;
      const withNames = usersWithActivity.filter(u => u.full_name && u.full_name.trim() !== '').length;
      const withOffices = usersWithActivity.filter(u => u.office && u.office.trim() !== '').length;
      
      return {
        total_users: total,
        active_users: active,
        users_with_names: withNames,
        users_with_offices: withOffices
      } as UserStats;
    },
    enabled: !!usersWithActivity
  });

  // Query para obtener oficinas únicas
  const { data: offices } = useQuery({
    queryKey: ['offices-list-users'],
    queryFn: async () => {
      if (!usersWithActivity) return [];
      const uniqueOffices = [...new Set(usersWithActivity.map(u => u.office).filter(Boolean))];
      return uniqueOffices.sort();
    },
    enabled: !!usersWithActivity
  });

  // Filtrar usuarios
  const filteredUsers = usersWithActivity?.filter(user => {
    const matchesSearch = !searchTerm || 
      user.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesOffice = !filterOffice || 
      (filterOffice === 'Sin oficina' ? !user.office : user.office === filterOffice);
    const matchesStatus = !filterStatus || user.status === filterStatus;
    
    return matchesSearch && matchesOffice && matchesStatus;
  }) || [];

  // Convertir a formato compatible con UsersTable
  const usersForTable = filteredUsers.map(user => ({
    user_id: user.id,
    full_name: user.full_name,
    total_prints: user.total_prints,
    total_copies: user.total_copies,
    total_scans: user.total_scans,
    total_fax: user.total_fax,
    last_activity: user.last_activity
  }));

  const exportToCSV = () => {
    if (!filteredUsers.length) return;

    const headers = [
      'ID Usuario',
      'Nombre Completo',
      'Email',
      'Oficina',
      'Departamento',
      'Estado',
      'Total Impresiones',
      'Total Copias',
      'Total Escaneos',
      'Total Fax',
      'Última Actividad',
      'Meses Activo'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredUsers.map(user => [
        user.id,
        `"${user.full_name || ''}"`,
        `"${user.email || ''}"`,
        `"${user.office || ''}"`,
        `"${user.department || ''}"`,
        user.status,
        user.total_prints,
        user.total_copies,
        user.total_scans,
        user.total_fax,
        user.last_activity ? new Date(user.last_activity).toLocaleDateString() : '',
        user.months_active
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `usuarios_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (usersLoading) {
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
      {/* Header y Estadísticas */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Gestión de Usuarios
            </h2>
            <p className="text-gray-600">
              Lista completa de usuarios del sistema con estadísticas de actividad
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

        {/* Estadísticas */}
        {userStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Total Usuarios</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {userStats.total_users.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Usuarios Activos</p>
                  <p className="text-2xl font-bold text-green-900">
                    {userStats.active_users.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-600">Con Nombres</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {userStats.users_with_names.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center">
                <Building className="h-8 w-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-600">Con Oficinas</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {userStats.users_with_offices.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Usuario
            </label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ID, nombre o email..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Oficina
            </label>
            <select
              value={filterOffice}
              onChange={(e) => setFilterOffice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las oficinas</option>
              {offices?.map(office => (
                <option key={office} value={office}>{office}</option>
              ))}
              <option value="Sin oficina">Sin oficina</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              <option value="Normal">Normal</option>
              <option value="Inactive">Inactivo</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterOffice('');
                setFilterStatus('');
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Lista de Usuarios ({filteredUsers.length})
            </h3>
            <div className="text-sm text-gray-500">
              Mostrando {filteredUsers.length} de {usersWithActivity?.length || 0} usuarios
            </div>
          </div>
        </div>

        <UsersTable 
          users={usersForTable} 
          loading={usersLoading}
        />

        {filteredUsers.length === 0 && !usersLoading && (
          <div className="p-6 text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {usersWithActivity?.length === 0 
                ? 'No hay usuarios registrados'
                : 'No se encontraron usuarios'
              }
            </h3>
            <p className="text-gray-600">
              {usersWithActivity?.length === 0 
                ? 'Los usuarios aparecerán aquí después de la primera importación de datos.'
                : 'Ajusta los filtros para ver más resultados.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}