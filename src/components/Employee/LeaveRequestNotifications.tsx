import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, Clock, X } from 'lucide-react';

interface LeaveRequest {
  id: string;
  request_type: 'leave' | 'wfh';
  start_date: string;
  end_date: string | null;
  reason: string;
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

interface LeaveRequestNotificationsProps {
  employeeId: string;
}

export function LeaveRequestNotifications({ employeeId }: LeaveRequestNotificationsProps) {
  const [notifications, setNotifications] = useState<LeaveRequest[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchRecentRequests();
    fetchDismissedFromBanner();

    const channel = supabase
      .channel('leave_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_requests',
          filter: `employee_id=eq.${employeeId}`
        },
        () => {
          fetchRecentRequests();
          fetchDismissedFromBanner();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employeeId]);

  const fetchDismissedFromBanner = async () => {
    const { data } = await supabase
      .from('dismissed_notifications')
      .select('reference_id')
      .eq('employee_id', employeeId)
      .eq('dismissed_from', 'banner');

    if (data) {
      setDismissedIds(data.map(d => d.reference_id));
    }
  };

  const fetchRecentRequests = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: requests } = await supabase
      .from('leave_requests')
      .select('id, request_type, start_date, end_date, reason, status, requested_at, rejection_reason, approved_by, approved_at')
      .eq('employee_id', employeeId)
      .gte('requested_at', sevenDaysAgo.toISOString())
      .order('requested_at', { ascending: false });

    if (!requests || requests.length === 0) {
      setNotifications([]);
      return;
    }

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

    setNotifications(enrichedRequests);
  };

  const handleDismiss = async (id: string) => {
    setDismissedIds(prev => [...prev, id]);

    await supabase
      .from('dismissed_notifications')
      .insert({
        employee_id: employeeId,
        notification_type: 'leave_request_status',
        reference_id: id,
        dismissed_from: 'banner'
      });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const visibleNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-4 rounded-lg border-l-4 flex items-start gap-3 ${
            notification.status === 'approved'
              ? 'bg-green-50 border-green-500'
              : notification.status === 'rejected'
              ? 'bg-red-50 border-red-500'
              : 'bg-blue-50 border-blue-500'
          }`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {notification.status === 'approved' && (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
            {notification.status === 'rejected' && (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            {notification.status === 'pending' && (
              <Clock className="w-5 h-5 text-blue-600" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className={`font-semibold text-sm ${
                  notification.status === 'approved'
                    ? 'text-green-900'
                    : notification.status === 'rejected'
                    ? 'text-red-900'
                    : 'text-blue-900'
                }`}>
                  {notification.status === 'pending' && (
                    <>
                      {notification.request_type === 'wfh' ? 'Work From Home' : 'Leave'} Request Submitted
                    </>
                  )}
                  {notification.status === 'approved' && (
                    <>
                      {notification.request_type === 'wfh' ? 'Work From Home' : 'Leave'} Request Approved
                    </>
                  )}
                  {notification.status === 'rejected' && (
                    <>
                      {notification.request_type === 'wfh' ? 'Work From Home' : 'Leave'} Request Rejected
                    </>
                  )}
                </p>

                <p className={`text-sm mt-1 ${
                  notification.status === 'approved'
                    ? 'text-green-700'
                    : notification.status === 'rejected'
                    ? 'text-red-700'
                    : 'text-blue-700'
                }`}>
                  {formatDate(notification.start_date)}
                  {notification.end_date && notification.end_date !== notification.start_date &&
                    ` - ${formatDate(notification.end_date)}`
                  }
                </p>

                {notification.status === 'pending' && (
                  <p className="text-xs text-blue-600 mt-1">
                    Waiting for approval
                  </p>
                )}

                {notification.status === 'approved' && notification.approver && (
                  <p className="text-xs text-green-600 mt-1">
                    Approved by: {notification.approver.full_name} ({notification.approver.employee_code})
                  </p>
                )}

                {notification.status === 'rejected' && notification.rejection_reason && (
                  <div className="text-xs text-red-600 mt-1">
                    <p>Reason: {notification.rejection_reason}</p>
                    {notification.approver && (
                      <p className="mt-0.5">
                        Rejected by: {notification.approver.full_name} ({notification.approver.employee_code})
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleDismiss(notification.id)}
                className={`flex-shrink-0 p-1 rounded-full hover:bg-white/50 transition ${
                  notification.status === 'approved'
                    ? 'text-green-600'
                    : notification.status === 'rejected'
                    ? 'text-red-600'
                    : 'text-blue-600'
                }`}
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
