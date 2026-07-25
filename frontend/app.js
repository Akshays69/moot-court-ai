// Mobile Sidebar Drawer Functions
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

const DOMAIN_CODES = {
  'Constitutional Law': 'CON',
  'Criminal Law': 'CRL',
  'Commercial Law': 'COM',
  'Intellectual Property': 'IPR',
  'Family Law': 'FAM',
  'Environmental Law': 'ENV'
};

function getDomainCode(domain) {
  return DOMAIN_CODES[domain] || 'GEN';
}

function getNextNumber(mode, domain) {
  const code = getDomainCode(domain);
  const existing = chats[mode].filter(c => c.code === code);
  const num = existing.length + 1;
  return String(num).padStart(3, '0');
}

window.onload = async function () {
  const isGuest = localStorage.getItem('mootcourt_is_guest') === 'true';

  if (isGuest) {
    const guestUser = JSON.parse(localStorage.getItem('mootcourt_user')) || { name: 'Guest', email: 'guest@mootcourt.ai' };
    const pill = document.getElementById('user-pill');
    if (pill) pill.innerText = '👤 ' + guestUser.name;
    const sidebarName = document.getElementById('sidebar-user-name');
    if (sidebarName) sidebarName.innerText = guestUser.name;
    const sidebarEmail = document.getElementById('sidebar-user-email');
    if (sidebarEmail) sidebarEmail.innerText = 'Guest Access';
    const badge = document.getElementById('guest-badge');
    if (badge) badge.style.display = 'inline-block';
  } else if (typeof getCurrentUser === 'function') {
    try {
      const user = await getCurrentUser();
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      const profile = await getCurrentProfile();
      const fullName = profile ? (profile.full_name || profile.email) : (user.email ? user.email.split('@')[0] : 'User');

      const pill = document.getElementById('user-pill');
      if (pill) pill.innerText = '👤 ' + fullName;
      const sidebarName = document.getElementById('sidebar-user-name');
      if (sidebarName) sidebarName.innerText = fullName;
      const sidebarEmail = document.getElementById('sidebar-user-email');
      if (sidebarEmail) sidebarEmail.innerText = user.email || '';

      if (profile && profile.role === 'admin') {
        const badge = document.getElementById('guest-badge');
        if (badge) {
          badge.innerText = 'ADMIN';
          badge.style.background = 'rgba(240, 165, 0, 0.2)';
          badge.style.color = '#f0a500';
          badge.style.display = 'inline-block';
        }

        const headerRight = document.querySelector('.header-right');
        const logoutBtn = document.querySelector('.logout-btn');
        if (headerRight && !document.querySelector('.admin-panel-btn')) {
          const adminBtn = document.createElement('a');
          adminBtn.href = 'admin.html';
          adminBtn.className = 'admin-panel-btn';
          adminBtn.innerHTML = '👑 Admin Panel';
          if (logoutBtn) {
            headerRight.insertBefore(adminBtn, logoutBtn);
          } else {
            headerRight.appendChild(adminBtn);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching Supabase user in app.js:', e);
    }
  }

  checkSidebarCollapseState();
  switchMode('judge');
  await renderSessionsList();
  const resumeSession = getActiveSession();
  if (resumeSession) {
    loadSessionIntoUI(resumeSession.id);
  } else {
    showSetupPanel();
  }
};

async function logout() {
  const isGuest = localStorage.getItem('mootcourt_is_guest');

  if (isGuest === 'true') {
    localStorage.removeItem('mootcourt_user');
    localStorage.removeItem('mootcourt_is_guest');
    localStorage.removeItem('mootcourt_active_session');
    localStorage.removeItem('mootcourt_sessions');
    window.location.href = 'login.html';
    return;
  }

  if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
    await supabaseClient.auth.signOut();
  }
  localStorage.clear();
  window.location.href = 'login.html';
}
function selectDomain(btn) {
  document.querySelectorAll('.domain-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentDomain = btn.dataset.domain;
  document.getElementById('header-domain').innerText = btn.dataset.domain + ' · ' + btn.dataset.code;
}

function switchMode(mode, fromUI = false) {
  currentMode = mode;
  document.getElementById('judgeTab').classList.toggle('active', mode === 'judge');
  document.getElementById('lawyerTab').classList.toggle('active', mode === 'lawyer');
  document.getElementById('mode-label').innerText = mode === 'judge' ? 'Judge Mode' : 'Opposing Lawyer Mode';

  renderSessionsList();

  if (!fromUI) {
    const sessions = loadAllSessions().filter(s => s.role === mode);
    const activeId = localStorage.getItem('mootcourt_active_session');
    const currentActive = loadSession(activeId);

    if (currentActive && currentActive.role === mode) {
      // Keep loaded
    } else if (sessions.length > 0) {
      loadSessionIntoUI(sessions[0].id);
    } else {
      startNewChat();
    }
  }
}

function showSetupPanel() {
  document.getElementById('setup-panel').style.display = 'flex';
  document.getElementById('chat-window').style.display = 'none';
  document.getElementById('input-area').style.display = 'none';
}

function showChatPanel() {
  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('chat-window').style.display = 'flex';
  document.getElementById('input-area').style.display = 'flex';
}

function selectSide(side) {
  currentSide = side;
  document.getElementById('petitionerBtn').classList.toggle('active', side === 'petitioner');
  document.getElementById('respondentBtn').classList.toggle('active', side === 'respondent');
}

let isSendingMessage = false;

const isValidUUID = (id) =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

async function generateProblem() {
  const isGuest = localStorage.getItem('mootcourt_is_guest') === 'true';
  if (isGuest) {
    let count = parseInt(localStorage.getItem('mootcourt_guest_generations') || '0');
    if (count >= 2) {
      alert('You have reached the limit of free problem generations in Guest Mode. Please sign in to continue.');
      logout();
      return;
    }
    localStorage.setItem('mootcourt_guest_generations', String(count + 1));
  }

  const btn = document.getElementById('generateBtn');
  const display = document.getElementById('problem-display');

  if (btn) {
    btn.innerText = '⏳ Generating...';
    btn.disabled = true;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const BACKEND_URL = 'https://moot-court-ai-gp94.onrender.com';
    const response = await fetch(`${BACKEND_URL}/generate-problem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: currentDomain, side: currentSide }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server status ${response.status}`);
    }

    const data = await response.json();
    if (display) {
      display.style.display = 'block';
      display.innerText = data.problem || 'No problem text returned.';
    }
    const customProblemEl = document.getElementById('custom-problem');
    if (customProblemEl) customProblemEl.value = '';

  } catch (error) {
    console.error('Error generating problem:', error);
    if (display) {
      display.style.display = 'block';
      display.innerText = error.name === 'AbortError' ?
        '⚠️ Problem generation timed out after 15 seconds. Please try again.' :
        `⚠️ Failed to generate problem: ${error.message}`;
    }
  } finally {
    clearTimeout(timeoutId);
    if (btn) {
      btn.innerText = '🎲 Generate AI Moot Problem';
      btn.disabled = false;
    }
  }
}

async function parseUploadedFile(file) {
  const fileName = file.name.toLowerCase();

  // Show loading state on the upload area
  const uploadArea = document.querySelector('.upload-area');
  if (uploadArea) uploadArea.innerHTML = '⏳ Reading file...';

  try {
    let extractedText = '';

    if (fileName.endsWith('.txt')) {
      // Read plain text files directly
      extractedText = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read TXT'));
        reader.readAsText(file);
      });

    } else if (fileName.endsWith('.pdf')) {
      // Use PDF.js to extract text from all pages
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageTexts = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        pageTexts.push(pageText);
      }
      extractedText = pageTexts.join('\n\n');

    } else if (fileName.endsWith('.docx')) {
      // Use Mammoth.js to extract text from DOCX
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      extractedText = result.value;

    } else {
      // Unsupported file type
      showFileError('Unsupported file type. Please upload PDF, DOCX, or TXT.');
      return null;
    }

    if (!extractedText || extractedText.trim().length < 10) {
      showFileError('Could not extract text from this file. Try a different file.');
      return null;
    }

    // Show success state
    showFileSuccess(file.name, extractedText.length);
    return extractedText.trim();

  } catch (error) {
    console.error('File parsing error:', error);
    showFileError('Failed to read file: ' + error.message);
    return null;
  }
}

