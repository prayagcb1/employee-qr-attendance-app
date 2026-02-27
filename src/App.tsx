import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Auth/Login';
import { SignUp } from './components/Auth/SignUp';
import { EmployeeDashboard } from './components/Employee/EmployeeDashboard';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { ManagerDashboard } from './components/Manager/ManagerDashboard';
import { FieldSupervisorDashboard } from './components/FieldSupervisor/FieldSupervisorDashboard';
import { testConnection } from './lib/supabase';
import { logDiagnostics } from './utils/diagnostics';
import { AlertCircle, Wifi } from 'lucide-react';

function AppContent() {
  const { user, employee, loading } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      setIsTestingConnection(true);

      logDiagnostics();

      const result = await testConnection();

      if (!result.success) {
        setConnectionError(result.error || 'Unable to connect to server');
      } else {
        setConnectionError(null);
      }

      setIsTestingConnection(false);
    };

    checkConnection();
  }, []);

  if (isTestingConnection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Wifi className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-center mb-2 text-gray-900">Connection Error</h2>
          <p className="text-gray-600 text-center mb-4">
            Unable to connect to the server. This may be due to:
          </p>
          <ul className="text-sm text-gray-600 mb-6 space-y-2">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Mobile network blocking the connection</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Weak or unstable internet connection</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Firewall or security settings</span>
            </li>
          </ul>
          <div className="bg-gray-50 rounded p-3 mb-4">
            <p className="text-xs text-gray-500 font-mono break-all">
              Error: {connectionError}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry Connection
          </button>
          <p className="text-xs text-gray-500 text-center mt-4">
            Try switching to WiFi or a different network
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !employee) {
    return showSignUp ? (
      <SignUp onToggleForm={() => setShowSignUp(false)} />
    ) : (
      <Login onToggleForm={() => setShowSignUp(true)} />
    );
  }

  if (employee.role === 'admin') {
    return <AdminDashboard />;
  }

  if (employee.role === 'manager') {
    return <ManagerDashboard />;
  }

  if (employee.role === 'field_supervisor') {
    return <FieldSupervisorDashboard />;
  }

  return <EmployeeDashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
