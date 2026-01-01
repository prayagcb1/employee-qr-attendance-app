import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, ClipboardList, Clock, Lock, Users, MapPin, Calendar } from 'lucide-react';
import { PasswordChangeForm } from '../Employee/PasswordChangeForm';
import { WasteFormsView } from '../Admin/WasteFormsView';
import { EmployeeDashboard } from '../Employee/EmployeeDashboard';
import { AttendanceView } from '../Admin/AttendanceView';
import { EmployeeList } from './EmployeeList';
import { SiteList } from './SiteList';

export function FieldSupervisorDashboard() {
  const { employee, signOut } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'my_attendance' | 'all_attendance' | 'waste_forms' | 'employees' | 'sites'>('my_attendance');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{employee?.full_name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-xs sm:text-sm text-gray-600">{employee?.employee_code}</p>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 whitespace-nowrap">
                  Field Supervisor
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPasswordForm(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
                title="Change Password"
              >
                <Lock className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Change Password</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
                title="Sign Out"
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

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex gap-2 sm:gap-4 border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('my_attendance')}
              className={`px-3 sm:px-4 py-3 font-medium transition flex items-center gap-2 whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'my_attendance'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>My Attendance</span>
            </button>
            <button
              onClick={() => setActiveTab('all_attendance')}
              className={`px-3 sm:px-4 py-3 font-medium transition flex items-center gap-2 whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'all_attendance'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>All Attendance</span>
            </button>
            <button
              onClick={() => setActiveTab('waste_forms')}
              className={`px-3 sm:px-4 py-3 font-medium transition flex items-center gap-2 whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'waste_forms'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Waste Forms</span>
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-3 sm:px-4 py-3 font-medium transition flex items-center gap-2 whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'employees'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Employees</span>
            </button>
            <button
              onClick={() => setActiveTab('sites')}
              className={`px-3 sm:px-4 py-3 font-medium transition flex items-center gap-2 whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'sites'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Sites</span>
            </button>
          </div>
        </div>

        {activeTab === 'my_attendance' && <EmployeeDashboard hideHeader />}
        {activeTab === 'all_attendance' && <AttendanceView />}
        {activeTab === 'waste_forms' && <WasteFormsView />}
        {activeTab === 'employees' && <EmployeeList />}
        {activeTab === 'sites' && <SiteList />}
      </main>
    </div>
  );
}
