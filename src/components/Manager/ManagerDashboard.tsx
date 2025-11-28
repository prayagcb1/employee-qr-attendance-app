import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { LogOut, Users, ClipboardList, Lock } from 'lucide-react';
import { PasswordChangeForm } from '../Employee/PasswordChangeForm';
import { WasteFormsView } from '../Admin/WasteFormsView';

interface Employee {
  id: string;
  full_name: string;
  employee_code: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  date_of_joining: string;
}

export function ManagerDashboard() {
  const { employee, signOut } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'employees' | 'waste_forms'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'employees') {
      fetchEmployees();
    }
  }, [activeTab]);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .neq('role', 'admin')
      .neq('role', 'manager')
      .eq('active', true)
      .order('full_name');

    if (!error && data) {
      setEmployees(data);
    }
    setLoading(false);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'field_supervisor':
        return 'bg-purple-100 text-purple-800';
      case 'field_worker':
        return 'bg-blue-100 text-blue-800';
      case 'intern':
        return 'bg-green-100 text-green-800';
      case 'office_employee':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRole = (role: string) => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{employee?.full_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-600">{employee?.employee_code}</p>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                  Manager
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPasswordForm(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <Lock className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Change Password</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {showPasswordForm && (
        <PasswordChangeForm onClose={() => setShowPasswordForm(false)} />
      )}

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-4 py-3 font-medium transition flex items-center gap-2 ${
                activeTab === 'employees'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-5 h-5" />
              Employees
            </button>
            <button
              onClick={() => setActiveTab('waste_forms')}
              className={`px-4 py-3 font-medium transition flex items-center gap-2 ${
                activeTab === 'waste_forms'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ClipboardList className="w-5 h-5" />
              Waste Forms
            </button>
          </div>
        </div>

        {activeTab === 'employees' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Team Members</h2>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading employees...</div>
            ) : employees.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No employees found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Username</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{emp.full_name}</td>
                        <td className="py-3 px-4 text-gray-600">{emp.employee_code}</td>
                        <td className="py-3 px-4 text-gray-600">{emp.username}</td>
                        <td className="py-3 px-4 text-gray-600">
                          {emp.email && <div className="text-sm">{emp.email}</div>}
                          {emp.phone && <div className="text-sm">{emp.phone}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(emp.role)}`}>
                            {formatRole(emp.role)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {formatDate(emp.date_of_joining)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'waste_forms' && <WasteFormsView />}
      </main>
    </div>
  );
}
