const STORAGE_KEY = 'mootcourt_sessions';
const ACTIVE_KEY  = 'mootcourt_active_session';

function generateId() {
  return 'session_' + Date.now();
}

function generateSessionCode(domain) {
  const domainCodes = {
    'Constitutional Law': 'CON',
    'Criminal Law': 'CRL', 
    'Commercial Law': 'COM',
    'Intellectual Property': 'IPR',
    'Family Law': 'FAM',
    'Environmental Law': 'ENV'
  };
  return domainCodes[domain] || 'GEN';
}

function createSession(domain, side, role, problem) {
  const all = loadAllSessions();
  const caseId = generateSessionCode(domain);

  const extractTopicName = (text) => {
    if (!text) return 'New Case';
    let cleanText = text.replace(/\*\*/g, '');
    const caseNameMatch = cleanText.match(/Case\s*Name:\s*([^\n]+)/i);
    if (caseNameMatch && caseNameMatch[1].trim()) {
      let name = caseNameMatch[1].trim();
      return name.length > 35 ? name.substring(0, 35) + '...' : name;
    }
    const firstLine = cleanText.split('\n')[0].trim();
    if (firstLine && firstLine.length > 5) {
      return firstLine.length > 35 ? firstLine.substring(0, 35) + '...' : firstLine;
    }
    const words = cleanText.split(' ').slice(0, 5).join(' ');
    return words.length > 35 ? words.substring(0, 35) + '...' : words;
  };
  const topic = extractTopicName(problem);

  const session = {
    id: generateId(),
    caseId: caseId,
    title: caseId + ' · ' + topic,
    domain: domain,
    side: side,
    role: role,
    problem: problem,
    topic: topic,
    messages: [],
    createdAt: new Date().toISOString()
  };
  
  all.unshift(session);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  localStorage.setItem(ACTIVE_KEY, session.id);
  return session;
}

function saveMessages(sessionId, messagesArray) {
  const all = loadAllSessions();
  const idx = all.findIndex(s => s.id === sessionId);
  if (idx !== -1) {
    all[idx].messages = messagesArray;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

function loadAllSessions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function loadSession(sessionId) {
  const all = loadAllSessions();
  return all.find(s => s.id === sessionId) || null;
}

function deleteSession(sessionId) {
  let all = loadAllSessions();
  all = all.filter(s => s.id !== sessionId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  if (localStorage.getItem(ACTIVE_KEY) === sessionId) {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

function updateLocalSessionField(sessionId, field, value) {
  const all = loadAllSessions();
  const idx = all.findIndex(s => s.id === sessionId);
  if (idx !== -1) {
    all[idx][field] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

function getActiveSession() {
  const id = localStorage.getItem(ACTIVE_KEY);
  return id ? loadSession(id) : null;
}

function setActiveSession(sessionId) {
  if (sessionId) {
    localStorage.setItem(ACTIVE_KEY, sessionId);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}
