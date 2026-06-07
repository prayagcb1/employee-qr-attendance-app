import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Auth/Login';
import { SignUp } from './components/Auth/SignUp';
import { EmployeeDashboard } from './components/Employee/EmployeeDashboard';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { ManagerDashboard } from './components/Manager/ManagerDashboard';
import { FieldSupervisorDashboard } from './components/FieldSupervisor/FieldSupervisorDashboard';

function AppContent() {
  const { user, employee, loading } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);

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