function showFileSuccess(fileName, charCount) {
  const uploadArea = document.querySelector('.upload-area');
  if (uploadArea) {
    uploadArea.innerHTML = `
      <div style="color: #2d6a4f; font-weight: 600;">
        ✅ ${fileName}
      </div>
      <div style="color: #555; font-size: 12px; margin-top: 4px;">
        ${charCount.toLocaleString()} characters extracted
      </div>
      <div style="color: #888; font-size: 11px; margin-top: 8px; 
           max-height: 60px; overflow: hidden; text-overflow: ellipsis;">
        ${caseFileContent.substring(0, 150)}...
      </div>
      <button onclick="clearCaseFile()" style="margin-top:8px; 
        font-size:11px; color:#999; background:none; border:none; 
        cursor:pointer; text-decoration:underline;">
        ✕ Remove file
      </button>
    `;
  }
}

function showFileError(message) {
  const uploadArea = document.querySelector('.upload-area');
  if (uploadArea) {
    uploadArea.innerHTML = `
      <div style="color: #9b2226; font-weight: 600;">❌ ${message}</div>
      <div style="color: #888; font-size: 12px; margin-top: 6px; 
           cursor:pointer; text-decoration:underline;" 
           onclick="resetUploadArea()">Try again</div>
    `;
  }
}

function clearCaseFile() {
  caseFileContent = '';
  resetUploadArea();
}

function resetUploadArea() {
  const uploadArea = document.querySelector('.upload-area');
  if (uploadArea) {
    uploadArea.innerHTML = `
      <div class="upload-icon">📁</div>
      <p class="upload-title">Upload case file</p>
      <p class="upload-sub">Drag & drop or click — any file type</p>
    `;
    // restore original drag and drop and click listeners
    setupFileUpload();
  }
}

function extractTopicName(problem) {
  if (!problem) return 'New Case';
  let cleanText = problem.replace(/\*\*/g, '');
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
}

async function startSession() {
  const customProblem = document.getElementById('custom-problem').value.trim();
  const generatedProblem = document.getElementById('problem-display').innerText.trim();
  const problem = customProblem || generatedProblem;

  const startBtn = document.getElementById('start-session-btn');
  if (startBtn) {
    startBtn.innerText = '⏳ Setting up session...';
    startBtn.disabled = true;
  }

  const isGuest = localStorage.getItem('mootcourt_is_guest') === 'true';

  // 1. Create local session for localStorage backup
  activeSession = createSession(currentDomain, currentSide, currentMode, problem);
  conversationHistory = [];

  if (caseFileContent) {
    conversationHistory.push({
      role: 'user',
      content: 'Case File Context:\n\n' + caseFileContent
    });
  }

  if (problem) {
    conversationHistory.push({ role: 'system', content: problem });
  }

  // 2. Save session to Supabase for non-guest users and store real UUID in dbSessionId
  if (!isGuest && typeof saveSessionToDB === 'function') {
    try {
      const dbSession = await saveSessionToDB(currentDomain, currentSide, currentMode, problem);
      if (dbSession && dbSession.id && isValidUUID(dbSession.id)) {
        dbSessionId = dbSession.id;
        activeSession.dbId = dbSession.id;
      } else {
        dbSessionId = null;
      }
    } catch (err) {
      console.error('Error saving session to DB:', err);
      dbSessionId = null;
    }
  } else {
    dbSessionId = null;
  }

  saveMessages(activeSession.id, conversationHistory);
  await renderSessionsList();

  document.getElementById('header-domain').innerText = currentDomain + ' · ' + getDomainCode(currentDomain);
  showChatPanel();

  const chatBox = document.getElementById('chat-window');
  if (chatBox) chatBox.innerHTML = '';

  if (caseFileContent) {
    appendMessageToWindow('You', 'Case File Context:\n\n' + caseFileContent, 'user-message');
  }

  if (problem) {
    appendMessageToWindow('Case', problem, 'problem-message');
  }

  if (startBtn) {
    startBtn.innerText = '🚀 Start Practice Session →';
    startBtn.disabled = false;
  }

  const BACKEND_URL = 'https://moot-court-ai-gp94.onrender.com';
  fetch(`${BACKEND_URL}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).catch(() => {});
}

function startNewChat() {
  conversationHistory = [];
  activeSession = null;
  dbSessionId = null;
  setActiveSession(null);
  caseFileContent = '';

  const chatBox = document.getElementById('chat-window');
  if (chatBox) chatBox.innerHTML = '';

  document.getElementById('problem-display').style.display = 'none';
  document.getElementById('problem-display').innerText = '';
  document.getElementById('custom-problem').value = '';

  resetUploadArea();
  showSetupPanel();
  renderSessionsList();

  const BACKEND_URL = 'https://moot-court-ai-gp94.onrender.com';
  fetch(`${BACKEND_URL}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).catch(() => {});
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let currentLoadedSessions = [];
let showingArchivedView = false;
let sidebarSearchQuery = '';
let activeDropdownSession = null;

function toggleSidebarCollapse() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  sidebar.classList.toggle('collapsed');
  const isCollapsed = sidebar.classList.contains('collapsed');
  localStorage.setItem('mootcourt_sidebar_collapsed', isCollapsed ? 'true' : 'false');

  const btn = document.getElementById('sidebar-collapse-btn');
  if (btn) btn.innerHTML = isCollapsed ? '<span>▶</span>' : '<span>◀</span>';
}

