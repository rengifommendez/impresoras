import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Monitor, 
  Plus, 
  Edit3, 
  Save, 
  X, 
  Building, 
  Users, 
  Search,
  Filter,
  UserPlus,
  UserMinus,
  CheckCircle,
  AlertCircle,
  Wifi,
  MapPin,
  Settings,
  Activity,
  Eye,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Printer {
  id: string;
  name: string;
  ip_address: string;
  model: string;
  office: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
  location_details?: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  full_name?: string;
  office?: string;
  department?: string;
  status: string;
}

interface UserPrinterAssignment {
  id: string;
  user_id: string;
  printer_id: string;
  assigned_at: string;
  assigned_by?: string;
  is_primary: boolean;
  notes?: string;
  user?: User;
}

interface NewPrinter {
  name: string;
  ip_address: string;
  model: string;
  office: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
  location_details: string;
}

interface EditingPrinter extends Printer {
  isEditing: boolean;
}

export function PrinterManagement() {
  const { isAdmin } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPrinters, setEditingPrinters] = useState<{ [key: string]: EditingPrinter }>({});
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Estados para asignación de usuarios
  const [showUserAssignment, setShowUserAssignment] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userFilterOffice, setUserFilterOffice] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showOnlySelectedOffice, setShowOnlySelectedOffice] = useState(false);
  
  const [newPrinter, setNewPrinter] = useState<NewPrinter>({
    name: '',
    ip_address: '',
    model: '',
    office: '',
    status: 'Active',
    location_details: ''
  });

  const queryClient = useQueryClient();

  // Query para obtener impresoras
  const { data: printers, isLoading: printersLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Printer[];
    },
  });

  // Query para obtener usuarios
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('status', 'Normal')
        .order('full_name');
      
      if (error) throw error;
      return data as User[];
    },
  });

  // Query para obtener asignaciones
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['printer-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_printer_assignments')
        .select(`
          *,
          user:users(*)
        `)
        .order('assigned_at', { ascending: false });
      
      if (error) throw error;
      return data as UserPrinterAssignment[];
    },
  });

  // Query para obtener oficinas únicas
  const { data: offices } = useQuery({
    queryKey: ['offices-printers'],
    queryFn: async () => {
      if (!printers && !users) return [];
      
      const printerOffices = printers?.map(p => p.office).filter(Boolean) || [];
      const userOffices = users?.map(u => u.office).filter(Boolean) || [];
      const allOffices = [...new Set([...printerOffices, ...userOffices])];
      
      return allOffices.sort();
    },
    enabled: !!printers || !!users
  });

  // Mutations
  const addPrinterMutation = useMutation({
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

  const updatePrinterMutation = useMutation({
    mutationFn: async ({ id, isEditing, ...updates }: Partial<EditingPrinter> & { id: string }) => {
      // Remove isEditing from the updates object before sending to Supabase
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

  const assignUsersMutation = useMutation({
    mutationFn: async ({ printerId, userIds }: { printerId: string; userIds: string[] }) => {
      // Primero eliminar asignaciones existentes para esta impresora
      const { error: deleteError } = await supabase
        .from('user_printer_assignments')
        .delete()
        .eq('printer_id', printerId);
      
      if (deleteError) throw deleteError;

      // Luego agregar las nuevas asignaciones
      if (userIds.length > 0) {
        const assignments = userIds.map(userId => ({
          user_id: userId,
          printer_id: printerId,
          is_primary: false
        }));

        const { error: insertError } = await supabase
          .from('user_printer_assignments')
          .insert(assignments);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-assignments'] });
      setShowUserAssignment(null);
      setSelectedUsers(new Set());
      setUserSearchTerm('');
      setUserFilterOffice('');
      setShowOnlySelectedOffice(false);
    }
  });

  const removeUserAssignmentMutation = useMutation({
    mutationFn: async ({ assignmentId }: { assignmentId: string }) => {
      const { error } = await supabase
        .from('user_printer_assignments')
        .delete()
        .eq('id', assignmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-assignments'] });
    }
  });

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

  // Filtrar usuarios para asignación
  const filteredUsers = users?.filter(user => {
    const matchesSearch = !userSearchTerm || 
      (user.full_name && user.full_name.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
      user.id.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      (user.office && user.office.toLowerCase().includes(userSearchTerm.toLowerCase()));
    
    const matchesOffice = !userFilterOffice || 
      (userFilterOffice === 'Sin oficina' ? !user.office : user.office === userFilterOffice);
    
    // Si está activado "mostrar solo oficina seleccionada", filtrar por la oficina de la impresora
    if (showOnlySelectedOffice && showUserAssignment) {
      const printer = printers?.find(p => p.id === showUserAssignment);
      if (printer && printer.office) {
        return matchesSearch && matchesOffice && user.office === printer.office;
      }
    }
    
    return matchesSearch && matchesOffice;
  }) || [];

  // Obtener usuarios asignados a una impresora
  const getUsersForPrinter = (printerId: string) => {
    return assignments?.filter(a => a.printer_id === printerId) || [];
  };

  // Funciones de edición de impresoras
  const startEditingPrinter = (printer: Printer) => {
    setEditingPrinters(prev => ({
      ...prev,
      [printer.id]: { ...printer, isEditing: true }
    }));
  };

  const cancelEditingPrinter = (printerId: string) => {
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
      await updatePrinterMutation.mutateAsync(editingPrinter);
    } catch (error) {
      console.error('Error updating printer:', error);
    }
  };

  const updateEditingPrinter = (printerId: string, field: keyof Printer, value: string) => {
    setEditingPrinters(prev => ({
      ...prev,
      [printerId]: {
        ...prev[printerId],
        [field]: value
      }
    }));
  };

  // Manejar selección de usuarios
  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const selectAllUsersFromOffice = (office: string) => {
    const usersFromOffice = filteredUsers.filter(user => user.office === office);
    const newSelected = new Set(selectedUsers);
    
    // Si todos los usuarios de la oficina ya están seleccionados, deseleccionarlos
    const allSelected = usersFromOffice.every(user => newSelected.has(user.id));
    
    if (allSelected) {
      usersFromOffice.forEach(user => newSelected.delete(user.id));
    } else {
      usersFromOffice.forEach(user => newSelected.add(user.id));
    }
    
    setSelectedUsers(newSelected);
  };

  const handleAssignUsers = () => {
    if (showUserAssignment && selectedUsers.size > 0) {
      assignUsersMutation.mutate({
        printerId: showUserAssignment,
        userIds: Array.from(selectedUsers)
      });
    }
  };

  const startUserAssignment = (printerId: string) => {
    setShowUserAssignment(printerId);
    // Pre-seleccionar usuarios ya asignados
    const currentAssignments = getUsersForPrinter(printerId);
    setSelectedUsers(new Set(currentAssignments.map(a => a.user_id)));
    
    // Auto-filtrar por la oficina de la impresora
    const printer = printers?.find(p => p.id === printerId);
    if (printer?.office) {
      setUserFilterOffice(printer.office);
      setShowOnlySelectedOffice(true);
    }
  };

  const removeUserFromPrinter = async (assignmentId: string) => {
    if (confirm('¿Está seguro de que desea quitar este usuario de la impresora?')) {
      try {
        await removeUserAssignmentMutation.mutateAsync({ assignmentId });
      } catch (error) {
        console.error('Error removing user assignment:', error);
      }
    }
  };

  // Agrupar usuarios por oficina para mejor visualización
  const usersByOffice = filteredUsers.reduce((acc, user) => {
    const office = user.office || 'Sin oficina';
    if (!acc[office]) {
      acc[office] = [];
    }
    acc[office].push(user);
    return acc;
  }, {} as Record<string, User[]>);

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

  if (!isAdmin()) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700">
            Solo los administradores pueden gestionar impresoras.
          </p>
        </div>
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
              <Monitor className="h-8 w-8 text-blue-600" />
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
                  {assignments?.length || 0}
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

      {/* Lista de Impresoras */}
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
                  Usuarios Asignados
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPrinters.map((printer) => {
                const StatusIcon = getStatusIcon(printer.status);
                const assignedUsers = getUsersForPrinter(printer.id);
                const isEditing = editingPrinters[printer.id]?.isEditing;
                const editingPrinter = editingPrinters[printer.id] || printer;

                return (
                  <tr key={printer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(printer.status)}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {printer.status === 'Active' ? 'Activa' : 
                         printer.status === 'Inactive' ? 'Inactiva' : 'Mantenimiento'}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Monitor className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingPrinter.name}
                              onChange={(e) => updateEditingPrinter(printer.id, 'name', e.target.value)}
                              className="text-sm font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 w-full"
                            />
                          ) : (
                            <div className="text-sm font-medium text-gray-900">
                              {printer.name}
                            </div>
                          )}
                          {printer.location_details && !isEditing && (
                            <div className="text-sm text-gray-500">
                              {printer.location_details}
                            </div>
                          )}
                          {isEditing && (
                            <input
                              type="text"
                              value={editingPrinter.location_details || ''}
                              onChange={(e) => updateEditingPrinter(printer.id, 'location_details', e.target.value)}
                              placeholder="Detalles de ubicación"
                              className="text-sm text-gray-500 border border-gray-300 rounded px-2 py-1 w-full mt-1"
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
                            className="border border-gray-300 rounded px-2 py-1"
                          />
                        ) : (
                          printer.ip_address
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingPrinter.model}
                          onChange={(e) => updateEditingPrinter(printer.id, 'model', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-full"
                        />
                      ) : (
                        printer.model
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Building className="h-4 w-4 text-gray-400 mr-2" />
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingPrinter.office}
                            onChange={(e) => updateEditingPrinter(printer.id, 'office', e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1"
                          />
                        ) : (
                          printer.office
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Users className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="font-medium">{assignedUsers.length}</span>
                        <span className="text-gray-500 ml-1">usuarios</span>
                        {assignedUsers.length > 0 && (
                          <div className="ml-2">
                            <button
                              onClick={() => setSelectedPrinter(selectedPrinter === printer.id ? null : printer.id)}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              {selectedPrinter === printer.id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Lista expandible de usuarios asignados */}
                      {selectedPrinter === printer.id && assignedUsers.length > 0 && (
                        <div className="mt-2 p-2 bg-gray-50 rounded border">
                          <div className="space-y-1">
                            {assignedUsers.map((assignment) => (
                              <div key={assignment.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700">
                                  {assignment.user?.full_name || assignment.user_id}
                                </span>
                                <button
                                  onClick={() => removeUserFromPrinter(assignment.id)}
                                  className="text-red-600 hover:text-red-800 ml-2"
                                  title="Quitar usuario"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
                            onClick={() => cancelEditingPrinter(printer.id)}
                            disabled={updatePrinterMutation.isPending}
                            className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                            title="Cancelar edición"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => startUserAssignment(printer.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Gestionar usuarios asignados"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => startEditingPrinter(printer)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Editar impresora"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPrinters.length === 0 && (
          <div className="p-6 text-center">
            <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No se encontraron impresoras
            </h3>
            <p className="text-gray-600">
              Ajusta los filtros para ver más resultados.
            </p>
          </div>
        )}
      </div>

      {/* Modal de Asignación de Usuarios */}
      {showUserAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Gestionar Usuarios Asignados
                </h3>
                <button
                  onClick={() => {
                    setShowUserAssignment(null);
                    setSelectedUsers(new Set());
                    setUserSearchTerm('');
                    setUserFilterOffice('');
                    setShowOnlySelectedOffice(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {/* Información de la impresora */}
              {(() => {
                const printer = printers?.find(p => p.id === showUserAssignment);
                return printer ? (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center">
                      <Monitor className="h-5 w-5 text-blue-600 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          {printer.name} - {printer.office}
                        </p>
                        <p className="text-sm text-blue-700">
                          {printer.model} ({printer.ip_address})
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            <div className="p-6">
              {/* Filtros de usuarios */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buscar Usuario
                  </label>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      placeholder="Nombre, ID u oficina..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filtrar por Oficina
                  </label>
                  <select
                    value={userFilterOffice}
                    onChange={(e) => setUserFilterOffice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas las oficinas</option>
                    {offices?.map(office => (
                      <option key={office} value={office}>{office}</option>
                    ))}
                    <option value="Sin oficina">Sin oficina</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showOnlySelectedOffice}
                      onChange={(e) => setShowOnlySelectedOffice(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Solo oficina de impresora
                    </span>
                  </label>
                </div>
              </div>

              {/* Información de selección */}
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-sm text-green-700">
                      <strong>{selectedUsers.size}</strong> usuarios seleccionados
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedUsers(new Set())}
                    className="text-sm text-green-600 hover:text-green-800"
                  >
                    Limpiar selección
                  </button>
                </div>
              </div>

              {/* Lista de usuarios agrupados por oficina */}
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                {Object.entries(usersByOffice).map(([office, officeUsers]) => (
                  <div key={office} className="border-b border-gray-200 last:border-b-0">
                    {/* Header de oficina */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Building className="h-4 w-4 text-gray-600 mr-2" />
                          <span className="font-medium text-gray-900">{office}</span>
                          <span className="ml-2 text-sm text-gray-500">
                            ({officeUsers.length} usuarios)
                          </span>
                        </div>
                        <button
                          onClick={() => selectAllUsersFromOffice(office)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {officeUsers.every(user => selectedUsers.has(user.id)) 
                            ? 'Deseleccionar todos' 
                            : 'Seleccionar todos'
                          }
                        </button>
                      </div>
                    </div>

                    {/* Usuarios de la oficina */}
                    <div className="divide-y divide-gray-100">
                      {officeUsers.map((user) => (
                        <div key={user.id} className="px-4 py-3 hover:bg-gray-50">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedUsers.has(user.id)}
                              onChange={() => toggleUserSelection(user.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.full_name || 'Sin nombre'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    ID: {user.id}
                                    {user.department && ` • ${user.department}`}
                                  </div>
                                </div>
                                {selectedUsers.has(user.id) && (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                )}
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(usersByOffice).length === 0 && (
                <div className="p-6 text-center border border-gray-200 rounded-lg">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No se encontraron usuarios
                  </h3>
                  <p className="text-gray-600">
                    Ajusta los filtros para ver más usuarios.
                  </p>
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowUserAssignment(null);
                    setSelectedUsers(new Set());
                    setUserSearchTerm('');
                    setUserFilterOffice('');
                    setShowOnlySelectedOffice(false);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAssignUsers}
                  disabled={assignUsersMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {assignUsersMutation.isPending ? (
                    <div className="flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Guardando...
                    </div>
                  ) : (
                    `Guardar Asignaciones (${selectedUsers.size})`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agregar Impresora */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
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
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              addPrinterMutation.mutate(newPrinter);
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Impresora
                </label>
                <input
                  type="text"
                  required
                  value={newPrinter.name}
                  onChange={(e) => setNewPrinter(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Impresora Color Oficina Central"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección IP
                </label>
                <input
                  type="text"
                  required
                  value={newPrinter.ip_address}
                  onChange={(e) => setNewPrinter(prev => ({ ...prev, ip_address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="192.168.1.100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modelo
                </label>
                <input
                  type="text"
                  required
                  value={newPrinter.model}
                  onChange={(e) => setNewPrinter(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Canon imageCLASS MF644Cdw"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Oficina
                </label>
                <input
                  type="text"
                  required
                  value={newPrinter.office}
                  onChange={(e) => setNewPrinter(prev => ({ ...prev, office: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Oficina Central"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Detalles de Ubicación
                </label>
                <input
                  type="text"
                  value={newPrinter.location_details}
                  onChange={(e) => setNewPrinter(prev => ({ ...prev, location_details: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Segundo piso, área de diseño"
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

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addPrinterMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {addPrinterMutation.isPending ? (
                    <div className="flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Agregando...
                    </div>
                  ) : (
                    'Agregar Impresora'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}