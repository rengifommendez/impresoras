import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  Search,
  Filter,
  Clock,
  User,
  Database,
  TrendingUp,
  BarChart3,
  Eye,
  RefreshCw,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ImportLogEntry {
  id: string;
  file_name: string;
  batch_id: string;
  imported_at: string;
  rows_processed: number;
  rows_success: number;
  rows_failed: number;
  error_details: any;
  imported_by: string | null;
  importer_email?: string;
  importer_name?: string;
}

interface ImportStats {
  total_imports: number;
  total_files: number;
  total_rows_processed: number;
  total_rows_success: number;
  total_rows_failed: number;
  success_rate: number;
  last_import: string | null;
  first_import: string | null;
}

export function ImportHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [selectedImport, setSelectedImport] = useState<ImportLogEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Query para obtener historial de importaciones con información del usuario
  const { data: importHistory, isLoading: historyLoading, refetch } = useQuery({
    queryKey: ['import-history'],
    queryFn: async () => {
      // Obtener logs de importación
      const { data: logs, error: logsError } = await supabase
        .from('import_log')
        .select('*')
        .order('imported_at', { ascending: false });
      
      if (logsError) throw logsError;

      // Obtener información de usuarios que han importado
      const importerIds = [...new Set(logs.map(log => log.imported_by).filter(Boolean))];
      
      let importersMap = new Map();
      
      if (importerIds.length > 0) {
        // Obtener usuarios de la tabla auth.users (solo los que han importado)
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        
        if (!authError && authUsers?.users) {
          authUsers.users.forEach(user => {
            if (importerIds.includes(user.id)) {
              importersMap.set(user.id, {
                email: user.email,
                name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'
              });
            }
          });
        }

        // También buscar en la tabla users local
        const { data: localUsers, error: localError } = await supabase
          .from('users')
          .select('id, email, full_name')
          .in('id', importerIds);
        
        if (!localError && localUsers) {
          localUsers.forEach(user => {
            if (!importersMap.has(user.id)) {
              importersMap.set(user.id, {
                email: user.email || 'Sin email',
                name: user.full_name || user.email?.split('@')[0] || 'Usuario'
              });
            }
          });
        }
      }
      
      return logs.map(item => {
        const importerInfo = importersMap.get(item.imported_by);
        return {
          ...item,
          importer_email: importerInfo?.email || 'Sistema',
          importer_name: importerInfo?.name || 'Sistema'
        };
      }) as ImportLogEntry[];
    },
  });

  // Query para estadísticas de importación
  const { data: importStats } = useQuery({
    queryKey: ['import-stats'],
    queryFn: async () => {
      if (!importHistory) return null;
      
      const totalImports = importHistory.length;
      const totalFiles = new Set(importHistory.map(i => i.file_name)).size;
      const totalRowsProcessed = importHistory.reduce((sum, i) => sum + i.rows_processed, 0);
      const totalRowsSuccess = importHistory.reduce((sum, i) => sum + i.rows_success, 0);
      const totalRowsFailed = importHistory.reduce((sum, i) => sum + i.rows_failed, 0);
      const successRate = totalRowsProcessed > 0 ? (totalRowsSuccess / totalRowsProcessed) * 100 : 0;
      
      const dates = importHistory.map(i => new Date(i.imported_at)).sort((a, b) => a.getTime() - b.getTime());
      const firstImport = dates.length > 0 ? dates[0].toISOString() : null;
      const lastImport = dates.length > 0 ? dates[dates.length - 1].toISOString() : null;

      return {
        total_imports: totalImports,
        total_files: totalFiles,
        total_rows_processed: totalRowsProcessed,
        total_rows_success: totalRowsSuccess,
        total_rows_failed: totalRowsFailed,
        success_rate: successRate,
        first_import: firstImport,
        last_import: lastImport
      } as ImportStats;
    },
    enabled: !!importHistory
  });

  // Filtrar importaciones
  const filteredImports = importHistory?.filter(item => {
    const matchesSearch = !searchTerm || 
      item.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batch_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.importer_email && item.importer_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.importer_name && item.importer_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    const importDate = new Date(item.imported_at);
    const now = new Date();
    
    switch (filterPeriod) {
      case 'today':
        return importDate.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return importDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return importDate >= monthAgo;
      case 'all':
      default:
        return true;
    }
  }) || [];

  const exportHistoryToCSV = () => {
    if (!filteredImports.length) return;

    const headers = [
      'Archivo',
      'Fecha de Importación',
      'Registros Procesados',
      'Registros Exitosos',
      'Registros Fallidos',
      'Tasa de Éxito (%)',
      'Importado Por (Nombre)',
      'Importado Por (Email)',
      'ID de Lote'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredImports.map(item => [
        `"${item.file_name}"`,
        `"${format(new Date(item.imported_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}"`,
        item.rows_processed,
        item.rows_success,
        item.rows_failed,
        item.rows_processed > 0 ? ((item.rows_success / item.rows_processed) * 100).toFixed(1) : '0',
        `"${item.importer_name || 'Sistema'}"`,
        `"${item.importer_email || 'Sistema'}"`,
        `"${item.batch_id}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historial_importaciones_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSuccessRate = (processed: number, success: number) => {
    if (processed === 0) return 0;
    return ((success / processed) * 100);
  };

  const getStatusColor = (processed: number, success: number, failed: number) => {
    const rate = getSuccessRate(processed, success);
    if (rate === 100) return 'text-green-600 bg-green-100';
    if (rate >= 90) return 'text-yellow-600 bg-yellow-100';
    if (failed > 0) return 'text-red-600 bg-red-100';
    return 'text-gray-600 bg-gray-100';
  };

  if (historyLoading) {
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
              Historial de Importaciones CSV
            </h2>
            <p className="text-gray-600">
              Registro completo de todas las importaciones realizadas en el sistema con información del usuario
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </button>
            <button
              onClick={exportHistoryToCSV}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Historial
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        {importStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <Database className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Total Importaciones</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {importStats.total_imports.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Registros Exitosos</p>
                  <p className="text-2xl font-bold text-green-900">
                    {importStats.total_rows_success.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-600">Tasa de Éxito</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {importStats.success_rate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-600">Archivos Únicos</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {importStats.total_files.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Importación
            </label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Archivo, lote, usuario..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las fechas</option>
              <option value="today">Hoy</option>
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterPeriod('all');
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Historial */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Historial de Importaciones ({filteredImports.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Archivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha de Importación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registros
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Éxito/Fallo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importado Por
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredImports.map((item) => {
                const successRate = getSuccessRate(item.rows_processed, item.rows_success);
                const statusColor = getStatusColor(item.rows_processed, item.rows_success, item.rows_failed);

                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        {successRate === 100 ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : item.rows_failed > 0 ? (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <Clock className="h-3 w-3 mr-1" />
                        )}
                        {successRate.toFixed(0)}% éxito
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.file_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {item.batch_id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="font-medium">
                            {format(new Date(item.imported_at), 'dd/MM/yyyy', { locale: es })}
                          </div>
                          <div className="text-gray-500">
                            {format(new Date(item.imported_at), 'HH:mm:ss', { locale: es })}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="font-medium">
                          {item.rows_processed.toLocaleString()} total
                        </div>
                        <div className="text-gray-500">
                          procesados
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="text-green-600 font-medium">
                          ✓ {item.rows_success.toLocaleString()}
                        </div>
                        {item.rows_failed > 0 && (
                          <div className="text-red-600">
                            ✗ {item.rows_failed.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="font-medium">
                            {item.importer_name || 'Sistema'}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {item.importer_email || 'Sistema'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedImport(item);
                          setShowDetails(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredImports.length === 0 && (
          <div className="p-6 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No se encontraron importaciones
            </h3>
            <p className="text-gray-600">
              {importHistory?.length === 0 
                ? 'Aún no se han realizado importaciones de CSV.'
                : 'Ajusta los filtros para ver más resultados.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Modal de Detalles */}
      {showDetails && selectedImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Detalles de Importación
                </h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Información del Archivo
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Nombre:</span>
                      <span className="ml-2 font-medium">{selectedImport.file_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ID de Lote:</span>
                      <span className="ml-2 font-mono text-xs">{selectedImport.batch_id}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Fecha:</span>
                      <span className="ml-2">
                        {format(new Date(selectedImport.imported_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Usuario que Importó
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Nombre:</span>
                      <span className="ml-2 font-medium">{selectedImport.importer_name || 'Sistema'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2">{selectedImport.importer_email || 'Sistema'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ID Usuario:</span>
                      <span className="ml-2 font-mono text-xs">{selectedImport.imported_by || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Estadísticas de Procesamiento
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Total procesados:</span>
                      <span className="ml-2 font-medium">{selectedImport.rows_processed.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Exitosos:</span>
                      <span className="ml-2 text-green-600 font-medium">{selectedImport.rows_success.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Fallidos:</span>
                      <span className="ml-2 text-red-600 font-medium">{selectedImport.rows_failed.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tasa de éxito:</span>
                      <span className="ml-2 font-medium">
                        {getSuccessRate(selectedImport.rows_processed, selectedImport.rows_success).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedImport.error_details && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Detalles de Errores
                  </h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <pre className="text-xs text-red-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {JSON.stringify(selectedImport.error_details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}