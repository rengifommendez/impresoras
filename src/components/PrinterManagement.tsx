import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Printer, 
  Plus, 
  Edit3, 
  Save, 
  X, 
  Building, 
  Users, 
  Search,
  Filter,
  Wifi,
  AlertCircle,
  CheckCircle,
  Settings,
  Monitor,
  UserPlus,
  Trash2,
  Eye,
  MapPin,
  Activity,
  UserCheck,
  UserX,
  Crown,
  Star,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Target
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PrinterData {
  id: string;
  name: string;
  ip_address: string;
  model: string;
  office: string | null;
  status: 'Active' | 'Inactive' | 'Maintenance';
  location_details: string | null;
  user_count: number;
  created_at: string;
}

interface UserAssignment {
  user_id: string;
  full_name: string | null;
  email: string | null;
  office: string | null;
  department: string | null;
  is_primary: boolean;
  assigned_at: string;
  notes: string | null;
}

interface NewPrinter {
  name: string;
  ip_address: string;
  model: string;
  office: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
  location_details: string;
}

interface EditingPrinter extends PrinterData {
  isEditing: boolean;
}

interface AvailableUser {
  id: string;
  full_name: string | null;
  email: string | null;
  office: string | null;
  department: string | null;
  status: string;
}

export function PrinterManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPrinters, setEditingPrinters] = useState<{ [key: string]: EditingPrinter }>({});
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [showAssignments, setShowAssignments] = useState(false);
  const [showQuickAssign, setShowQuickAssign] = useState<string | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [bulkAssignMode, setBulkAssignMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [newPrinter, setNewPrinter] = useState<NewPrinter>({
    name: '',
    ip_address: '',
    model: '',
    office: '',
    status: 'Active',
    location_details: ''
  });

  const queryClient = useQueryClient();

  // Query para obtener todas las impresoras
  const { data: printers, isLoading: printersLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('printers_by_office');
      if (error) throw error;
      return data as PrinterData[];
    },
  });

  // Query para obtener oficinas únicas
  const { data: offices } = useQuery({
    queryKey: ['offices-printers'],
    queryFn: async () => {
      if (!printers) return [];
      const uniqueOffices = [...new Set(printers.map(p => p.office).filter(Boolean))];
      return uniqueOffices.sort();
    },
    enabled: !!printers
  });

  // Query para obtener usuarios disponibles
  const { data: availableUsers } = useQuery({
    queryKey: ['available-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, office, department, status')
        .order('full_name');
      if (error) throw error;
      return data as AvailableUser[];
    },
  });

  // Query para obtener asignaciones de la impresora seleccionada
  const { data: userAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-assignments', selectedPrinter],
    queryFn: async () => {
      if (!selectedPrinter) return [];
      const { data, error } = await supabase.rpc('users_by_printer', {
        target_printer_id: selectedPrinter
      });
      if (error) throw error;
      return data as UserAssignment[];
    },
    enabled: !!selectedPrinter
  });

  // Mutation para crear impresora
  const createPrinterMutation = useMutation({
    mutationFn: async (printer: NewPrinter) => {
      const { error } = await supabase
        .from('printers')
        .insert(printer);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
      setShowAddForm(false);
      setNewPrinter({
        name: '',
        ip_address: '',
        model: '',
        office: '',
        status: 'Active',
        location_details: ''
      });
    }
  });

  // Mutation para actualizar impresora
  const updatePrinterMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PrinterData> & { id: string }) => {
      const { error } = await supabase
        .from('printers')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
      setEditingPrinters({});
    }
  });

  // Mutation para asignar usuario a impresora
  const assignUserMutation = useMutation({
    mutationFn: async ({ userId, printerId, isPrimary, notes }: {
      userId: string;
      printerId: string;
      isPrimary: boolean;
      notes?: string;
    }) => {
      // Si es asignación principal, primero quitar la asignación principal existente
      if (isPrimary) {
        await supabase
          .from('user_printer_assignments')
          .update({ is_primary: false })
          .eq('printer_id', printerId)
          .eq('is_primary', true);
      }

      const { error } = await supabase
        .from('user_printer_assignments')
        .insert({
          user_id: userId,
          printer_id: printerId,
          is_primary: isPrimary,
          notes: notes || null
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['printers'] });
      setShowQuickAssign(null);
    }
  });

  // Mutation para asignación masiva
  const bulkAssignMutation = useMutation({
    mutationFn: async ({ userIds, printerId }: { userIds: string[]; printerId: string }) => {
      const assignments = userIds.map(userId => ({
        user_id: userId,
        printer_id: printerId,
        is_primary: false,
        notes: `Asignación masiva - ${new Date().toLocaleDateString()}`
      }));

      const { error } = await supabase
        .from('user_printer_assignments')
        .insert(assignments);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['printers'] });
      setBulkAssignMode(false);
      setSelectedUsers(new Set());
    }
  });

  // Mutation para eliminar asignación
  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ userId, printerId }: { userId: string; printerId: string }) => {
      const { error } = await supabase
        .from('user_printer_assignments')
        .delete()
        .eq('user_id', userId)
        .eq('printer_id', printerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['printers'] });
    }
  });

  // Mutation para cambiar usuario principal
  const setPrimaryUserMutation = useMutation({
    mutationFn: async ({ userId, printerId }: { userId: string; printerId: string }) => {
      // Primero quitar todas las asignaciones principales de esta impresora
      await supabase
        .from('user_printer_assignments')
        .update({ is_primary: false })
        .eq('printer_id', printerId);

      // Luego establecer el nuevo usuario principal
      const { error } = await supabase
        .from('user_printer_assignments')
        .update({ is_primary: true })
        .eq('user_id', userId)
        .eq('printer_id', printerId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-assignments'] });
    }
  });

  // Funciones para manejar la edición
  const startEditing = (printer: PrinterData) => {
    setEditingPrinters(prev => ({
      ...prev,
      [printer.id]: { ...printer, isEditing: true }
    }));
  };

  const cancelEditing = (printerId: string) => {
    setEditingPrinters(prev => {
      const newState = { ...prev };
      delete newState[printerId];
      return newState;
    });
  };

  const savePrinter = async (printerId: string) => {
    const editingPrinter = editingPrinters[printerId];
    if (!editingPrinter) return;

    try {
      await updatePrinterMutation.mutateAsync({
        id: printerId,
        name: editingPrinter.name,
        ip_address: editingPrinter.ip_address,
        model: editingPrinter.model,
        office: editingPrinter.office,
        status: editingPrinter.status,
        location_details: editingPrinter.location_details
      });
      cancelEditing(printerId);
    } catch (error) {
      console.error('Error updating printer:', error);
    }
  };

  const updateEditingPrinter = (printerId: string, field: keyof PrinterData, value: string) => {
    setEditingPrinters(prev => ({
      ...prev,
      [printerId]: {
        ...prev[printerId],
        [field]: value
      }
    }));
  };

  // Filtrar impresoras
  const filteredPrinters = printers?.filter(printer => {
    const matchesSearch = !searchTerm || 
      printer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      printer.ip_address.includes(searchTerm) ||
      printer.model.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesOffice = !filterOffice || printer.office === filterOffice;
    const matchesStatus = !filterStatus || printer.status === filterStatus;
    
    return matchesSearch && matchesOffice && matchesStatus;
  }) || [];

  // Filtrar usuarios disponibles para asignación
  const getAvailableUsersForPrinter = (printerId: string) => {
    if (!availableUsers) return [];
    
    const assignedUserIds = userAssignments?.map(ua => ua.user_id) || [];
    const available = availableUsers.filter(user => 
      !assignedUserIds.includes(user.id) &&
      (!assignmentSearch || 
        user.full_name?.toLowerCase().includes(assignmentSearch.toLowerCase()) ||
        user.id.toLowerCase().includes(assignmentSearch.toLowerCase()) ||
        user.email?.toLowerCase().includes(assignmentSearch.toLowerCase())
      )
    );

    return available;
  };

  const handleQuickAssign = (userId: string, printerId: string, isPrimary: boolean = false) => {
    assignUserMutation.mutate({
      userId,
      printerId,
      isPrimary,
      notes: `Asignación rápida - ${new Date().toLocaleDateString()}`
    });
  };

  const handleBulkAssign = (printerId: string) => {
    if (selectedUsers.size === 0) return;
    
    bulkAssignMutation.mutate({
      userIds: Array.from(selectedUsers),
      printerId
    });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'text-green-600 bg-green-100';
      case 'Inactive': return 'text-red-600 bg-red-100';
      case 'Maintenance': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active': return CheckCircle;
      case 'Inactive': return X;
      case 'Maintenance': return Settings;
      default: return AlertCircle;
    }
  };

  const handleCreatePrinter = (e: React.FormEvent) => {
    e.preventDefault();
    createPrinterMutation.mutate(newPrinter);
  };

  if (printersLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm h-32"></div>
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
              Gestión de Impresoras
            </h2>
            <p className="text-gray-600">
              Administrar impresoras por oficina y asignar usuarios
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Impresora
          </button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <Printer className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Total Impresoras</p>
                <p className="text-2xl font-bold text-blue-900">
                  {printers?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Activas</p>
                <p className="text-2xl font-bold text-green-900">
                  {printers?.filter(p => p.status === 'Active').length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center">
              <Building className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-600">Oficinas</p>
                <p className="text-2xl font-bold text-purple-900">
                  {offices?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-600">Asignaciones</p>
                <p className="text-2xl font-bold text-orange-900">
                  {printers?.reduce((sum, p) => sum + p.user_count, 0) || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Impresora
            </label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nombre, IP o modelo..."
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
              <option value="Active">Activa</option>
              <option value="Inactive">Inactiva</option>
              <option value="Maintenance">Mantenimiento</option>
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

      {/* Formulario de nueva impresora */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Agregar Nueva Impresora
            </h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleCreatePrinter} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de la Impresora *
              </label>
              <input
                type="text"
                required
                value={newPrinter.name}
                onChange={(e) => setNewPrinter(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Impresora Principal Oficina"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección IP *
              </label>
              <input
                type="text"
                required
                value={newPrinter.ip_address}
                onChange={(e) => setNewPrinter(prev => ({ ...prev, ip_address: e.target.value }))}
                placeholder="192.168.1.100"
                pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modelo *
              </label>
              <input
                type="text"
                required
                value={newPrinter.model}
                onChange={(e) => setNewPrinter(prev => ({ ...prev, model: e.target.value }))}
                placeholder="HP LaserJet Pro M404dn"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Oficina *
              </label>
              <input
                type="text"
                required
                value={newPrinter.office}
                onChange={(e) => setNewPrinter(prev => ({ ...prev, office: e.target.value }))}
                placeholder="Oficina Central"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={newPrinter.status}
                onChange={(e) => setNewPrinter(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Active">Activa</option>
                <option value="Inactive">Inactiva</option>
                <option value="Maintenance">Mantenimiento</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detalles de Ubicación
              </label>
              <input
                type="text"
                value={newPrinter.location_details}
                onChange={(e) => setNewPrinter(prev => ({ ...prev, location_details: e.target.value }))}
                placeholder="Primer piso, área de administración"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createPrinterMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createPrinterMutation.isPending ? 'Creando...' : 'Crear Impresora'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de impresoras */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Impresoras ({filteredPrinters.length})
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
                  Impresora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dirección IP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modelo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Oficina
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuarios
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPrinters.map((printer) => {
                const StatusIcon = getStatusIcon(printer.status);
                const isEditing = editingPrinters[printer.id]?.isEditing;
                const editingPrinter = editingPrinters[printer.id] || printer;
                const isQuickAssigning = showQuickAssign === printer.id;

                return (
                  <React.Fragment key={printer.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <select
                            value={editingPrinter.status}
                            onChange={(e) => updateEditingPrinter(printer.id, 'status', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Active">Activa</option>
                            <option value="Inactive">Inactiva</option>
                            <option value="Maintenance">Mantenimiento</option>
                          </select>
                        ) : (
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(printer.status)}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {printer.status === 'Active' ? 'Activa' : 
                             printer.status === 'Inactive' ? 'Inactiva' : 'Mantenimiento'}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Printer className="h-8 w-8 text-gray-400 mr-3" />
                          <div>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingPrinter.name}
                                onChange={(e) => updateEditingPrinter(printer.id, 'name', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <div className="text-sm font-medium text-gray-900">
                                {printer.name}
                              </div>
                            )}
                            {printer.location_details && !isEditing && (
                              <div className="text-sm text-gray-500 flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                {printer.location_details}
                              </div>
                            )}
                            {isEditing && (
                              <input
                                type="text"
                                value={editingPrinter.location_details || ''}
                                onChange={(e) => updateEditingPrinter(printer.id, 'location_details', e.target.value)}
                                placeholder="Ubicación"
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                              />
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Wifi className="h-4 w-4 text-gray-400 mr-2" />
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingPrinter.ip_address}
                              onChange={(e) => updateEditingPrinter(printer.id, 'ip_address', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            printer.ip_address
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Monitor className="h-4 w-4 text-gray-400 mr-2" />
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingPrinter.model}
                              onChange={(e) => updateEditingPrinter(printer.id, 'model', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            printer.model
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Building className="h-4 w-4 text-gray-400 mr-2" />
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingPrinter.office || ''}
                              onChange={(e) => updateEditingPrinter(printer.id, 'office', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            printer.office || 'Sin oficina'
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-gray-900">
                            <Users className="h-4 w-4 text-gray-400 mr-2" />
                            <span className={`font-medium ${printer.user_count > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                              {printer.user_count} usuario{printer.user_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {!isEditing && printer.status === 'Active' && (
                            <button
                              onClick={() => setShowQuickAssign(isQuickAssigning ? null : printer.id)}
                              className="text-blue-600 hover:text-blue-900 text-xs"
                              title="Asignación rápida"
                            >
                              <UserPlus className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {isEditing ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => savePrinter(printer.id)}
                              disabled={updatePrinterMutation.isPending}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              title="Guardar cambios"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => cancelEditing(printer.id)}
                              disabled={updatePrinterMutation.isPending}
                              className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                              title="Cancelar"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedPrinter(printer.id);
                                setShowAssignments(true);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                              title="Gestionar asignaciones"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => startEditing(printer)}
                              className="text-green-600 hover:text-green-900"
                              title="Editar impresora"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Fila de asignación rápida */}
                    {isQuickAssigning && (
                      <tr className="bg-blue-50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-900">
                                Asignación Rápida - {printer.name}
                              </h4>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => setBulkAssignMode(!bulkAssignMode)}
                                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                                    bulkAssignMode 
                                      ? 'bg-purple-100 text-purple-700' 
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {bulkAssignMode ? 'Cancelar Masivo' : 'Asignación Masiva'}
                                </button>
                                {bulkAssignMode && selectedUsers.size > 0 && (
                                  <button
                                    onClick={() => handleBulkAssign(printer.id)}
                                    disabled={bulkAssignMutation.isPending}
                                    className="text-xs px-3 py-1 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50"
                                  >
                                    Asignar {selectedUsers.size} usuarios
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="relative">
                              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                value={assignmentSearch}
                                onChange={(e) => setAssignmentSearch(e.target.value)}
                                placeholder="Buscar usuarios disponibles..."
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                              {getAvailableUsersForPrinter(printer.id).map((user) => (
                                <div 
                                  key={user.id} 
                                  className={`p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                                    bulkAssignMode && selectedUsers.has(user.id) 
                                      ? 'border-purple-300 bg-purple-50' 
                                      : 'border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      {bulkAssignMode && (
                                        <input
                                          type="checkbox"
                                          checked={selectedUsers.has(user.id)}
                                          onChange={() => toggleUserSelection(user.id)}
                                          className="mr-3 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                        />
                                      )}
                                      <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                        <Users className="h-4 w-4 text-gray-600" />
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-900">
                                          {user.full_name || 'Sin nombre'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          ID: {user.id} • {user.office || 'Sin oficina'}
                                        </div>
                                      </div>
                                    </div>
                                    {!bulkAssignMode && (
                                      <div className="flex space-x-1">
                                        <button
                                          onClick={() => handleQuickAssign(user.id, printer.id, false)}
                                          disabled={assignUserMutation.isPending}
                                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                          title="Asignar como usuario regular"
                                        >
                                          <UserCheck className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={() => handleQuickAssign(user.id, printer.id, true)}
                                          disabled={assignUserMutation.isPending}
                                          className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                                          title="Asignar como usuario principal"
                                        >
                                          <Crown className="h-3 w-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {getAvailableUsersForPrinter(printer.id).length === 0 && (
                              <div className="text-center py-4 text-gray-500">
                                <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                <p className="text-sm">No hay usuarios disponibles para asignar</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPrinters.length === 0 && (
          <div className="p-6 text-center">
            <Printer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No se encontraron impresoras
            </h3>
            <p className="text-gray-600">
              Ajusta los filtros o agrega una nueva impresora.
            </p>
          </div>
        )}
      </div>

      {/* Modal de gestión avanzada de asignaciones */}
      {showAssignments && selectedPrinter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Gestión Avanzada de Asignaciones
                </h3>
                <button
                  onClick={() => {
                    setShowAssignments(false);
                    setSelectedPrinter(null);
                    setAssignmentSearch('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Usuarios asignados */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">
                    Usuarios Asignados ({userAssignments?.length || 0})
                  </h4>
                  
                  {assignmentsLoading ? (
                    <div className="animate-pulse space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-200 rounded"></div>
                      ))}
                    </div>
                  ) : userAssignments && userAssignments.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {userAssignments.map((assignment) => (
                        <div key={assignment.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                          <div className="flex items-center">
                            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              {assignment.is_primary ? (
                                <Crown className="h-5 w-5 text-yellow-600" />
                              ) : (
                                <Users className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 flex items-center">
                                {assignment.full_name || 'Sin nombre'}
                                {assignment.is_primary && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    <Star className="h-3 w-3 mr-1" />
                                    Principal
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {assignment.user_id} • {assignment.office || 'Sin oficina'}
                              </div>
                              {assignment.notes && (
                                <div className="text-xs text-gray-400 mt-1">
                                  {assignment.notes}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            {!assignment.is_primary && (
                              <button
                                onClick={() => setPrimaryUserMutation.mutate({
                                  userId: assignment.user_id,
                                  printerId: selectedPrinter
                                })}
                                disabled={setPrimaryUserMutation.isPending}
                                className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                                title="Establecer como principal"
                              >
                                <Crown className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => removeAssignmentMutation.mutate({
                                userId: assignment.user_id,
                                printerId: selectedPrinter
                              })}
                              disabled={removeAssignmentMutation.isPending}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title="Remover asignación"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <UserX className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-sm">No hay usuarios asignados a esta impresora</p>
                    </div>
                  )}
                </div>

                {/* Usuarios disponibles */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">
                    Usuarios Disponibles
                  </h4>
                  
                  <div className="relative mb-4">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={assignmentSearch}
                      onChange={(e) => setAssignmentSearch(e.target.value)}
                      placeholder="Buscar usuarios..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {getAvailableUsersForPrinter(selectedPrinter).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center">
                          <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                            <Users className="h-4 w-4 text-gray-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.full_name || 'Sin nombre'}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {user.id} • {user.office || 'Sin oficina'}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => assignUserMutation.mutate({
                              userId: user.id,
                              printerId: selectedPrinter,
                              isPrimary: false,
                              notes: `Asignado desde gestión avanzada - ${new Date().toLocaleDateString()}`
                            })}
                            disabled={assignUserMutation.isPending}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            title="Asignar como usuario regular"
                          >
                            <UserCheck className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => assignUserMutation.mutate({
                              userId: user.id,
                              printerId: selectedPrinter,
                              isPrimary: true,
                              notes: `Asignado como principal - ${new Date().toLocaleDateString()}`
                            })}
                            disabled={assignUserMutation.isPending}
                            className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                            title="Asignar como usuario principal"
                          >
                            <Crown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {getAvailableUsersForPrinter(selectedPrinter).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Target className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-sm">
                        {assignmentSearch 
                          ? 'No se encontraron usuarios con ese criterio'
                          : 'Todos los usuarios ya están asignados'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}