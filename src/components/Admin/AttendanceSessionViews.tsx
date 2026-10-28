import { useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, ChevronDown } from 'lucide-react';

export interface AttendancePunch {
  time: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface AttendanceEntry {
  clockIn: AttendancePunch | null;
  clockOut: AttendancePunch | null;
  duration: string | null;
  durationMs: number | null;
}

export interface AttendanceSession {
  date: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  entries: AttendanceEntry[];
  totalDuration: string | null;
}

const UNASSIGNED_SITE_KEY = 'unassigned';

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDurationMs = (ms: number) => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

interface AttendanceDateGroupsProps {
  sessions: AttendanceSession[];
  showSiteCount: boolean;
}

export function AttendanceDateGroups({ sessions, showSiteCount }: AttendanceDateGroupsProps) {
  const groupedByDate = sessions.reduce((acc, session) => {
    if (!acc[session.date]) {
      acc[session.date] = [];
    }
    acc[session.date].push(session);
    return acc;
  }, {} as Record<string, AttendanceSession[]>);

  return (
    <>
      {Object.entries(groupedByDate).map(([date, dateSessions]) => (
        <div key={date} className="border-2 border-gray-300 rounded-xl p-4 sm:p-5 bg-gradient-to-br from-gray-50 to-white">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-gray-300">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">{date}</h3>
            {showSiteCount && (
              <span className="ml-auto text-xs text-gray-500">
                {dateSessions.length} {dateSessions.length === 1 ? 'site' : 'sites'}
              </span>
            )}
          </div>
          <div className="space-y-4">
            {dateSessions.map((session) => (
              <div key={`${session.date}-${session.siteId}`} className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 pb-3 border-b border-gray-200">
                  <div className="mb-2 sm:mb-0">
                    <p className="font-semibold text-gray-900 text-base">{session.siteName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{session.siteAddress}</p>
                  </div>
                  {session.totalDuration && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Site Duration</p>
                      <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm font-bold">
                        {session.totalDuration}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {session.entries.map((entry, entryIndex) => (
                    <div key={entryIndex} className="bg-gray-50 rounded-lg p-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                        <div>
                          {entry.clockIn ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                                  Clock In
                                </span>
                                <p className="flex items-center gap-1 text-sm text-gray-900 font-medium">
                                  <Clock className="w-4 h-4 text-green-600" />
                                  {formatTime(entry.clockIn.time)}
                                </p>
                              </div>
                              <div className="flex items-start gap-1 text-xs text-gray-600">
                                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="mb-1 line-clamp-2">{entry.clockIn.address}</p>
                                  <a
                                    href={`https://www.google.com/maps?q=${entry.clockIn.latitude},${entry.clockIn.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 underline"
                                  >
                                    View Map
                                  </a>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </div>
                        <div>
                          {entry.clockOut ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                                  Clock Out
                                </span>
                                <p className="flex items-center gap-1 text-sm text-gray-900 font-medium">
                                  <Clock className="w-4 h-4 text-red-600" />
                                  {formatTime(entry.clockOut.time)}
                                </p>
                              </div>
                              <div className="flex items-start gap-1 text-xs text-gray-600">
                                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="mb-1 line-clamp-2">{entry.clockOut.address}</p>
                                  <a
                                    href={`https://www.google.com/maps?q=${entry.clockOut.latitude},${entry.clockOut.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 underline"
                                  >
                                    View Map
                                  </a>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center h-full">
                              <span className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-semibold">Active</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-start md:items-center md:justify-end">
                          {entry.duration && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1 md:text-right">Duration</p>
                              <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-bold inline-block">
                                {entry.duration}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

interface CommunityGroup {
  key: string;
  siteName: string;
  recordCount: number;
  totalMs: number;
  sessions: AttendanceSession[];
}

const buildCommunityGroups = (sessions: AttendanceSession[]): CommunityGroup[] => {
  const groups = new Map<string, CommunityGroup>();

  sessions.forEach(session => {
    const key = session.siteId || UNASSIGNED_SITE_KEY;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        siteName: session.siteName,
        recordCount: 0,
        totalMs: 0,
        sessions: [],
      };
      groups.set(key, group);
    }

    group.sessions.push(session);
    session.entries.forEach(entry => {
      group!.recordCount += 1;
      group!.totalMs += entry.durationMs ?? 0;
    });
  });

  return Array.from(groups.values()).sort((a, b) => a.siteName.localeCompare(b.siteName));
};

export function CommunityAttendanceList({ sessions }: { sessions: AttendanceSession[] }) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const communities = useMemo(() => buildCommunityGroups(sessions), [sessions]);

  const toggleCommunity = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {communities.map(community => {
        const isOpen = expandedKeys.has(community.key);
        return (
          <div key={community.key} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCommunity(community.key)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-gray-50 transition"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{community.siteName}</p>
                <p className="text-xs text-gray-500 mt-0.5">Attendance records: {community.recordCount}</p>
                <p className="text-xs text-gray-500">
                  Total duration: {community.totalMs > 0 ? formatDurationMs(community.totalMs) : 'No completed sessions'}
                </p>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isOpen && (
              <div className="border-t border-gray-200 bg-gray-50 p-3 sm:p-4 space-y-4">
                <AttendanceDateGroups sessions={community.sessions} showSiteCount={false} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