function checkSidebarCollapseState() {
  const isCollapsed = localStorage.getItem('mootcourt_sidebar_collapsed') === 'true';
  if (isCollapsed) {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.add('collapsed');
    const btn = document.getElementById('sidebar-collapse-btn');
    if (btn) btn.innerHTML = '<span>▶</span>';
  }
}

function toggleSearchInput() {
  const wrapper = document.getElementById('search-box-wrapper');
  const input = document.getElementById('sidebar-search-input');
  if (!wrapper) return;

  if (wrapper.style.display === 'none' || !wrapper.style.display) {
    wrapper.style.display = 'flex';
    if (input) input.focus();
  } else {
    wrapper.style.display = 'none';
    clearSidebarSearch();
  }
}

function handleSidebarSearch(val) {
  sidebarSearchQuery = val;
  renderSessionsList();
}

function clearSidebarSearch() {
  sidebarSearchQuery = '';
  const input = document.getElementById('sidebar-search-input');
  if (input) input.value = '';
  renderSessionsList();
}

function toggleArchivedView() {
  showingArchivedView = !showingArchivedView;
  const btnLabel = document.getElementById('archived-btn-label');
  const backBar = document.getElementById('archived-back-bar');
  if (btnLabel) btnLabel.textContent = showingArchivedView ? 'Active Sessions' : 'Archived';
  if (backBar) backBar.style.display = showingArchivedView ? 'flex' : 'none';
  renderSessionsList();
}

