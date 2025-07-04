import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UserPlus, 
  Save, 
  X, 
  User, 
  Mail, 
  Building, 
  Users, 
  Shield,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface NewUser {
  id: string;
  email: string;
  full_name: string;
  office: string;
  department: string;
  status: 'Normal' | 'Inactive';
  password: string;
  role: 'user' | 'admin';
}

interface CreateUserResult {
  success: boolean;
  message: string;
  userId?: string;
}

export function AdminUserCreation() {
  const { isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<CreateUserResult | null>(null);
  const [newUser, setNewUser] = useState<NewUser>({
    id: '',
    email: '',
    full_name: '',
    office: '',
    department: '',
    status: 'Normal',
    password: '',
    role: 'user'
  });

  const queryClient = useQueryClient();

  // Mutation para crear usuario usando Edge Function
  const createUserMutation = useMutation({
    mutationFn: async (userData: NewUser): Promise<CreateUserResult> => {
      try {
        // Get current session for authorization
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No hay sesión activa');
        }

        // Call the Edge Function
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || `HTTP error! status: ${response.status}`);
        }

        return result;

      } catch (error) {
        console.error('Error creando usuario:', error);
        return {
          success: false,
          message: `❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
      }
    },
    onSuccess: (result) => {
      setResult(result);
      if (result.success) {
        // Limpiar formulario
        setNewUser({
          id: '',
          email: '',
          full_name: '',
          office: '',
          department: '',
          status: 'Normal',
          password: '',
          role: 'user'
        });
        // Invalidar queries para actualizar listas
        queryClient.invalidateQueries({ queryKey: ['all-users'] });
        queryClient.invalidateQueries({ queryKey: ['users-with-activity'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      }
    }
  });

  // Generar ID automático basado en el nombre
  const generateUserId = (fullName: string) => {
    if (!fullName) return '';
    
    const normalized = fullName
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 8);
    
    const timestamp = Date.now().toString().slice(-4);
    return `${normalized}${timestamp}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!newUser.email || !newUser.full_name || !newUser.password) {
      setResult({
        success: false,
        message: '❌ Por favor complete todos los campos obligatorios'
      });
      return;
    }

    if (newUser.password.length < 6) {
      setResult({
        success: false,
        message: '❌ La contraseña debe tener al menos 6 caracteres'
      });
      return;
    }

    // Generar ID si no se proporcionó
    const finalUserData = {
      ...newUser,
      id: newUser.id || generateUserId(newUser.full_name)
    };

    createUserMutation.mutate(finalUserData);
  };

  const handleFullNameChange = (value: string) => {
    setNewUser(prev => ({
      ...prev,
      full_name: value,
      id: prev.id || generateUserId(value) // Auto-generar ID si está vacío
    }));
  };

  if (!isAdmin()) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700">
            Solo los administradores pueden crear nuevos usuarios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Creación de Usuarios
            </h2>
            <p className="text-gray-600">
              Crear nuevos usuarios y administradores en el sistema
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {showForm ? 'Cancelar' : 'Crear Usuario'}
          </button>
        </div>
      </div>

      {/* Formulario de creación */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Nuevo Usuario
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setResult(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo de Usuario */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Usuario
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewUser(prev => ({ ...prev, role: 'user' }))}
                  className={`
                    flex items-center justify-center px-4 py-3 border rounded-lg text-sm font-medium transition-colors
                    ${newUser.role === 'user' 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <User className="h-4 w-4 mr-2" />
                  Usuario Regular
                </button>
                <button
                  type="button"
                  onClick={() => setNewUser(prev => ({ ...prev, role: 'admin' }))}
                  className={`
                    flex items-center justify-center px-4 py-3 border rounded-lg text-sm font-medium transition-colors
                    ${newUser.role === 'admin' 
                      ? 'border-purple-500 bg-purple-50 text-purple-700' 
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Administrador
                </button>
              </div>
            </div>

            {/* Información Personal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newUser.full_name}
                  onChange={(e) => handleFullNameChange(e.target.value)}
                  placeholder="Juan Pérez García"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="juan.perez@empresa.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID de Usuario
                </label>
                <input
                  type="text"
                  value={newUser.id}
                  onChange={(e) => setNewUser(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="Se genera automáticamente"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Déjalo vacío para generar automáticamente
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Oficina
                </label>
                <input
                  type="text"
                  value={newUser.office}
                  onChange={(e) => setNewUser(prev => ({ ...prev, office: e.target.value }))}
                  placeholder="Oficina Central"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Departamento
                </label>
                <input
                  type="text"
                  value={newUser.department}
                  onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="Administración"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <select
                  value={newUser.status}
                  onChange={(e) => setNewUser(prev => ({ ...prev, status: e.target.value as 'Normal' | 'Inactive' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Normal">Activo</option>
                  <option value="Inactive">Inactivo</option>
                </select>
              </div>
            </div>

            {/* Resultado */}
            {result && (
              <div className={`p-4 rounded-lg border ${
                result.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                  )}
                  <p className={`text-sm ${
                    result.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {result.message}
                  </p>
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setResult(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createUserMutation.isPending}
                className={`
                  px-4 py-2 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50
                  ${newUser.role === 'admin'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                  }
                `}
              >
                {createUserMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Creando...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Save className="h-4 w-4 mr-2" />
                    Crear {newUser.role === 'admin' ? 'Administrador' : 'Usuario'}
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Información */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Shield className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              Información sobre Creación de Usuarios
            </h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• <strong>Usuarios Regulares:</strong> Acceso a dashboard y reportes básicos</p>
              <p>• <strong>Administradores:</strong> Acceso completo incluyendo subida de CSV y gestión</p>
              <p>• <strong>ID de Usuario:</strong> Se genera automáticamente basado en el nombre</p>
              <p>• <strong>Contraseña:</strong> El usuario puede cambiarla después del primer login</p>
              <p>• <strong>Email:</strong> Se confirma automáticamente, no requiere verificación</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}