import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, ClipboardList, Clock, Lock } from 'lucide-react';
import { PasswordChangeForm } from '../Employee/PasswordChangeForm';
import { WasteFormsView } from '../Admin/WasteFormsView';
import { EmployeeDashboard } from '../Employee/EmployeeDashboard';

export function FieldSupervisorDashboard() {
  const { employee, signOut } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'waste_forms'>('attendance');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{employee?.full_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-600">{employee?.employee_code}</p>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                  Field Supervisor
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
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-3 font-medium transition flex items-center gap-2 ${
                activeTab === 'attendance'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-5 h-5" />
              Attendance & Waste Form
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
              All Waste Forms
            </button>
          </div>
        </div>

        {activeTab === 'attendance' && <EmployeeDashboard hideHeader />}
        {activeTab === 'waste_forms' && <WasteFormsView />}
      </main>
    </div>
  );
}
