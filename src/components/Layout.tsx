import React from 'react';
import { LogOut, Printer, BarChart3, Upload, Users, FileText, Settings, Monitor, Database, Target, Building } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import SEDCAUCALogo from '../img/SEDCAUCA.png';

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: 'dashboard' | 'upload' | 'users' | 'reports' | 'management' | 'printers' | 'import-history' | 'total-reports' | 'office-stats';
  onNavigate?: (page: string) => void;
}

export function Layout({ children, currentPage = 'dashboard', onNavigate }: LayoutProps) {
  const { user, signOut, isAdmin } = useAuth();

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
    ...(isAdmin() ? [{ id: 'upload', name: 'Subir CSV', icon: Upload }] : []),
    { id: 'users', name: 'Usuarios', icon: Users },
    { id: 'printers', name: 'Impresoras', icon: Monitor },
    { id: 'office-stats', name: 'Por Oficina', icon: Building },
    { id: 'reports', name: 'Reportes', icon: FileText },
    { id: 'total-reports', name: 'Reporte Total', icon: Target },
    ...(isAdmin() ? [{ id: 'import-history', name: 'Historial CSV', icon: Database }] : []),
    ...(isAdmin() ? [{ id: 'management', name: 'Gestión', icon: Settings }] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src={SEDCAUCALogo} alt="SEDCAUCA logo" className="h-8 w-8" />
              <h1 className="ml-3 text-xl font-semibold text-gray-900">
                SEDCAUCA Impresoras
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user?.email} {isAdmin() && '(Admin)'}
              </span>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <nav className="flex space-x-8 mb-8 overflow-x-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.id)}
                className={`
                  flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap
                  ${isActive 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <Icon className="h-4 w-4 mr-2" />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Main Content */}
        <main>{children}</main>
      </div>
    </div>
  );
}