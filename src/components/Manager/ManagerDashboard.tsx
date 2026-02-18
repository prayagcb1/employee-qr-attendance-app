import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AttendanceView } from '../Admin/AttendanceView';
import { AttendanceReport } from '../Admin/AttendanceReport';
import { SiteManagement } from '../Admin/SiteManagement';
import { EmployeeManagement } from '../Admin/EmployeeManagement';
import { WasteFormsView } from '../Admin/WasteFormsView';
import { QRAttendanceScanner } from '../Admin/QRAttendanceScanner';
import { LeaveApprovalView } from '../Admin/LeaveApprovalView';
import { LeaveRequestAdminNotifications } from '../Admin/LeaveRequestAdminNotifications';
import { LogOut, Users, MapPin, Clock, ClipboardList, QrCode, FileText, CalendarCheck, User } from 'lucide-react';
import { UserProfile } from '../Shared/UserProfile';
import { NotificationDropdown } from '../Shared/NotificationDropdown';

type Tab = 'attendance' | 'qr-scanner' | 'sites' | 'employees' | 'waste-forms' | 'leave-approvals';
type AttendanceView = 'logs' | 'report';

export function ManagerDashboard() {
  const { employee, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('qr-scanner');
  const [showProfile, setShowProfile] = useState(false);
  const [attendanceView, setAttendanceView] = useState<AttendanceView>('report');

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
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition"
                title="View Profile"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
                  {employee?.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-gray-900 leading-tight">{employee?.full_name}</p>
                  <span className="inline-block px-3 py-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-bold rounded-full shadow-sm">
                    Manager
                  </span>
                </div>
              </button>
            </div>
            <div className="flex items-center gap-2">
              {employee && (
                <NotificationDropdown
                  employeeId={employee.id}
                  employeeRole={employee.role}
                  onViewLeaveRequests={() => setActiveTab('leave-approvals')}
                />
              )}
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
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
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAttendanceView('report')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                      attendanceView === 'report'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Report View
                  </button>
                  <button
                    onClick={() => setAttendanceView('logs')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                      attendanceView === 'logs'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Detailed Logs
                  </button>
                </div>
              </div>
              {attendanceView === 'report' ? <AttendanceReport /> : <AttendanceView />}
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

