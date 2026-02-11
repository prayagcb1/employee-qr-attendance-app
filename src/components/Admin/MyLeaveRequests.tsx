import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LeaveRequestForm } from '../Employee/LeaveRequestForm';
import { LeaveStatusView } from '../Employee/LeaveStatusView';
import { CalendarCheck, FileText } from 'lucide-react';

export function MyLeaveRequests() {
  const { employee } = useAuth();
  const [showLeaveRequestForm, setShowLeaveRequestForm] = useState(false);
  const [showLeaveStatus, setShowLeaveStatus] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (showLeaveStatus) {
    return <LeaveStatusView onBack={() => setShowLeaveStatus(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">My Leave & WFH Requests</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setShowLeaveRequestForm(true)}
            className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold py-6 px-6 rounded-lg shadow-sm transition flex items-center justify-center gap-3"
          >
            <CalendarCheck className="w-6 h-6" />
            <span>Request Leave or WFH</span>
          </button>

          <button
            onClick={() => setShowLeaveStatus(true)}
            className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-6 px-6 rounded-lg shadow-sm transition flex items-center justify-center gap-3"
          >
            <FileText className="w-6 h-6" />
            <span>View Request Status</span>
          </button>
        </div>

        {message && (
          <div className={`mt-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {showLeaveRequestForm && (
        <LeaveRequestForm
          employeeId={employee!.id}
          employeeRole={employee!.role}
          onClose={() => setShowLeaveRequestForm(false)}
          onSuccess={() => {
            setShowLeaveRequestForm(false);
            setMessage({ type: 'success', text: 'Request submitted successfully' });
            setTimeout(() => setMessage(null), 5000);
          }}
        />
      )}
    </div>
  );
}
