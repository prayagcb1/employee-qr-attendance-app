import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Home, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface WFHButtonProps {
  employeeId: string;
  date: string;
}

interface WFHSession {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  duration_minutes: number | null;
  status: 'active' | 'complete' | 'incomplete';
}

export function WFHButton({ employeeId, date }: WFHButtonProps) {
  const [session, setSession] = useState<WFHSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWFHSession();
  }, [employeeId, date]);

  const fetchWFHSession = async () => {
    try {
      const { data, error } = await supabase
        .from('wfh_attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', date)
        .maybeSingle();

      if (error) throw error;
      setSession(data);
    } catch (err) {
      console.error('Error fetching WFH session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    setProcessing(true);
    setError('');

    try {
      const { error } = await supabase
        .from('wfh_attendance')
        .insert({
          employee_id: employeeId,
          date: date,
          clock_in_time: new Date().toISOString(),
          status: 'active'
        });

      if (error) throw error;
      await fetchWFHSession();
    } catch (err: any) {
      console.error('Error clocking in:', err);
      setError(err.message || 'Failed to clock in');
    } finally {
      setProcessing(false);
    }
  };

  const handleClockOut = async () => {
    if (!session) return;

    setProcessing(true);
    setError('');

    try {
      const { error } = await supabase
        .from('wfh_attendance')
        .update({
          clock_out_time: new Date().toISOString()
        })
        .eq('id', session.id);

      if (error) throw error;
      await fetchWFHSession();
    } catch (err: any) {
      console.error('Error clocking out:', err);
      setError(err.message || 'Failed to clock out');
    } finally {
      setProcessing(false);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '0:00 hr';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}:${String(mins).padStart(2, '0')} hr`;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Home className="w-8 h-8 text-blue-600" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Work From Home</h3>
            <p className="text-sm text-gray-600 mb-4">Click to start your WFH session</p>
          </div>
          <button
            onClick={handleClockIn}
            disabled={processing}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Clocking In...
              </>
            ) : (
              <>
                <Clock className="w-5 h-5" />
                Clock In
              </>
            )}
          </button>
          {error && (
            <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (session.status === 'active') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
            <Home className="w-8 h-8 text-green-600" />
          </div>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold mb-2">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              Active Session
            </div>
            <p className="text-sm text-gray-600">
              Clocked in at <span className="font-semibold text-gray-900">{formatTime(session.clock_in_time)}</span>
            </p>
          </div>
          <button
            onClick={handleClockOut}
            disabled={processing}
            className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Clocking Out...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Clock Out
              </>
            )}
          </button>
          {error && (
            <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (session.status === 'complete') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Session Complete</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                Clock In: <span className="font-semibold text-gray-900">{formatTime(session.clock_in_time)}</span>
              </p>
              {session.clock_out_time && (
                <p>
                  Clock Out: <span className="font-semibold text-gray-900">{formatTime(session.clock_out_time)}</span>
                </p>
              )}
              <div className="pt-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg font-bold">
                  <Clock className="w-5 h-5" />
                  {formatDuration(session.duration_minutes)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
