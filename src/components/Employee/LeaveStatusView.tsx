import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Home, Briefcase, Calendar, FileText } from 'lucide-react';

interface LeaveRequest {
  id: string;
  request_type: 'leave' | 'wfh';
  start_date: string;
  end_date: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approver?: {
    full_name: string;
    employee_code: string;
  } | null;
}

interface LeaveStatusViewProps {
  onBack: () => void;
}

export function LeaveStatusView({ onBack }: LeaveStatusViewProps) {
  const { employee } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaveRequests();
  }, [employee]);

  const fetchLeaveRequests = async () => {
    if (!employee) return;

    setLoading(true);
    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employee.id)
      .order('requested_at', { ascending: false });

    if (!error && requests) {
      const approverIds = requests
        .filter(r => r.approved_by)
        .map(r => r.approved_by)
        .filter((id): id is string => id !== null);

      let approverMap = new Map();

      if (approverIds.length > 0) {
        const { data: approvers } = await supabase
          .from('employees')
          .select('id, full_name, employee_code')
          .in('id', [...new Set(approverIds)]);

        if (approvers) {
          approverMap = new Map(approvers.map(a => [a.id, a]));
        }
      }

      const enrichedRequests = requests.map(request => ({
        ...request,
        approver: request.approved_by ? approverMap.get(request.approved_by) : null
      }));

      setLeaveRequests(enrichedRequests);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg px-3 py-2 transition"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Leave & WFH Requests</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              Loading your requests...
            </div>
          ) : leaveRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No requests yet</p>
              <p className="text-sm mt-2">Your leave and WFH requests will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaveRequests.map((request) => (
                <div
                  key={request.id}
                  className="border border-gray-200 rounded-lg p-4 sm:p-5 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {request.request_type === 'wfh' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-800 rounded-lg text-sm font-semibold">
                          <Home className="w-4 h-4" />
                          Work From Home
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold">
                          <Briefcase className="w-4 h-4" />
                          Leave
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {request.status === 'pending' && (
                        <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-semibold whitespace-nowrap">
                          Pending
                        </span>
                      )}
                      {request.status === 'approved' && (
                        <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-semibold whitespace-nowrap">
                          Approved
                        </span>
                      )}
                      {request.status === 'rejected' && (
                        <span className="px-3 py-1.5 bg-red-100 text-red-800 rounded-lg text-sm font-semibold whitespace-nowrap">
                          Rejected
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        Requested: {new Date(request.requested_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      <span className="font-medium text-base">
                        {new Date(request.start_date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        {request.end_date && (
                          <> - {new Date(request.end_date).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}</>
                        )}
                      </span>
                    </div>

                    {request.reason && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-start gap-2 text-gray-700">
                          <FileText className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Reason:</p>
                            <p className="text-sm">{request.reason}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {request.status === 'approved' && request.approver && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm text-green-800">
                          <span className="font-semibold">Approved by:</span> {request.approver.full_name} ({request.approver.employee_code})
                        </p>
                        {request.approved_at && (
                          <p className="text-xs text-green-700 mt-1">
                            on {new Date(request.approved_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                    )}

                    {request.status === 'rejected' && request.rejection_reason && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-800">
                          <span className="font-semibold">Rejection Reason:</span> {request.rejection_reason}
                        </p>
                        {request.approver && (
                          <p className="text-sm text-red-800 mt-1">
                            <span className="font-semibold">Rejected by:</span> {request.approver.full_name} ({request.approver.employee_code})
                          </p>
                        )}
                        {request.approved_at && (
                          <p className="text-xs text-red-700 mt-1">
                            on {new Date(request.approved_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