function openSessionDropdown(event, sessionId) {
  event.stopPropagation();
  event.preventDefault();

  const session = currentLoadedSessions.find(s => s.id === sessionId) || loadSession(sessionId);
  if (!session) return;

  activeDropdownSession = session;

  const menu = document.getElementById('session-dropdown-menu');
  const pinLabel = document.getElementById('dropdown-pin-label');
  const archiveLabel = document.getElementById('dropdown-archive-label');

  if (pinLabel) pinLabel.textContent = session.pinned ? 'Unpin' : 'Pin';
  if (archiveLabel) archiveLabel.textContent = session.archived ? 'Unarchive' : 'Archive';

  const rect = event.currentTarget.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  menu.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 160)}px`;
  menu.style.display = 'flex';
}

function closeSessionDropdown() {
  const menu = document.getElementById('session-dropdown-menu');
  if (menu) menu.style.display = 'none';
  activeDropdownSession = null;
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#session-dropdown-menu') && !e.target.classList.contains('session-menu-btn')) {
    closeSessionDropdown();
  }
});

async function handleDropdownPin() {
  if (!activeDropdownSession) return;
  const sess = activeDropdownSession;
  const newPinned = !sess.pinned;
  closeSessionDropdown();

  const isGuest = localStorage.getItem('mootcourt_is_guest') === 'true';
  if (!isGuest && typeof updateSessionField === 'function') {
    try {
      await updateSessionField(sess.id, 'pinned', newPinned);
    } catch (e) {
      console.warn('Failed to update pin in DB:', e);
    }
  }
  if (typeof updateLocalSessionField === 'function') {
    updateLocalSessionField(sess.id, 'pinned', newPinned);
  }
  await renderSessionsList();
}

async function handleDropdownArchive() {
  if (!activeDropdownSession) return;
  const sess = activeDropdownSession;
  const newArchived = !sess.archived;
  closeSessionDropdown();

  const isGuest = localStorage.getItem('mootcourt_is_guest') === 'true';
  if (!isGuest && typeof updateSessionField === 'function') {
    try {
      await updateSessionField(sess.id, 'archived', newArchived);
    } catch (e) {
      console.warn('Failed to update archive in DB:', e);
    }
  }
  if (typeof updateLocalSessionField === 'function') {
    updateLocalSessionField(sess.id, 'archived', newArchived);
  }
  await renderSessionsList();
}

async function handleDropdownDelete() {
  if (!activeDropdownSession) return;
  const sessId = activeDropdownSession.id;
  closeSessionDropdown();

  deleteSession(sessId);
  await renderSessionsList();

  const activeIdAfterDelete = localStorage.getItem('mootcourt_active_session');
  if (!activeIdAfterDelete) {
    const remaining = currentLoadedSessions.filter(s => s.role === currentMode && !s.archived);
    if (remaining.length > 0) {
      loadSessionIntoUI(remaining[0].id);
    } else {
      startNewChat();
    }
  }
}

async function renderSessionsList() {
  const container = document.getElementById('sessions-list');
  if (!container) return;

  const isGuest = localStorage.getItem('mootcourt_is_guest') === 'true';
  let rawSessions = [];

  if (!isGuest && typeof getUserSessions === 'function') {
    try {
      rawSessions = await getUserSessions();
    } catch (e) {
      console.warn('Error fetching Supabase sessions:', e);
      rawSessions = [];
    }
  }

  if (!isGuest && rawSessions && rawSessions.length > 0) {
    currentLoadedSessions = rawSessions.map(s => {
      const code = getDomainCode(s.domain);
      return {
        id: s.id,
        dbId: s.id,
        caseId: code,
        domain: s.domain || 'Constitutional Law',
        side: s.side || 'petitioner',
        role: s.role || 'judge',
        problem: s.problem || '',
        topic: extractTopicName(s.problem),
        messages: (s.messages || []).map(m => ({ role: m.role, content: m.content })),
        createdAt: s.created_at,
        pinned: Boolean(s.pinned),
        archived: Boolean(s.archived)
      };
    });
  } else {
    currentLoadedSessions = loadAllSessions();
  }

  let modeSessions = currentLoadedSessions.filter(s => s.role === currentMode);

  if (showingArchivedView) {
    modeSessions = modeSessions.filter(s => s.archived);
  } else {
    modeSessions = modeSessions.filter(s => !s.archived);
  }

  if (sidebarSearchQuery.trim()) {
    const q = sidebarSearchQuery.toLowerCase().trim();
    modeSessions = modeSessions.filter(s => {
      const topic = (s.topic || extractTopicName(s.problem)).toLowerCase();
      const code = (s.caseId || getDomainCode(s.domain)).toLowerCase();
      const domain = (s.domain || '').toLowerCase();
      return topic.includes(q) || code.includes(q) || domain.includes(q);
    });
  }

  const activeId = localStorage.getItem('mootcourt_active_session');
  container.innerHTML = '';

  if (modeSessions.length === 0) {
    const emptyMsg = showingArchivedView
      ? 'No archived sessions'
      : (sidebarSearchQuery ? 'No sessions match search' : 'No sessions yet');
    container.innerHTML = `
      <p style="color:var(--subtext, rgba(255,255,255,0.4)); font-size:12px; padding:16px 12px; text-align:center; font-style:italic;">
        ${emptyMsg}
      </p>
    `;
    return;
  }

  const pinnedList = modeSessions.filter(s => s.pinned);
  const recentsList = modeSessions.filter(s => !s.pinned);

  if (showingArchivedView) {
    renderSessionGroup(container, 'ARCHIVED', modeSessions, activeId);
  } else {
    if (pinnedList.length > 0) {
      renderSessionGroup(container, 'PINNED', pinnedList, activeId);
    }
    if (recentsList.length > 0) {
      renderSessionGroup(container, 'RECENTS', recentsList, activeId);
    }
  }
}

function renderSessionGroup(container, labelText, items, activeId) {
  const label = document.createElement('div');
  label.className = 'section-label';
  label.innerText = labelText;
  container.appendChild(label);

  items.forEach(session => {
    const item = document.createElement('div');
    item.className = 'session-item' + (session.id === activeId ? ' session-active' : '');
    item.dataset.sessionId = session.id;

    const code = getDomainCode(session.domain);
    const caseName = session.topic || (session.problem ? extractTopicName(session.problem) : 'New Case');
    const tooltipText = `${code} · ${caseName} (${session.domain} · ${session.side})`;

    item.innerHTML = `
      <div class="session-title-wrapper" title="${escapeHtml(tooltipText)}">
        <span class="session-code-pill">${escapeHtml(code)}</span>
        <span class="session-dot-sep">·</span>
        <span class="session-case-name">${escapeHtml(caseName)}</span>
      </div>
      <button class="session-menu-btn" data-session-id="${session.id}" title="Options">⋮</button>
    `;

    container.appendChild(item);
  });
}

// Event Delegation for #sessions-list to ensure click listeners persist across re-renders
document.addEventListener('DOMContentLoaded', () => {
  const sessionsList = document.getElementById('sessions-list');
  if (sessionsList) {
    sessionsList.addEventListener('click', function(e) {
      const menuBtn = e.target.closest('.session-menu-btn');
      const sessionItem = e.target.closest('.session-item');

      if (menuBtn) {
        e.stopPropagation();
        const sessionId = menuBtn.dataset.sessionId || sessionItem?.dataset.sessionId;
        openSessionDropdown(e, sessionId);
        return;
      }

      if (sessionItem && !menuBtn) {
        const sessionId = sessionItem.dataset.sessionId;
        console.log('[Session Click] Loading session:', sessionId);
        if (sessionId) {
          loadSessionIntoUI(sessionId);
        }
      }
    });
  }
});

function loadSessionIntoUI(sessionId) {
  console.log('[loadSessionIntoUI] Requested sessionId:', sessionId);
  let session = currentLoadedSessions.find(s => s.id === sessionId);
  if (!session) {
    session = loadSession(sessionId);
  }
  if (!session) {
    console.warn('[loadSessionIntoUI] Session not found for ID:', sessionId);
    return;
  }

  currentDomain = session.domain;
  currentSide = session.side;
  currentMode = session.role;
  conversationHistory = session.messages || [];
  activeSession = session;
  dbSessionId = session.dbId || (session.id && isValidUUID(session.id) ? session.id : null);

  const chatBox = document.getElementById('chat-window');
  if (chatBox) chatBox.innerHTML = '';

  if (session.problem) {
    appendMessageToWindow('Case', session.problem, 'problem-message');
  }

  (session.messages || []).forEach(msg => {
    if (msg.role !== 'system' && !msg.content.startsWith('Case File Context:')) {
      const isUser = (msg.role === 'user');
      const sender = isUser ? 'You' : (currentMode === 'judge' ? 'Judge' : 'Lawyer');
      appendMessageToWindow(sender, msg.content, isUser ? 'user-message' : 'ai-message');
    }
  });

  const domainBtn = document.querySelector(`[data-domain="${session.domain}"]`);
  if (domainBtn) {
    selectDomain(domainBtn);
  }
  selectSide(session.side);
  switchMode(session.role, true);

  setActiveSession(sessionId);
  showChatPanel();

  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.toggle('session-active', item.dataset.sessionId === sessionId);
  });
}

function appendMessage(role, content) {
  const sender = role === 'user' ? 'You' : (currentMode === 'judge' ? 'Judge' : 'Lawyer');
  const cls = role === 'user' ? 'user-message' : 'ai-message';
  appendMessageToWindow(sender, content, cls);
}

function appendMessageToWindow(sender, text, customClass) {
  const chatWindow = document.getElementById('chat-window');
  if (!chatWindow) return;

  const wrapper = document.createElement('div');
  const isUser = sender === 'You';
  const isProblem = customClass === 'problem-message';
  const customCls = customClass || (isUser ? 'user-message' : 'ai-message');
  wrapper.className = `message ${customCls}`;

  const metaRow = document.createElement('div');
  metaRow.className = 'message-meta-row';

  const label = document.createElement('span');
  label.className = 'sender-label';
  const roleIcon = isUser ? '👤' : (isProblem ? '📜' : (currentMode === 'judge' ? '⚖️' : '🏛️'));
  label.innerText = `${roleIcon} ${sender.toUpperCase()}`;

  const time = document.createElement('span');
  time.className = 'message-timestamp';
  time.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  metaRow.appendChild(label);
  metaRow.appendChild(time);

  const content = document.createElement('div');
  content.className = 'message-content';

  if (!isUser && !isProblem && typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
    content.innerHTML = marked.parse(text);
  } else {
    content.innerText = text;
  }

  wrapper.appendChild(metaRow);
  wrapper.appendChild(content);
  chatWindow.appendChild(wrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage() {
  if (isSendingMessage) return;

  const isGuest = localStorage.getItem('mootcourt_is_guest') === 'true';
  if (isGuest) {
    const userMsgs = conversationHistory.filter(m => m.role === 'user' && !m.content.startsWith('Case File Context:'));
    if (userMsgs.length >= 3) {
      alert('You have reached the free limit of 3 messages in Guest Mode. Please sign in to continue.');
      logout();
      return;
    }
  }

  const inputField = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn') || document.querySelector('.send-btn');
  const userText = inputField ? inputField.value.trim() : '';
  if (!userText) return;

  isSendingMessage = true;

  if (inputField) {
    inputField.value = '';
    inputField.disabled = true;
  }
  if (sendBtn) sendBtn.disabled = true;

  if (!activeSession) {
    activeSession = createSession(currentDomain, currentSide, currentMode, '');
    renderSessionsList();
  }

  // 1. Append user message to UI and save to local state
  appendMessageToWindow('You', userText, 'user-message');
  conversationHistory.push({ role: 'user', content: userText });
  saveMessages(activeSession.id, conversationHistory);

  // 2. Create AI message bubble immediately with streaming container and typing cursor
  const aiLabel = currentMode === 'judge' ? 'Judge' : 'Lawyer';
  const chatBox = document.getElementById('chat-window');

  const wrapper = document.createElement('div');
  wrapper.className = 'message ai-message';

  const metaRow = document.createElement('div');
  metaRow.className = 'message-meta-row';

  const label = document.createElement('span');
  label.className = 'sender-label';
  const roleIcon = currentMode === 'judge' ? '⚖️' : '🏛️';
  label.innerText = `${roleIcon} ${aiLabel.toUpperCase()}`;

  const time = document.createElement('span');
  time.className = 'message-timestamp';
  time.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  metaRow.appendChild(label);
  metaRow.appendChild(time);

  const contentBox = document.createElement('div');
  contentBox.className = 'message-content';
  contentBox.innerHTML = `
        <span class="streaming-text"></span>
        <span class="typing-cursor">▌</span>
    `;

  wrapper.appendChild(metaRow);
  wrapper.appendChild(contentBox);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;

  const textSpan = contentBox.querySelector('.streaming-text');
  let fullResponse = '';

  try {
    const BACKEND_URL = 'https://moot-court-ai-gp94.onrender.com';

    const response = await fetch(`${BACKEND_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversationHistory,
        domain: currentDomain,
        mode: currentMode,
        role: currentMode,
        side: currentSide
      })
    });

    if (!response.ok) {
      throw new Error(`Server status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // keep incomplete chunk

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();

        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.text) {
            fullResponse += parsed.text;
            if (typeof marked !== 'undefined') {
              marked.setOptions({ breaks: true, gfm: true });
              textSpan.innerHTML = marked.parse(fullResponse);
            } else {
              textSpan.textContent = fullResponse;
            }
            chatBox.scrollTop = chatBox.scrollHeight;
          }
        } catch (parseErr) {
          console.error('Parse error in stream line:', parseErr);
        }
      }
    }

    // Streaming complete — remove typing cursor
    const cursor = wrapper.querySelector('.typing-cursor');
    if (cursor) cursor.remove();

    // 4. Save to conversation history and local storage
    conversationHistory.push({ role: 'assistant', content: fullResponse });
    saveMessages(activeSession.id, conversationHistory);

    // 5. Save to Supabase if not guest
    const isGuestUser = () => localStorage.getItem('mootcourt_is_guest') === 'true';
    if (!isGuestUser() && dbSessionId && isValidUUID(dbSessionId) && typeof saveMessageToDB === 'function') {
      await saveMessageToDB(dbSessionId, 'user', userText);
      await saveMessageToDB(dbSessionId, 'assistant', fullResponse);
    } else if (!isGuestUser()) {
      console.warn('Skipped Supabase save - invalid session id:', dbSessionId);
    }

  } catch (error) {
    console.error('Streaming error:', error);
    textSpan.textContent = '⚠️ Failed to get response. Please try again.';
    const cursor = wrapper.querySelector('.typing-cursor');
    if (cursor) cursor.remove();
  } finally {
    isSendingMessage = false;
    if (inputField) {
      inputField.disabled = false;
      inputField.focus();
    }
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function evaluateSession() {
  if (!activeSession ||
    !conversationHistory ||
    conversationHistory.length === 0) {
    alert('No active session to evaluate. Please have a conversation first.');
    return;
  }

  // Show the modal immediately with loading state
  showEvaluationModal();
  showEvaluationLoading();

  try {
    const BACKEND_URL = 'https://moot-court-ai-gp94.onrender.com';

    const response = await fetch(
      `${BACKEND_URL}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversationHistory,
        domain: activeSession.domain,
        side: activeSession.side
      })
    });

    if (!response.ok) {
      throw new Error('Evaluation failed: ' + response.status);
    }

    const data = await response.json();

    // Try to parse as structured JSON first
    // If backend returns plain text, we structure it ourselves
    let evalData;

    if (data.evaluation) {
      // backend returned { evaluation: "..." } as text
      evalData = parseEvaluationText(data.evaluation);
    } else if (data.scores) {
      // backend returned structured scores directly
      evalData = data;
    } else {
      // fallback — use whatever the backend returned
      evalData = parseEvaluationText(JSON.stringify(data));
    }

    renderEvaluationReport(evalData);

  } catch (error) {
    console.error('Evaluation error:', error);
    showEvaluationError(error.message);
  }
}

