import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AttendanceView } from './AttendanceView';
import { AttendanceReport } from './AttendanceReport';
import { SiteManagement } from './SiteManagement';
import { EmployeeManagement } from './EmployeeManagement';
import { WasteFormsView } from './WasteFormsView';
import { QRAttendanceScanner } from './QRAttendanceScanner';
import { LeaveApprovalView } from './LeaveApprovalView';
import { LeaveRequestAdminNotifications } from './LeaveRequestAdminNotifications';
import { LogOut, Users, MapPin, Clock, ClipboardList, QrCode, FileText, CalendarCheck, User } from 'lucide-react';
import { UserProfile } from '../Shared/UserProfile';

type Tab = 'attendance' | 'qr-scanner' | 'sites' | 'employees' | 'waste-forms' | 'leave-approvals';
type AttendanceSubTab = 'logs' | 'report';

export function AdminDashboard() {
  const { employee, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('qr-scanner');
  const [attendanceSubTab, setAttendanceSubTab] = useState<AttendanceSubTab>('logs');
  const [showProfile, setShowProfile] = useState(false);

  const tabs = [
    { id: 'qr-scanner' as Tab, label: 'QR Scanner', icon: QrCode },
    { id: 'attendance' as Tab, label: 'Attendance', icon: Clock },
    { id: 'leave-approvals' as Tab, label: 'Leave & WFH', icon: CalendarCheck },
    { id: 'sites' as Tab, label: 'Sites', icon: MapPin },
    { id: 'employees' as Tab, label: 'Employees', icon: Users },
    { id: 'waste-forms' as Tab, label: 'Waste Forms', icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-xs sm:text-sm text-gray-600 truncate">{employee?.full_name} - {employee?.employee_code}</p>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 whitespace-nowrap">
                  Admin
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
                title="View Profile"
              >
                <User className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Profile</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {employee && (
          <LeaveRequestAdminNotifications
            currentEmployeeId={employee.id}
            onViewRequests={() => setActiveTab('leave-approvals')}
          />
        )}

        <div className="bg-white rounded-lg shadow-sm mb-6 border border-gray-200">
          <nav className="flex border-b border-gray-200 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium transition relative whitespace-nowrap ${
                  activeTab === id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div>
          {activeTab === 'attendance' && (
            <div>
              <div className="bg-white rounded-lg shadow-sm mb-6 p-4 border border-gray-200">
                <div className="flex gap-2">
                  <button
                    onClick={() => setAttendanceSubTab('logs')}
                    className={`flex-1 px-4 py-2 font-medium rounded-lg transition ${
                      attendanceSubTab === 'logs'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Attendance Logs
                  </button>
                  <button
                    onClick={() => setAttendanceSubTab('report')}
                    className={`flex-1 px-4 py-2 font-medium rounded-lg transition ${
                      attendanceSubTab === 'report'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Attendance Report
                  </button>
                </div>
              </div>
              {attendanceSubTab === 'logs' && <AttendanceView />}
              {attendanceSubTab === 'report' && <AttendanceReport />}
            </div>
          )}
          {activeTab === 'qr-scanner' && <QRAttendanceScanner />}
          {activeTab === 'leave-approvals' && <LeaveApprovalView currentEmployeeId={employee?.id || ''} />}
          {activeTab === 'sites' && <SiteManagement />}
          {activeTab === 'employees' && <EmployeeManagement />}
          {activeTab === 'waste-forms' && <WasteFormsView />}
        </div>
      </div>

      {showProfile && employee && (
        <UserProfile
          employeeId={employee.id}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
