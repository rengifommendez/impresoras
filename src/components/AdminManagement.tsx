import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Shield, 
  User, 
  Edit3, 
  Save, 
  X, 
  Eye, 
  EyeOff,
  Mail, 
  AlertCircle,
  CheckCircle,
  Crown,
  UserCheck,
  Lock,
  Plus,
  UserPlus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
}

interface EditingAdmin {
  id: string;
  email: string;
  full_name: string;
  newPassword?: string;
  isEditing: boolean;
}

interface NewAdmin {
  email: string;
  full_name: string;
  password: string;
}

interface UpdateResult {
  success: boolean;
  message: string;
}

interface CreateResult {
  success: boolean;
  message: string;
  userId?: string;
}

export function AdminManagement() {
  const { isAdmin, user } = useAuth();
  const [editingAdmins, setEditingAdmins] = useState<{ [key: string]: EditingAdmin }>({});
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [updateResults, setUpdateResults] = useState<{ [key: string]: UpdateResult }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [newAdmin, setNewAdmin] = useState<NewAdmin>({
    email: '',
    full_name: '',
    password: ''
  });
  
  const queryClient = useQueryClient();

  // Query para obtener usuarios administradores
  const { data: adminUsers, isLoading: adminsLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      try {
        // Obtener usuarios de auth con rol admin
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No hay sesión activa');
        }

        // Llamar a la función edge para obtener usuarios admin
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-admin-users`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`Error obteniendo administradores: ${response.status}`);
        }

        const result = await response.json();
        return result.users as AdminUser[];

      } catch (error) {
        console.error('Error obteniendo usuarios admin:', error);
        throw error;
      }
    },
    enabled: isAdmin()
  });

  // Mutation para crear nuevo administrador
  const createAdminMutation = useMutation({
    mutationFn: async (adminData: NewAdmin): Promise<CreateResult> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No hay sesión activa');
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: adminData.email,
            full_name: adminData.full_name,
            password: adminData.password,
            role: 'admin',
            status: 'Normal',
            office: 'Administración',
            department: 'IT'
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || `Error HTTP: ${response.status}`);
        }

        return result;

      } catch (error) {
        console.error('Error creando admin:', error);
        return {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
      }
    },
    onSuccess: (result) => {
      setCreateResult(result);
      
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        // Limpiar formulario
        setNewAdmin({
          email: '',
          full_name: '',
          password: ''
        });
        
        // Limpiar resultado después de 5 segundos
        setTimeout(() => {
          setCreateResult(null);
          setShowCreateForm(false);
        }, 3000);
      }
    }
  });

  // Mutation para actualizar usuario administrador
  const updateAdminMutation = useMutation({
    mutationFn: async (adminData: EditingAdmin): Promise<UpdateResult> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No hay sesión activa');
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-admin-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: adminData.id,
            email: adminData.email,
            full_name: adminData.full_name,
            newPassword: adminData.newPassword
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || `Error HTTP: ${response.status}`);
        }

        return result;

      } catch (error) {
        console.error('Error actualizando admin:', error);
        return {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
      }
    },
    onSuccess: (result, variables) => {
      setUpdateResults(prev => ({
        ...prev,
        [variables.id]: result
      }));
      
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        cancelEditing(variables.id);
        
        // Limpiar resultado después de 5 segundos
        setTimeout(() => {
          setUpdateResults(prev => {
            const newResults = { ...prev };
            delete newResults[variables.id];
            return newResults;
          });
        }, 5000);
      }
    }
  });

  const startEditing = (admin: AdminUser) => {
    setEditingAdmins(prev => ({
      ...prev,
      [admin.id]: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name || '',
        newPassword: '',
        isEditing: true
      }
    }));
    
    // Limpiar resultado anterior
    setUpdateResults(prev => {
      const newResults = { ...prev };
      delete newResults[admin.id];
      return newResults;
    });
  };

  const cancelEditing = (adminId: string) => {
    setEditingAdmins(prev => {
      const newState = { ...prev };
      delete newState[adminId];
      return newState;
    });
    
    setShowPasswords(prev => {
      const newState = { ...prev };
      delete newState[adminId];
      return newState;
    });
  };

  const saveAdmin = async (adminId: string) => {
    const editingAdmin = editingAdmins[adminId];
    if (!editingAdmin) return;

    // Validaciones
    if (!editingAdmin.email || !editingAdmin.full_name) {
      setUpdateResults(prev => ({
        ...prev,
        [adminId]: {
          success: false,
          message: 'Email y nombre completo son obligatorios'
        }
      }));
      return;
    }

    if (editingAdmin.newPassword && editingAdmin.newPassword.length < 6) {
      setUpdateResults(prev => ({
        ...prev,
        [adminId]: {
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        }
      }));
      return;
    }

    await updateAdminMutation.mutateAsync(editingAdmin);
  };

  const updateEditingAdmin = (adminId: string, field: keyof EditingAdmin, value: string) => {
    setEditingAdmins(prev => ({
      ...prev,
      [adminId]: {
        ...prev[adminId],
        [field]: value
      }
    }));
  };

  const togglePasswordVisibility = (adminId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [adminId]: !prev[adminId]
    }));
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!newAdmin.email || !newAdmin.full_name || !newAdmin.password) {
      setCreateResult({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
      return;
    }

    if (newAdmin.password.length < 6) {
      setCreateResult({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
      return;
    }

    await createAdminMutation.mutateAsync(newAdmin);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  if (!isAdmin()) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700">
            Solo los administradores pueden gestionar otros administradores.
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
              Gestión de Administradores
            </h2>
            <p className="text-gray-600">
              Administrar usuarios con permisos de administrador del sistema
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-purple-600">Administradores Activos</p>
                <p className="text-2xl font-bold text-purple-900">
                  {adminUsers?.length || 0}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Crear Administrador
            </button>
          </div>
        </div>

        {/* Información de seguridad */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start">
            <Lock className="h-5 w-5 text-purple-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-purple-900 mb-2">
                Información de Seguridad
              </h4>
              <div className="text-sm text-purple-700 space-y-1">
                <p>• <strong>Solo administradores</strong> pueden gestionar otros administradores</p>
                <p>• <strong>Cambios de contraseña</strong> requieren al menos 6 caracteres</p>
                <p>• <strong>Cambios de email</strong> pueden requerir re-verificación</p>
                <p>• <strong>Todos los cambios</strong> se registran en el sistema de auditoría</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario de Creación de Administrador */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Crear Nuevo Administrador
            </h3>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setCreateResult(null);
                setNewAdmin({ email: '', full_name: '', password: '' });
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleCreateAdmin} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newAdmin.full_name}
                  onChange={(e) => setNewAdmin(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Juan Pérez García"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="admin@sedcauca.gov.co"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    required
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                  >
                    {showCreatePassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  La contraseña debe tener al menos 6 caracteres.
                </p>
              </div>
            </div>

            {/* Resultado de creación */}
            {createResult && (
              <div className={`p-3 rounded-lg border ${
                createResult.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start">
                  {createResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                  )}
                  <p className={`text-sm ${
                    createResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {createResult.message}
                  </p>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateResult(null);
                  setNewAdmin({ email: '', full_name: '', password: '' });
                }}
                disabled={createAdminMutation.isPending}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createAdminMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {createAdminMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Creando...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Administrador
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Administradores */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Usuarios Administradores ({adminUsers?.length || 0})
          </h3>
        </div>

        {adminsLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : adminUsers && adminUsers.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {adminUsers.map((admin) => {
              const isEditing = editingAdmins[admin.id]?.isEditing;
              const editingAdmin = editingAdmins[admin.id];
              const showPassword = showPasswords[admin.id];
              const updateResult = updateResults[admin.id];
              const isCurrentUser = admin.id === user?.id;

              return (
                <div key={admin.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                        {isCurrentUser ? (
                          <Crown className="h-6 w-6 text-purple-600" />
                        ) : (
                          <Shield className="h-6 w-6 text-purple-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-lg font-medium text-gray-900">
                            {admin.full_name || 'Sin nombre'}
                          </h4>
                          {isCurrentUser && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <Crown className="h-3 w-3 mr-1" />
                              Tú
                            </span>
                          )}
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Administrador
                          </span>
                        </div>
                        
                        {isEditing ? (
                          <div className="space-y-4">
                            {/* Formulario de edición simplificado */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Nombre Completo *
                                </label>
                                <input
                                  type="text"
                                  value={editingAdmin.full_name}
                                  onChange={(e) => updateEditingAdmin(admin.id, 'full_name', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  placeholder="Nombre completo"
                                  required
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Email *
                                </label>
                                <input
                                  type="email"
                                  value={editingAdmin.email}
                                  onChange={(e) => updateEditingAdmin(admin.id, 'email', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  placeholder="email@empresa.com"
                                  required
                                />
                              </div>
                              
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Nueva Contraseña (opcional)
                                </label>
                                <div className="relative">
                                  <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={editingAdmin.newPassword || ''}
                                    onChange={(e) => updateEditingAdmin(admin.id, 'newPassword', e.target.value)}
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Dejar vacío para mantener la actual"
                                    minLength={6}
                                  />
                                  <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    onClick={() => togglePasswordVisibility(admin.id)}
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  Mínimo 6 caracteres. Dejar vacío para no cambiar la contraseña.
                                </p>
                              </div>
                            </div>

                            {/* Resultado de actualización */}
                            {updateResult && (
                              <div className={`p-3 rounded-lg border ${
                                updateResult.success 
                                  ? 'bg-green-50 border-green-200' 
                                  : 'bg-red-50 border-red-200'
                              }`}>
                                <div className="flex items-start">
                                  {updateResult.success ? (
                                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                                  )}
                                  <p className={`text-sm ${
                                    updateResult.success ? 'text-green-700' : 'text-red-700'
                                  }`}>
                                    {updateResult.message}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Botones de acción */}
                            <div className="flex justify-end space-x-3">
                              <button
                                onClick={() => cancelEditing(admin.id)}
                                disabled={updateAdminMutation.isPending}
                                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => saveAdmin(admin.id)}
                                disabled={updateAdminMutation.isPending}
                                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                              >
                                {updateAdminMutation.isPending ? (
                                  <div className="flex items-center">
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                    Guardando...
                                  </div>
                                ) : (
                                  <div className="flex items-center">
                                    <Save className="h-4 w-4 mr-2" />
                                    Guardar Cambios
                                  </div>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="h-4 w-4 mr-2" />
                              {admin.email}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <User className="h-4 w-4 mr-2" />
                              Último acceso: {formatDate(admin.last_sign_in_at)}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <User className="h-4 w-4 mr-2" />
                              Creado: {formatDate(admin.created_at)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {!isEditing && (
                      <button
                        onClick={() => startEditing(admin)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No se encontraron administradores
            </h3>
            <p className="text-gray-600">
              No hay usuarios con permisos de administrador en el sistema.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}