function parseEvaluationText(input) {
  // 1. If input is object or JSON string
  if (typeof input === 'object' && input !== null) {
    const isInvalidItem = (item) => {
      if (!item || typeof item !== 'string') return true;
      const trimmed = item.trim();
      if (trimmed.length < 10) return true;
      if (/^[A-Z0-9_]+\s*:\s*\d+$/i.test(trimmed)) return true;
      if (/^[A-Z0-9_]{3,}\s*:/i.test(trimmed)) return true;
      return false;
    };

    const sanitizeList = (list, fallback) => {
      if (!Array.isArray(list)) return fallback;
      const valid = list.map(item => String(item).trim()).filter(item => !isInvalidItem(item));
      return valid.length > 0 ? valid : fallback;
    };

    const defaultStrengths = [
      'Demonstrated strong understanding of core legal arguments and principles',
      'Maintained a confident and formal courtroom demeanor throughout',
      'Effective structural presentation of primary claims'
    ];
    const defaultWeaknesses = [
      'Could cite specific statutory provisions and judicial precedents more frequently',
      'Anticipating bench questions and counterarguments requires further preparation',
      'Rebuttal arguments could be presented with sharper focus'
    ];
    const defaultTips = [
      'Practice applying the IRAC (Issue, Rule, Application, Conclusion) framework',
      'Prepare a quick-reference index of landmark precedents before oral arguments',
      'Focus on concise responses to judicial inquiries'
    ];

    return {
      overall_score: Number(input.overall_score || input.score) || 7,
      argument_strength: Number(input.argument_strength) || 7,
      legal_accuracy: Number(input.legal_accuracy) || 7,
      use_of_precedent: Number(input.use_of_precedent) || 6,
      rebuttal_quality: Number(input.rebuttal_quality) || 7,
      domain_knowledge: Number(input.domain_knowledge) || 7,
      strengths: sanitizeList(input.strengths, defaultStrengths),
      weaknesses: sanitizeList(input.weaknesses, defaultWeaknesses),
      tips: sanitizeList(input.tips, defaultTips),
      verdict: (input.verdict && typeof input.verdict === 'string') ? input.verdict : 'The advocate demonstrated good overall legal command.'
    };
  }

  let text = String(input || '');
  try {
    const parsedObj = JSON.parse(text);
    if (typeof parsedObj === 'object' && parsedObj !== null) {
      return parseEvaluationText(parsedObj);
    }
  } catch (e) {}

  const getScore = (labelRegex) => {
    const match = text.match(new RegExp(labelRegex + '[^0-9]*([0-9]+)', 'i'));
    return match ? Math.min(10, Math.max(1, parseInt(match[1]))) : 7;
  };

  const isInvalidItem = (item) => {
    if (!item || item.length < 10) return true;
    if (/^[A-Z0-9_]+\s*:\s*\d+$/i.test(item)) return true;
    if (/^[A-Z0-9_]{3,}\s*:/i.test(item)) return true;
    return false;
  };

  const defaultStrengths = [
    'Demonstrated strong understanding of core legal arguments and principles',
    'Maintained a confident and formal courtroom demeanor throughout',
    'Effective structural presentation of primary claims'
  ];
  const defaultWeaknesses = [
    'Could cite specific statutory provisions and judicial precedents more frequently',
    'Anticipating bench questions and counterarguments requires further preparation',
    'Rebuttal arguments could be presented with sharper focus'
  ];
  const defaultTips = [
    'Practice applying the IRAC (Issue, Rule, Application, Conclusion) framework',
    'Prepare a quick-reference index of landmark precedents before oral arguments',
    'Focus on concise responses to judicial inquiries'
  ];

  const extractSectionLines = (sectionKeyword) => {
    const sectionRegex = new RegExp(sectionKeyword + '[:\\s]*([\\s\\S]*?)(?=(?:strengths|weaknesses|tips|verdict|score)|$)', 'i');
    const match = text.match(sectionRegex);
    if (!match || !match[1]) return [];
    return match[1]
      .split('\n')
      .map(l => l.replace(/^[-•*\d.]+\s*/, '').trim())
      .filter(l => !isInvalidItem(l));
  };

  const extractedStrengths = extractSectionLines('strengths');
  const extractedWeaknesses = extractSectionLines('weaknesses|areas for improvement|improvements');
  const extractedTips = extractSectionLines('tips|suggestions');

  return {
    overall_score: getScore('overall|score') || 7,
    argument_strength: getScore('argument') || 7,
    legal_accuracy: getScore('legal|accuracy') || 7,
    use_of_precedent: getScore('precedent') || 6,
    rebuttal_quality: getScore('rebuttal') || 7,
    domain_knowledge: getScore('domain|knowledge') || 7,
    strengths: extractedStrengths.length > 0 ? extractedStrengths.slice(0, 3) : defaultStrengths,
    weaknesses: extractedWeaknesses.length > 0 ? extractedWeaknesses.slice(0, 3) : defaultWeaknesses,
    tips: extractedTips.length > 0 ? extractedTips.slice(0, 3) : defaultTips,
    verdict: text.length > 30 ? (text.length > 250 ? text.substring(0, 250) + '...' : text) : 'The advocate demonstrated good overall legal command and structured reasoning.'
  };
}

