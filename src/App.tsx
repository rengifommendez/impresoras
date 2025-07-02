import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/LoginForm';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { UploadCSV } from './components/UploadCSV';
import { UsersTable } from './components/UsersTable';
import { Reports } from './components/Reports';
import { UserManagement } from './components/UserManagement';
import { UsersSection } from './components/UsersSection';
import { PrinterManagement } from './components/PrinterManagement';
import { ImportHistory } from './components/ImportHistory';
import { TotalReports } from './components/TotalReports';
import { OfficeStatistics } from './components/OfficeStatistics';

// Crear cliente de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos
    },
  },
});

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'upload' | 'users' | 'reports' | 'management' | 'printers' | 'import-history' | 'total-reports' | 'office-stats'>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'upload':
        return <UploadCSV />;
      case 'users':
        return <UsersSection />;
      case 'reports':
        return <Reports />;
      case 'management':
        return <UserManagement />;
      case 'printers':
        return <PrinterManagement />;
      case 'import-history':
        return <ImportHistory />;
      case 'total-reports':
        return <TotalReports />;
      case 'office-stats':
        return <OfficeStatistics />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderCurrentPage()}
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;