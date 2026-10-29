type SessionMap = Record<string, string>;

const storageKey = (employeeId: string) => `waste-collection-sessions:${employeeId}`;
const sessionKey = (siteId: string, date: string) => `${siteId}|${date}`;

const readSessions = (employeeId: string): SessionMap => {
  const raw = localStorage.getItem(storageKey(employeeId));
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      );
    }
  } catch {
    // A corrupt entry is treated as having no open sessions.
  }
  return {};
};

const writeSessions = (employeeId: string, sessions: SessionMap) => {
  localStorage.setItem(storageKey(employeeId), JSON.stringify(sessions));
};

export function hasOpenCollectionSession(employeeId: string, siteId: string, date: string): boolean {
  return typeof readSessions(employeeId)[sessionKey(siteId, date)] === 'string';
}

export function resumeOrStartCollectionSession(employeeId: string, siteId: string, date: string): string {
  const sessions = readSessions(employeeId);
  const key = sessionKey(siteId, date);
  const existing = sessions[key];
  if (typeof existing === 'string') return existing;

  const id = crypto.randomUUID();
  const sameDayOnly = Object.fromEntries(
    Object.entries(sessions).filter(([storedKey]) => storedKey.endsWith(`|${date}`))
  );
  writeSessions(employeeId, { ...sameDayOnly, [key]: id });
  return id;
}

export function finishCollectionSession(employeeId: string, siteId: string, date: string): void {
  const sessions = readSessions(employeeId);
  delete sessions[sessionKey(siteId, date)];
  writeSessions(employeeId, sessions);
}