function renderEvaluationReport(data) {
  const score = data.overall_score || 7;
  const scoreColor = 'var(--gold, #f0a500)';

  const categories = [
    { label: 'Argument Strength', value: data.argument_strength || 7 },
    { label: 'Legal Accuracy', value: data.legal_accuracy || 7 },
    { label: 'Use of Precedent', value: data.use_of_precedent || 6 },
    { label: 'Rebuttal Quality', value: data.rebuttal_quality || 7 },
    { label: 'Domain Knowledge', value: data.domain_knowledge || 7 }
  ];

  const barsHTML = categories.map(cat => `
    <div style="margin-bottom: 14px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <span style="font-size:13px; color:var(--text, #ffffff); font-weight:600;">${cat.label}</span>
        <span style="font-size:13px; font-weight:700; color:var(--gold, #f0a500);">${cat.value}/10</span>
      </div>
      <div style="background:rgba(255,255,255,0.08); border-radius:10px; height:8px; overflow:hidden;">
        <div style="width:${cat.value * 10}%; background:var(--gold, #f0a500); height:100%; border-radius:10px; transition: width 0.8s ease;"></div>
      </div>
    </div>
  `).join('');

  const strengthsHTML = (data.strengths || []).map(s => `
    <div style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-start;">
      <span style="color:#10b981; font-size:14px;">✅</span>
      <span style="font-size:13px; color:var(--text, #ffffff); line-height:1.5;">${s}</span>
    </div>
  `).join('');

  const weaknessesHTML = (data.weaknesses || []).map(w => `
    <div style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-start;">
      <span style="color:#f59e0b; font-size:14px;">⚠️</span>
      <span style="font-size:13px; color:var(--text, #ffffff); line-height:1.5;">${w}</span>
    </div>
  `).join('');

  const tipsHTML = (data.tips || []).map(t => `
    <div style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-start;">
      <span style="color:#3b82f6; font-size:14px;">💡</span>
      <span style="font-size:13px; color:var(--text, #ffffff); line-height:1.5;">${t}</span>
    </div>
  `).join('');

  const domainText = activeSession ? activeSession.domain : 'Moot Court';
  const sideText = activeSession ? activeSession.side : 'Practice';

  const reportHTML = `
    <!-- STICKY FIXED HEADER -->
    <div class="evaluation-header">
      <div>
        <h2 style="color:var(--gold, #f0a500); margin:0; font-size:18px; font-weight:800; font-family:'Playfair Display', serif;">
          ⚖️ Session Evaluation Report
        </h2>
        <p style="color:var(--subtext, rgba(255,255,255,0.6)); margin:2px 0 0; font-size:12px; font-weight:600;">
          ${escapeHtml(domainText)} · ${escapeHtml(sideText)}
        </p>
      </div>
      <button class="modal-close" onclick="document.getElementById('evaluation-modal').style.display='none'" title="Close">✕</button>
    </div>

    <!-- SCROLLABLE BODY -->
    <div class="evaluation-body-scrollable">
      <!-- Overall Score Circle -->
      <div style="text-align:center; margin-bottom:28px;">
        <div style="display:inline-flex; align-items:center; justify-content:center; width:94px; height:94px; border-radius:50%; border:4px solid var(--gold, #f0a500); background:transparent; flex-direction:column;">
          <span style="font-size:32px; font-weight:800; color:var(--gold, #f0a500); font-family:'Playfair Display', serif;">${score}</span>
          <span style="font-size:10px; color:var(--subtext, rgba(255,255,255,0.6)); margin-top:-2px;">/ 10</span>
        </div>
        <div style="font-size:12px; color:var(--gold, #f0a500); margin-top:8px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">
          Overall Score
        </div>
      </div>

      <!-- Category Scores -->
      <div style="margin-bottom:24px;">
        <h3 style="font-size:12px; color:var(--gold, #f0a500); font-weight:700; margin-bottom:14px; text-transform:uppercase; letter-spacing:0.5px;">Performance Breakdown</h3>
        ${barsHTML}
      </div>

      <!-- Strengths -->
      <div style="margin-bottom:20px;">
        <h3 style="font-size:12px; color:var(--gold, #f0a500); font-weight:700; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px;">Key Strengths</h3>
        ${strengthsHTML}
      </div>

      <!-- Weaknesses -->
      <div style="margin-bottom:20px;">
        <h3 style="font-size:12px; color:var(--gold, #f0a500); font-weight:700; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px;">Areas for Improvement</h3>
        ${weaknessesHTML}
      </div>

      <!-- Tips -->
      <div style="margin-bottom:24px;">
        <h3 style="font-size:12px; color:var(--gold, #f0a500); font-weight:700; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px;">Tips for Next Session</h3>
        ${tipsHTML}
      </div>

      <!-- Verdict -->
      <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-left:4px solid var(--gold, #f0a500); padding:18px 22px; border-radius:10px; margin-bottom:24px;">
        <div style="font-size:11px; color:var(--gold, #f0a500); font-weight:700; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.5px;">
          Bench Verdict Summary
        </div>
        <div style="font-size:13px; color:var(--text, #ffffff); line-height:1.6;">
          ${escapeHtml(data.verdict || 'Session completed successfully.')}
        </div>
      </div>

      <!-- Print Button -->
      <button onclick="window.print()" style="width:100%; padding:14px; background:rgba(240,165,0,0.12); color:var(--gold, #f0a500); border:1px solid var(--gold, #f0a500); border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; transition: background 0.2s ease;">
        🖨️ Download / Print Report
      </button>
    </div>
  `;

  const modalContainer = document.querySelector('#evaluation-modal .modal-content');
  if (modalContainer) {
    modalContainer.innerHTML = reportHTML;
  } else {
    const modalBody = document.getElementById('evaluation-body');
    if (modalBody) modalBody.innerHTML = reportHTML;
  }
}

