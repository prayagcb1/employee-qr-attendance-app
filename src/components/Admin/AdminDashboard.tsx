import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AttendanceView } from './AttendanceView';
import { SiteManagement } from './SiteManagement';
import { EmployeeManagement } from './EmployeeManagement';
import { WasteFormsView } from './WasteFormsView';
import { LogOut, Users, MapPin, Clock, ClipboardList } from 'lucide-react';

type Tab = 'attendance' | 'sites' | 'employees' | 'waste-forms';

export function AdminDashboard() {
  const { employee, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('attendance');

  const tabs = [
    { id: 'attendance' as Tab, label: 'Attendance', icon: Clock },
    { id: 'sites' as Tab, label: 'Sites', icon: MapPin },
    { id: 'employees' as Tab, label: 'Employees', icon: Users },
    { id: 'waste-forms' as Tab, label: 'Waste Forms', icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">{employee?.full_name} - {employee?.employee_code}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm mb-6 border border-gray-200">
          <nav className="flex border-b border-gray-200">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition relative ${
                  activeTab === id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div>
          {activeTab === 'attendance' && <AttendanceView />}
          {activeTab === 'sites' && <SiteManagement />}
          {activeTab === 'employees' && <EmployeeManagement />}
          {activeTab === 'waste-forms' && <WasteFormsView />}
        </div>
      </div>
    </div>
  );
}
