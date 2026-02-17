import { useState, useEffect, useRef } from 'react';
import { Bell, X, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Notification {
  id: string;
  type: 'leave_request' | 'leave_approved' | 'leave_rejected';
  title: string;
  message: string;
  timestamp: string;
  data?: any;
}

interface NotificationDropdownProps {
  employeeId: string;
  employeeRole: string;
  onViewLeaveRequests?: () => void;
}

export function NotificationDropdown({ employeeId, employeeRole, onViewLeaveRequests }: NotificationDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [count, setCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [employeeId, employeeRole]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const fetchNotifications = async () => {
    const allNotifications: Notification[] = [];

    if (employeeRole === 'admin' || employeeRole === 'manager') {
      const { data: pendingRequests, error } = await supabase
        .from('leave_requests')
        .select(`
          id,
          request_type,
          start_date,
          end_date,
          status,
          created_at,
          employee_id,
          employees (
            full_name,
            employee_code
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
      }

      if (pendingRequests && pendingRequests.length > 0) {
        pendingRequests.forEach((req: any) => {
          const requestType = req.request_type === 'leave' ? 'Leave' : 'WFH';
          allNotifications.push({
            id: req.id,
            type: 'leave_request',
            title: `${requestType} Request Pending`,
            message: `${req.employees.full_name} (${req.employees.employee_code}) requested ${requestType}`,
            timestamp: req.created_at,
            data: req
          });
        });
      }
    }

    if (employeeRole !== 'admin' && employeeRole !== 'manager') {
      const { data: recentUpdates } = await supabase
        .from('leave_requests')
        .select('id, request_type, start_date, status, updated_at')
        .eq('employee_id', employeeId)
        .in('status', ['approved', 'rejected'])
        .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('updated_at', { ascending: false })
        .limit(5);

      if (recentUpdates && recentUpdates.length > 0) {
        recentUpdates.forEach((req: any) => {
          const requestType = req.request_type === 'leave' ? 'Leave' : 'WFH';
          const status = req.status === 'approved' ? 'Approved' : 'Rejected';
          allNotifications.push({
            id: req.id,
            type: req.status === 'approved' ? 'leave_approved' : 'leave_rejected',
            title: `${requestType} Request ${status}`,
            message: `Your ${requestType} request has been ${status.toLowerCase()}`,
            timestamp: req.updated_at,
            data: req
          });
        });
      }
    }

    setNotifications(allNotifications);
    setCount(allNotifications.length);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'leave_request':
        return <Clock className="w-5 h-5 text-orange-500" />;
      case 'leave_approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'leave_rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Calendar className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[32rem] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
            <button
              onClick={() => setShowDropdown(false)}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No notifications</p>
                <p className="text-sm mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => {
                      if (notification.type === 'leave_request' && onViewLeaveRequests) {
                        onViewLeaveRequests();
                        setShowDropdown(false);
                      }
                    }}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 mb-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (employeeRole === 'admin' || employeeRole === 'manager') && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  if (onViewLeaveRequests) {
                    onViewLeaveRequests();
                    setShowDropdown(false);
                  }
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
              >
                View All Requests
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
