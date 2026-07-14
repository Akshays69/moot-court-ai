// Check login
const mootUser = JSON.parse(localStorage.getItem('mootUser'));
if (!mootUser) {
    window.location.href = 'login.html';
}

let currentMode = 'judge';
let currentChatId = null;
let currentDomain = 'Constitutional Law';
let currentSide = 'petitioner';
let chats = JSON.parse(localStorage.getItem('mootChats')) || { judge: [], lawyer: [] };

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

window.onload = function () {
    const user = JSON.parse(localStorage.getItem('mootUser'));
    if (user) {
        document.getElementById('user-pill').innerText = '👤 ' + user.name;
    }
    switchMode('judge');
};

function logout() {
    localStorage.removeItem('mootUser');
    window.location.href = 'login.html';
}
function selectDomain(btn) {
    document.querySelectorAll('.domain-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDomain = btn.dataset.domain;
    document.getElementById('header-domain').innerText = btn.dataset.domain + ' · ' + btn.dataset.code;
}

function switchMode(mode) {
    currentMode = mode;
    document.getElementById('judgeTab').classList.toggle('active', mode === 'judge');
    document.getElementById('lawyerTab').classList.toggle('active', mode === 'lawyer');
    document.getElementById('mode-label').innerText = mode === 'judge' ? 'Judge Mode' : 'Opposing Lawyer Mode';
    renderSidebar();
    const modeChats = chats[mode];
    if (modeChats.length > 0) {
        loadChat(modeChats[modeChats.length - 1].id);
    } else {
        currentChatId = null;
        showSetupPanel();
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

async function generateProblem() {
    const btn = document.getElementById('generateBtn');
    btn.innerText = '⏳ Generating...';
    btn.disabled = true;

    const response = await fetch('http://127.0.0.1:8000/generate-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: currentDomain, side: currentSide })
    });

    const data = await response.json();
    const display = document.getElementById('problem-display');
    display.style.display = 'block';
    display.innerText = data.problem;
    document.getElementById('custom-problem').value = '';

    btn.innerText = '🎲 Generate a Problem';
    btn.disabled = false;
}

function handleDragOver(event) {
    event.preventDefault();
    document.getElementById('upload-zone').classList.add('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    document.getElementById('upload-zone').classList.remove('dragover');
    const file = event.dataTransfer.files[0];
    if (file) processFile(file);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    const zone = document.getElementById('upload-zone');
    const reader = new FileReader();

    reader.onload = function (e) {
        const content = e.target.result;
        document.getElementById('custom-problem').value = content;
        document.getElementById('problem-display').style.display = 'none';

        const existing = zone.querySelector('.upload-success');
        if (existing) existing.remove();

        const success = document.createElement('p');
        success.className = 'upload-success';
        success.innerText = '✓ ' + file.name + ' uploaded';
        zone.appendChild(success);

        zone.querySelector('.upload-title').innerText = 'File loaded';
    };

    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        reader.readAsText(file);
    } else {
        const existing = zone.querySelector('.upload-success');
        if (existing) existing.remove();

        const success = document.createElement('p');
        success.className = 'upload-success';
        success.innerText = '✓ ' + file.name + ' uploaded — paste the case text below';
        zone.appendChild(success);

        zone.querySelector('.upload-title').innerText = 'File received';
        document.getElementById('custom-problem').placeholder = 'Paste the case text from your uploaded file here...';
    }
}

function extractTopicName(problem) {
    const words = problem.split(' ').slice(0, 5).join(' ');
    return words.length > 35 ? words.substring(0, 35) + '...' : words;
}

function startSession() {
    const customProblem = document.getElementById('custom-problem').value.trim();
    const generatedProblem = document.getElementById('problem-display').innerText.trim();
    const problem = customProblem || generatedProblem;

    if (!currentChatId) {
        createNewChat(currentDomain, problem);
    }

    document.getElementById('header-domain').innerText = currentDomain + ' · ' + getDomainCode(currentDomain);
    showChatPanel();

    if (problem) {
        appendMessageToWindow('Case', problem, 'problem-message');
        saveMessage('Case', problem);
    }

    fetch('http://127.0.0.1:8000/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
}

function startNewChat() {
    currentChatId = null;
    document.getElementById('problem-display').style.display = 'none';
    document.getElementById('problem-display').innerText = '';
    document.getElementById('custom-problem').value = '';
    const zone = document.getElementById('upload-zone');
    const success = zone.querySelector('.upload-success');
    if (success) success.remove();
    zone.querySelector('.upload-title').innerText = 'Upload case file';
    showSetupPanel();
    renderSidebar();

    fetch('http://127.0.0.1:8000/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
}

function renderSidebar() {
    const list = document.getElementById('chat-list');
    list.innerHTML = '';
    const modeChats = chats[currentMode];

    if (modeChats.length === 0) {
        list.innerHTML = '<div style="color:#222244;font-size:12px;padding:10px;">No sessions yet</div>';
        return;
    }

    modeChats.forEach(chat => {
        const item = document.createElement('div');
        item.classList.add('chat-item');
        if (chat.id === currentChatId) item.classList.add('active');

        const idEl = document.createElement('div');
        idEl.classList.add('chat-item-id');
        idEl.innerText = chat.caseId;

        const titleEl = document.createElement('div');
        titleEl.classList.add('chat-item-title');
        titleEl.innerText = chat.topicName;

        item.appendChild(idEl);
        item.appendChild(titleEl);
        item.onclick = () => loadChat(chat.id);
        list.appendChild(item);
    });
}

function loadChat(id) {
    currentChatId = id;
    const chat = chats[currentMode].find(c => c.id === id);
    if (!chat) return;

    const chatWindow = document.getElementById('chat-window');
    chatWindow.innerHTML = '';
    chat.messages.forEach(msg => {
        const cls = msg.sender === 'You' ? 'user-message' : msg.sender === 'Case' ? 'problem-message' : 'ai-message';
        appendMessageToWindow(msg.sender, msg.text, cls);
    });

    document.getElementById('header-domain').innerText = chat.title;
    showChatPanel();
    renderSidebar();

    fetch('http://127.0.0.1:8000/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
}

function createNewChat(domain, problem) {
    const id = Date.now().toString();
    const code = getDomainCode(domain);
    const number = getNextNumber(currentMode, domain);
    const caseId = code + '-' + number;
    const topicName = problem ? extractTopicName(problem) : 'New Case';

    const newChat = {
        id,
        code,
        caseId,
        topicName,
        title: caseId + ' · ' + topicName,
        messages: []
    };

    chats[currentMode].push(newChat);
    currentChatId = id;
    saveChats();
    renderSidebar();
}

function appendMessageToWindow(sender, text, customClass) {
    const chatWindow = document.getElementById('chat-window');
    const wrapper = document.createElement('div');
    wrapper.classList.add('message');
    wrapper.classList.add(customClass || (sender === 'You' ? 'user-message' : 'ai-message'));

    const label = document.createElement('div');
    label.classList.add('sender-label');
    label.innerText = sender;

    const content = document.createElement('div');
    content.innerText = text;

    wrapper.appendChild(label);
    wrapper.appendChild(content);
    chatWindow.appendChild(wrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';

    if (!currentChatId) {
        createNewChat(currentDomain, '');
    }

    appendMessageToWindow('You', message, 'user-message');
    saveMessage('You', message);

    const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: message,
            mode: currentMode,
            domain: currentDomain,
            side: currentSide
        })
    });

    const data = await response.json();
    const aiLabel = currentMode === 'judge' ? 'Judge' : 'Lawyer';
    appendMessageToWindow(aiLabel, data.reply, 'ai-message');
    saveMessage(aiLabel, data.reply);
}

async function evaluateSession() {
    const chat = chats[currentMode].find(c => c.id === currentChatId);
    if (chat && chat.evaluation) {
        showPopup(chat.evaluation, chat.caseId + ' · ' + chat.topicName);
        return;
    }

    const response = await fetch('http://127.0.0.1:8000/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();

    if (chat) {
        chat.evaluation = data.evaluation;
        saveChats();
    }

    const chatName = chat ? chat.caseId + ' · ' + chat.topicName : 'Current session';
    showPopup(data.evaluation, chatName);
}

function showPopup(evaluationText, chatName) {
    const lines = evaluationText.split('\n').filter(l => l.trim());
    const get = (key) => {
        const line = lines.find(l => l.startsWith(key + ':'));
        return line ? line.split(':')[1].trim() : '-';
    };

    const scores = {
        'Legal': get('LEGAL_ACCURACY'),
        'Structure': get('STRUCTURE'),
        'Questions': get('QUESTIONS'),
        'Precedents': get('PRECEDENTS'),
        'Persuasion': get('PERSUASIVENESS')
    };

    const total = Object.values(scores).reduce((sum, v) => sum + (parseInt(v) || 0), 0);

    document.getElementById('popup-chat-name').innerText = chatName;

    document.getElementById('popup-scores').innerHTML = Object.entries(scores).map(([label, val]) => `
        <div class="score-card">
            <p class="score-label">${label}</p>
            <p class="score-value">${val}<span class="score-max">/10</span></p>
        </div>
    `).join('');

    document.getElementById('popup-overall').innerHTML = `
        <span class="overall-label">Overall score</span>
        <span class="overall-value">${total}/50</span>
    `;

    const improvements = [get('IMPROVEMENT_1'), get('IMPROVEMENT_2'), get('IMPROVEMENT_3')];
    document.getElementById('popup-improvements').innerHTML = `
        <p class="improvements-title">Key improvements</p>
        ${improvements.map(imp => `
            <div class="improvement-item">
                <span class="improvement-arrow">→</span>
                <p class="improvement-text">${imp}</p>
            </div>
        `).join('')}
    `;

    document.getElementById('popup-overlay').classList.add('active');
}

function closePopup() {
    document.getElementById('popup-overlay').classList.remove('active');
}

function saveMessage(sender, text) {
    const chat = chats[currentMode].find(c => c.id === currentChatId);
    if (!chat) return;
    chat.messages.push({ sender, text });
    saveChats();
}

function saveChats() {
    localStorage.setItem('mootChats', JSON.stringify(chats));
}

document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('user-input');
    if (input) {
        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') sendMessage();
        });
    }
});