function showEvaluationModal() {
  const modal = document.getElementById('evaluation-modal');
  if (modal) modal.style.display = 'flex';
}

function showEvaluationLoading() {
  const modalContainer = document.querySelector('#evaluation-modal .modal-content');
  if (modalContainer) {
    modalContainer.innerHTML = `
      <div class="evaluation-header">
        <div>
          <h2 style="color:var(--gold, #f0a500); margin:0; font-size:18px; font-weight:800; font-family:'Playfair Display', serif;">
            ⚖️ Session Evaluation Report
          </h2>
          <p style="color:var(--subtext, rgba(255,255,255,0.6)); margin:2px 0 0; font-size:12px; font-weight:600;">Evaluating Performance...</p>
        </div>
        <button class="modal-close" onclick="document.getElementById('evaluation-modal').style.display='none'" title="Close">✕</button>
      </div>
      <div class="evaluation-body-scrollable" style="text-align:center; padding:60px 20px;">
        <div style="font-size:40px; margin-bottom:16px;">⚖️</div>
        <div style="font-size:16px; color:var(--gold, #f0a500); font-weight:600;">
          Judge is compiling your report...
        </div>
        <div style="font-size:13px; color:var(--subtext); margin-top:8px;">
          Analysing your arguments and performance
        </div>
      </div>
    `;
  }
}

