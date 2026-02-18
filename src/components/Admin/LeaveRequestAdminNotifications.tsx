import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Bell, Clock, X } from 'lucide-react';

interface LeaveRequest {
  id: string;
  request_type: 'leave' | 'wfh';
  start_date: string;
  end_date: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  employee: {
    full_name: string;
    employee_code: string;
  };
}

interface LeaveRequestAdminNotificationsProps {
  currentEmployeeId: string;
  onViewRequests?: () => void;
}

export function LeaveRequestAdminNotifications({ currentEmployeeId, onViewRequests }: LeaveRequestAdminNotificationsProps) {
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchPendingRequests();
    fetchDismissedFromBanner();

    const channel = supabase
      .channel('leave_requests_admin_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_requests'
        },
        () => {
          fetchPendingRequests();
          fetchDismissedFromBanner();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentEmployeeId]);

  const fetchDismissedFromBanner = async () => {
    const { data } = await supabase
      .from('dismissed_notifications')
      .select('reference_id')
      .eq('employee_id', currentEmployeeId)
      .eq('dismissed_from', 'banner');

    if (data) {
      setDismissedIds(data.map(d => d.reference_id));
    }
  };

  const fetchPendingRequests = async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: requests, error: requestsError } = await supabase
      .from('leave_requests')
      .select('id, request_type, start_date, end_date, reason, status, requested_at, employee_id')
      .eq('status', 'pending')
      .gte('requested_at', threeDaysAgo.toISOString())
      .order('requested_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching pending requests:', requestsError);
      return;
    }

    if (!requests || requests.length === 0) {
      setPendingRequests([]);
      return;
    }

    const employeeIds = [...new Set(requests.map(r => r.employee_id))];

    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, full_name, employee_code')
      .in('id', employeeIds);

    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      return;
    }

    const employeeMap = new Map(employees?.map(e => [e.id, e]) || []);

    const formatted = requests.map(request => {
      const employee = employeeMap.get(request.employee_id);
      return {
        id: request.id,
        request_type: request.request_type,
        start_date: request.start_date,
        end_date: request.end_date,
        reason: request.reason,
        status: request.status,
        requested_at: request.requested_at,
        employee: {
          full_name: employee?.full_name || 'Unknown',
          employee_code: employee?.employee_code || 'N/A'
        }
      };
    });

    setPendingRequests(formatted as any);
  };

  const handleDismiss = async (id: string) => {
    setDismissedIds(prev => [...prev, id]);

    await supabase
      .from('dismissed_notifications')
      .insert({
        employee_id: currentEmployeeId,
        notification_type: 'leave_request',
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

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const requestTime = new Date(timestamp);
    const diffMs = now.getTime() - requestTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const visibleRequests = pendingRequests.filter(r => !dismissedIds.includes(r.id));

  if (visibleRequests.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {visibleRequests.map((request) => (
        <div
          key={request.id}
          className="p-4 rounded-lg border-l-4 bg-orange-50 border-orange-500 flex items-start gap-3 cursor-pointer hover:bg-orange-100 transition"
          onClick={onViewRequests}
        >
          <div className="flex-shrink-0 mt-0.5">
            <Bell className="w-5 h-5 text-orange-600" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-orange-900">
                    New {request.request_type === 'wfh' ? 'Work From Home' : 'Leave'} Request
                  </p>
                  <span className="text-xs text-orange-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(request.requested_at)}
                  </span>
                </div>

                <p className="text-sm text-orange-700 mt-1">
                  <span className="font-semibold">{request.employee.full_name}</span> ({request.employee.employee_code})
                </p>

                <p className="text-sm text-orange-700 mt-1">
                  {formatDate(request.start_date)}
                  {request.end_date && request.end_date !== request.start_date &&
                    ` - ${formatDate(request.end_date)}`
                  }
                </p>

                {request.reason && (
                  <p className="text-xs text-orange-600 mt-1 line-clamp-1">
                    {request.reason}
                  </p>
                )}

                <p className="text-xs text-orange-600 mt-2 font-medium">
                  Click to review and approve
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss(request.id);
                }}
                className="flex-shrink-0 p-1 rounded-full hover:bg-white/50 transition text-orange-600"
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
