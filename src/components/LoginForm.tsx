import React, { useState } from 'react';
import { Printer, Eye, EyeOff, LogIn, UserPlus, AlertCircle, Shield, User, Mail, Building, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [office, setOffice] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Por favor, complete todos los campos obligatorios');
      return;
    }

    if (isRegistering && !fullName) {
      setError('Por favor, ingrese su nombre completo');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isRegistering) {
        const { error } = await signUp(email, password, {
          full_name: fullName,
          role: role,
          office: office || '',
          department: department || ''
        });
        
        if (error) {
          if (error.message.includes('already registered')) {
            setError('Este email ya está registrado. Intente iniciar sesión o use otro email.');
          } else {
            setError(error.message);
          }
        } else {
          setSuccess(`✅ ¡Cuenta creada exitosamente! Ahora puede iniciar sesión con sus credenciales.`);
          setIsRegistering(false);
          setFullName('');
          setOffice('');
          setDepartment('');
          setRole('user');
        }
      } else {
        const { error } = await signIn(email, password);
        
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('Credenciales incorrectas. Verifique su email y contraseña, o cree una cuenta si es nuevo usuario.');
          } else {
            setError(error.message);
          }
        }
      }
    } catch (err) {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setSuccess('');
    setFullName('');
    setOffice('');
    setDepartment('');
    setRole('user');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <div className="bg-blue-600 p-3 rounded-full">
              <Printer className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sistema de Gestión de Impresiones
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isRegistering ? 'Crear cuenta para acceder al sistema' : 'Inicie sesión para acceder al dashboard'}
          </p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="space-y-6">
              {/* Registration Fields */}
              {isRegistering && (
                <>
                  {/* Full Name */}
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-gray-500" />
                        Nombre Completo *
                      </div>
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required={isRegistering}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="Juan Pérez García"
                    />
                  </div>

                  {/* Office */}
                  <div>
                    <label htmlFor="office" className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center">
                        <Building className="h-4 w-4 mr-2 text-gray-500" />
                        Oficina
                      </div>
                    </label>
                    <input
                      id="office"
                      name="office"
                      type="text"
                      value={office}
                      onChange={(e) => setOffice(e.target.value)}
                      className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="Oficina Central, Sucursal Norte, etc."
                    />
                  </div>

                  {/* Department */}
                  <div>
                    <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center">
                        <UsersIcon className="h-4 w-4 mr-2 text-gray-500" />
                        Departamento
                      </div>
                    </label>
                    <input
                      id="department"
                      name="department"
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="Administración, Ventas, IT, etc."
                    />
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Tipo de Cuenta
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole('user')}
                        className={`
                          flex items-center justify-center px-4 py-3 border rounded-lg text-sm font-medium transition-colors
                          ${role === 'user' 
                            ? 'border-blue-500 bg-blue-50 text-blue-700' 
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Usuario
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('admin')}
                        className={`
                          flex items-center justify-center px-4 py-3 border rounded-lg text-sm font-medium transition-colors
                          ${role === 'admin' 
                            ? 'border-purple-500 bg-purple-50 text-purple-700' 
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Administrador
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {role === 'admin' ? (
                        <div className="flex items-start">
                          <Shield className="h-3 w-3 text-purple-500 mt-0.5 mr-1 flex-shrink-0" />
                          <span>Acceso completo: subir CSV, gestionar usuarios, reportes avanzados</span>
                        </div>
                      ) : (
                        <div className="flex items-start">
                          <User className="h-3 w-3 text-blue-500 mt-0.5 mr-1 flex-shrink-0" />
                          <span>Acceso básico: ver dashboard y reportes generales</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-500" />
                    Correo Electrónico *
                  </div>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="usuario@empresa.com"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña *
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isRegistering ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-3 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder={isRegistering ? 'Mínimo 6 caracteres' : 'Ingrese su contraseña'}
                    minLength={6}
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
                {isRegistering && (
                  <p className="mt-1 text-xs text-gray-500">
                    La contraseña debe tener al menos 6 caracteres
                  </p>
                )}
              </div>

              {/* Success Message */}
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-600">{success}</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`
                  group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white transition-colors
                  ${role === 'admin' && isRegistering
                    ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }
                  focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {loading ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                ) : (
                  <>
                    {isRegistering ? (
                      <>
                        {role === 'admin' ? (
                          <Shield className="h-4 w-4 mr-2" />
                        ) : (
                          <UserPlus className="h-4 w-4 mr-2" />
                        )}
                        Crear Cuenta {role === 'admin' ? 'de Administrador' : ''}
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4 mr-2" />
                        Iniciar Sesión
                      </>
                    )}
                  </>
                )}
              </button>

              {/* Toggle Mode Button */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                >
                  {isRegistering 
                    ? '¿Ya tiene una cuenta? Iniciar sesión' 
                    : '¿No tiene una cuenta? Crear cuenta'
                  }
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Info Card */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-start">
            <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-xs text-gray-600">
              <p className="font-medium mb-1">Sistema de Gestión de Impresiones:</p>
              <ul className="space-y-1">
                <li>• <strong>Registro Libre:</strong> Cualquier persona puede crear una cuenta</li>
                <li>• <strong>Usuarios:</strong> Acceso a dashboard y reportes básicos</li>
                <li>• <strong>Administradores:</strong> Gestión completa del sistema</li>
                <li>• <strong>Datos Seguros:</strong> Información protegida y encriptada</li>
                <li>• <strong>Acceso Inmediato:</strong> Sin necesidad de confirmación por email</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}