function showEvaluationError(message) {
  const modalContainer = document.querySelector('#evaluation-modal .modal-content');
  if (modalContainer) {
    modalContainer.innerHTML = `
      <div class="evaluation-header">
        <div>
          <h2 style="color:#ef4444; margin:0; font-size:18px; font-weight:800; font-family:'Playfair Display', serif;">
            ⚖️ Evaluation Failed
          </h2>
        </div>
        <button class="modal-close" onclick="document.getElementById('evaluation-modal').style.display='none'" title="Close">✕</button>
      </div>
      <div class="evaluation-body-scrollable" style="text-align:center; padding:40px 20px;">
        <div style="font-size:36px; margin-bottom:12px;">❌</div>
        <div style="font-size:15px; color:#ef4444; font-weight:600;">
          Evaluation Failed
        </div>
        <div style="font-size:13px; color:var(--subtext); margin-top:8px;">
          ${escapeHtml(message)}
        </div>
        <button onclick="evaluateSession()" 
          style="margin-top:20px; padding:10px 24px; 
          background:var(--gold); color:#0a0a1a; font-weight:700; border:none; 
          border-radius:8px; cursor:pointer;">
          Try Again
        </button>
      </div>
    `;
  }
}



function setupFileUpload() {
  const uploadArea = document.querySelector('.upload-area');
  const fileInput = document.getElementById('file-input');

  if (!uploadArea || !fileInput) return;

  // Click listener
  uploadArea.onclick = () => {
    const user = JSON.parse(localStorage.getItem('mootUser'));
    if (user && user.isGuest) {
      alert('Please log in to upload case files.');
      return;
    }
    fileInput.click();
  };

  // Dragover listener
  uploadArea.ondragover = (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  };

  // Dragleave listener
  uploadArea.ondragleave = () => {
    uploadArea.classList.remove('dragover');
  };

  // Drop listener
  uploadArea.ondrop = async (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const user = JSON.parse(localStorage.getItem('mootUser'));
    if (user && user.isGuest) {
      alert('Please log in to upload case files.');
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file) {
      const text = await parseUploadedFile(file);
      if (text) {
        caseFileContent = text;
      }
    }
  };

  // Change listener on file input
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await parseUploadedFile(file);
      if (text) {
        caseFileContent = text;
      }
    }
  };
}

document.addEventListener('DOMContentLoaded', function () {
  setupFileUpload();
  const input = document.getElementById('user-input');
  if (input) {
    input.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') sendMessage();
    });
  }
});

// -------------------------------------------------------------
// USER SETTINGS MODAL & ACTIONS
// -------------------------------------------------------------

async function openUserSettingsModal() {
  const modal = document.getElementById('user-settings-modal');
  if (!modal) return;

  const isGuest = localStorage.getItem('mootcourt_is_guest') === 'true';
  const nameEl = document.getElementById('settings-user-name');
  const emailEl = document.getElementById('settings-user-email');
  const avatarEl = document.getElementById('settings-user-avatar');
  const typeEl = document.getElementById('settings-account-type');
  const joinedEl = document.getElementById('settings-user-joined');
  const passBox = document.getElementById('settings-change-password-box');
  const delBtn = document.getElementById('delete-account-btn');

  if (isGuest) {
    const guestUser = JSON.parse(localStorage.getItem('mootcourt_user')) || { name: 'Guest User', email: 'guest@mootcourt.ai' };
    if (nameEl) nameEl.textContent = guestUser.name;
    if (emailEl) emailEl.textContent = guestUser.email;
    if (avatarEl) avatarEl.textContent = 'G';
    if (typeEl) typeEl.textContent = 'Guest Access';
    if (joinedEl) joinedEl.textContent = 'Temporary Session';
    if (passBox) passBox.style.display = 'none';
    if (delBtn) delBtn.style.display = 'none';
  } else {
    try {
      const user = await getCurrentUser();
      const profile = await getCurrentProfile();
      const name = profile ? (profile.full_name || profile.email) : (user.email ? user.email.split('@')[0] : 'User');
      const email = user.email || '';
      const initial = name.charAt(0).toUpperCase();

      const provider = user.app_metadata?.provider || 'email';
      const isGoogle = provider === 'google' || user.identities?.some(id => id.provider === 'google');

      if (nameEl) nameEl.textContent = name;
      if (emailEl) emailEl.textContent = email;
      if (avatarEl) avatarEl.textContent = initial;
      if (typeEl) typeEl.textContent = isGoogle ? 'Google Account' : 'Email Account';
      if (joinedEl) joinedEl.textContent = 'Member since ' + new Date(user.created_at || Date.now()).toLocaleDateString();

      if (passBox) {
        passBox.style.display = (provider === 'email' && !isGoogle) ? 'block' : 'none';
      }
      if (delBtn) delBtn.style.display = 'inline-flex';
    } catch(e) {
      console.warn('Error filling user settings:', e);
    }
  }

  modal.classList.add('open');
}

function closeUserSettingsModal() {
  const modal = document.getElementById('user-settings-modal');
  if (modal) modal.classList.remove('open');
}

async function handlePasswordReset() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.email) return;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin + '/login.html'
    });
    if (error) throw error;
    showToast(`Password reset link sent to ${user.email}`, 'success');
  } catch(e) {
    showToast('Failed to send reset email: ' + e.message, 'error');
  }
}

function handleClearLocalSessions() {
  if (confirm('Are you sure you want to clear all offline local sessions stored on this browser?')) {
    localStorage.removeItem('mootcourt_sessions');
    localStorage.removeItem('mootcourt_active_session');
    renderSessionsList();
    startNewChat();
    showToast('Local sessions cleared.', 'success');
  }
}

async function handleDownloadUserData() {
  const isGuest = localStorage.getItem('mootcourt_is_guest') === 'true';
  let exportData = [];

  if (isGuest) {
    exportData = loadAllSessions();
  } else {
    try {
      exportData = await getUserSessions();
    } catch(e) {
      exportData = currentLoadedSessions;
    }
  }

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `moot_court_user_data_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  showToast('Your practice data export downloaded successfully!', 'success');
}

function handleRequestAccountDeletion() {
  alert('To delete your account, please contact support at akshaydevprojects@gmail.com');
}
