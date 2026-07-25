// Mobile Admin Sidebar Drawer Functions
function toggleAdminSidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.getElementById('admin-sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
}

function closeAdminSidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.getElementById('admin-sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

let allUsersData = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check if user is admin
    try {
        const isAdmin = await isCurrentUserAdmin();
        if (!isAdmin) {
            showAccessDenied();
            return;
        }
    } catch (e) {
        console.error('Admin verification error:', e);
        showAccessDenied();
        return;
    }

    // 2. Load dashboard data and user tables
    await loadDashboardStats();
    await loadUsersTable();
    await loadSessionsTable();
});

function showAccessDenied() {
    const mainContent = document.querySelectorAll('.tab-content, .admin-sidebar');
    mainContent.forEach(el => el.style.display = 'none');
    const deniedEl = document.getElementById('access-denied');
    if (deniedEl) deniedEl.style.display = 'block';

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 2000);
}

// -------------------------------------------------------------
// TAB NAVIGATION
// -------------------------------------------------------------

function switchAdminTab(tabName) {
    document.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const activeTab = document.getElementById(`tab-${tabName}`);
    const activeSection = document.getElementById(`${tabName}-section`);

    if (activeTab) activeTab.classList.add('active');
    if (activeSection) activeSection.classList.add('active');

    if (tabName === 'settings') {
        loadSettingsPage();
    }
}

// -------------------------------------------------------------
// DASHBOARD STATS
// -------------------------------------------------------------

async function loadDashboardStats() {
    const users = await getAllUsers();
    const totalSessions = await getAllSessionsCount();

    const totalUsers = users.length;
    const adminCount = users.filter(u => u.role === 'admin').length;
    const deactivatedCount = users.filter(u => u.status === 'deactivated').length;

    document.getElementById('stat-total-users').textContent = totalUsers;
    document.getElementById('stat-admins').textContent = adminCount;
    document.getElementById('stat-deactivated').textContent = deactivatedCount;
    document.getElementById('stat-total-sessions').textContent = totalSessions;

    // Render Recent Signups (last 5)
    const recentUsers = [...users].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
    const tbody = document.getElementById('recent-signups-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (recentUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--subtext);">No users registered yet.</td></tr>';
        return;
    }

    recentUsers.forEach(user => {
        const tr = document.createElement('tr');
        const roleBadge = user.role === 'admin' ? 
            '<span class="badge-role admin">👑 Admin</span>' : 
            '<span class="badge-role user">👤 User</span>';

        tr.innerHTML = `
            <td>
                <div class="user-avatar-cell">
                    <div class="avatar-circle">${(user.full_name || user.email || 'U').charAt(0).toUpperCase()}</div>
                    <span>${escapeHtml(user.full_name || 'User')}</span>
                </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>${roleBadge}</td>
            <td>${formatDate(user.created_at)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// -------------------------------------------------------------
// USERS TABLE & FILTERING
// -------------------------------------------------------------

async function loadUsersTable() {
    console.log('[loadUsersTable] Fetching fresh users list from Supabase...');
    allUsersData = await getAllUsers();
    console.log('[loadUsersTable] Fresh users data:', allUsersData);
    filterUsersTable();
}

function filterUsersTable() {
    const query = (document.getElementById('user-search').value || '').toLowerCase().trim();
    const filter = document.getElementById('user-filter').value;

    let filtered = allUsersData.filter(user => {
        const nameMatch = (user.full_name || '').toLowerCase().includes(query);
        const emailMatch = (user.email || '').toLowerCase().includes(query);
        const matchesSearch = nameMatch || emailMatch;

        if (!matchesSearch) return false;

        if (filter === 'admins') return user.role === 'admin';
        if (filter === 'users') return user.role === 'user';
        if (filter === 'deactivated') return user.status === 'deactivated';
        return true;
    });

    renderUsersTable(filtered);
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    console.log('[renderUsersTable] Rendering table with', users.length, 'users');

    tbody.innerHTML = '';
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--subtext); padding: 20px;">No matching users found.</td></tr>';
        return;
    }

    users.forEach(user => {
        const normStatus = String(user.status || 'active').toLowerCase().trim();
        const isActive = normStatus === 'active';

        console.log('Rendering row for', user.email, 'status:', user.status, 'normStatus:', normStatus, 'isActive:', isActive);

        const tr = document.createElement('tr');

        const roleBadge = user.role === 'admin' ? 
            '<span class="badge-role admin">👑 Admin</span>' : 
            '<span class="badge-role user">👤 User</span>';

        const statusBadge = isActive ? 
            '<span class="badge-status active">🟢 Active</span>' : 
            '<span class="badge-status deactivated">🔴 Deactivated</span>';

        const roleBtnText = user.role === 'admin' ? '👤 Remove Admin' : '👑 Make Admin';
        const roleBtnClass = 'btn-action btn-role';

        const statusBtnHTML = isActive 
            ? `<button class="btn-action btn-deactivate" onclick="handleToggleStatus('${user.id}', '${escapeQuotes(user.full_name || user.email)}', 'active')">🚫 Deactivate</button>`
            : `<button class="btn-action btn-activate" onclick="handleToggleStatus('${user.id}', '${escapeQuotes(user.full_name || user.email)}', 'deactivated')">✅ Activate</button>`;

        tr.innerHTML = `
            <td>
                <div class="user-avatar-cell">
                    <div class="avatar-circle">${(user.full_name || user.email || 'U').charAt(0).toUpperCase()}</div>
                    <span style="font-weight: 600;">${escapeHtml(user.full_name || 'User')}</span>
                </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>${formatDate(user.created_at)}</td>
            <td>${user.last_login ? formatDate(user.last_login) : 'Never'}</td>
            <td>
                <div class="action-btns-row">
                    <button class="${roleBtnClass}" onclick="handleMakeAdmin('${user.id}', '${escapeQuotes(user.full_name || user.email)}', '${user.role}')">${roleBtnText}</button>
                    ${statusBtnHTML}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// -------------------------------------------------------------
// USER ACTIONS
// -------------------------------------------------------------

function handleMakeAdmin(userId, userName, currentRole) {
    const isPromoting = currentRole !== 'admin';
    const title = isPromoting ? 'Promote to Admin' : 'Remove Admin Privileges';
    const msg = isPromoting ? 
        `Make ${userName} an admin? They will have full access to the admin panel.` : 
        `Remove admin privileges from ${userName}?`;

    showConfirmModal(title, msg, async () => {
        const newRole = isPromoting ? 'admin' : 'user';
        const { error } = await updateUserRole(userId, newRole);
        if (error) {
            showToast('Failed to update user role: ' + error.message, 'error');
        } else {
            showToast(`Successfully updated role for ${userName} to ${newRole}.`, 'success');
            await loadDashboardStats();
            await loadUsersTable();
        }
    });
}

async function handleToggleStatus(userId, userName, currentStatus) {
    const normStatus = String(currentStatus || 'active').toLowerCase().trim();
    const isCurrentlyActive = normStatus === 'active';
    const newStatus = isCurrentlyActive ? 'deactivated' : 'active';
    const actionText = newStatus === 'deactivated' ? 'Deactivate' : 'Activate';

    console.log('Toggling status. Current:', currentStatus, 'New:', newStatus);

    showConfirmModal(
        `${actionText} User?`,
        `${actionText} ${userName}? ${newStatus === 'deactivated' ? 'They will not be able to log in until reactivated.' : 'They will regain access immediately.'}`,
        async () => {
            try {
                const result = await updateUserStatus(userId, newStatus);
                console.log('Update result:', result?.data, 'error:', result?.error);

                if (result?.error) {
                    showToast('Failed to update status: ' + result.error.message, 'error');
                } else {
                    showToast(`User ${actionText.toLowerCase()}d successfully`, 'success');
                    console.log('Refreshing table now...');
                    await loadUsersTable();
                    await loadDashboardStats();
                }
            } catch (err) {
                console.error('[handleToggleStatus] Exception:', err);
                showToast('Failed to update status: ' + err.message, 'error');
            }
        }
    );
}

// -------------------------------------------------------------
// ALL SESSIONS TABLE & FILTER BAR
// -------------------------------------------------------------

let allRawSessionsData = [];

async function loadSessionsTable() {
    allRawSessionsData = await getAllSessionsWithUsers();
    initSessionFilterListeners();
    applySessionFilters();
}

function applySessionFilters() {
    const tbody = document.getElementById('sessions-table-body');
    const countLabel = document.getElementById('sessions-count-label');
    if (!tbody) return;

    const searchQuery = (document.getElementById('session-search-input')?.value || '').toLowerCase().trim();
    const domainFilter = document.getElementById('session-domain-select')?.value || 'all';
    const sideFilter = (document.getElementById('session-side-select')?.value || 'all').toLowerCase();
    const dateVal = document.getElementById('session-date-input')?.value || '';
    const dateMode = document.getElementById('session-date-mode')?.value || 'exact';

    let filtered = [...allRawSessionsData];

    // 1. USER SEARCH (Matches Name or Email)
    if (searchQuery) {
        filtered = filtered.filter(s => {
            const userObj = s.profiles || {};
            const name = (userObj.full_name || '').toLowerCase();
            const email = (userObj.email || '').toLowerCase();
            return name.includes(searchQuery) || email.includes(searchQuery);
        });
    }

    // 2. DOMAIN FILTER
    if (domainFilter !== 'all') {
        filtered = filtered.filter(s => {
            return (s.domain || '').toLowerCase() === domainFilter.toLowerCase();
        });
    }

    // 3. SIDE FILTER
    if (sideFilter !== 'all') {
        filtered = filtered.filter(s => {
            return (s.side || '').toLowerCase() === sideFilter;
        });
    }

    // 4. DATE FILTER (Exact Date / This Month / This Year)
    if (dateVal) {
        const [selYearStr, selMonthStr, selDayStr] = dateVal.split('-');
        const selYear = parseInt(selYearStr, 10);
        const selMonth = parseInt(selMonthStr, 10) - 1; // 0-indexed month
        const selDay = parseInt(selDayStr, 10);

        filtered = filtered.filter(s => {
            if (!s.created_at) return false;
            const sDate = new Date(s.created_at);
            const sYear = sDate.getFullYear();
            const sMonth = sDate.getMonth();
            const sDay = sDate.getDate();

            if (dateMode === 'exact') {
                return sYear === selYear && sMonth === selMonth && sDay === selDay;
            } else if (dateMode === 'month') {
                return sYear === selYear && sMonth === selMonth;
            } else if (dateMode === 'year') {
                return sYear === selYear;
            }
            return true;
        });
    }

    // Update Result Count Text
    if (countLabel) {
        countLabel.textContent = `Showing ${filtered.length} of ${allRawSessionsData.length} sessions`;
    }

    // Render Table Rows
    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--subtext); padding: 24px; font-style: italic;">No sessions match active filters.</td></tr>';
        return;
    }

    filtered.forEach(session => {
        const tr = document.createElement('tr');
        const userObj = session.profiles || {};
        const userName = userObj.full_name || userObj.email || 'Unknown User';
        const msgCount = session.messages ? session.messages.length : 0;

        tr.innerHTML = `
            <td>
                <div style="font-weight: 600;">${escapeHtml(userName)}</div>
                <div style="font-size: 11px; color: var(--subtext);">${escapeHtml(userObj.email || '')}</div>
            </td>
            <td><span style="font-weight: 700; color: var(--gold);">${escapeHtml(session.domain)}</span></td>
            <td><span style="text-transform: capitalize;">${escapeHtml(session.side)}</span></td>
            <td>${formatDate(session.created_at)}</td>
            <td>${msgCount} messages</td>
        `;
        tbody.appendChild(tr);
    });
}

function clearDateFilter() {
    const dateInput = document.getElementById('session-date-input');
    if (dateInput) {
        dateInput.value = '';
        applySessionFilters();
    }
}

function resetAllSessionFilters() {
    const searchInput = document.getElementById('session-search-input');
    const domainSelect = document.getElementById('session-domain-select');
    const sideSelect = document.getElementById('session-side-select');
    const dateInput = document.getElementById('session-date-input');
    const dateMode = document.getElementById('session-date-mode');

    if (searchInput) searchInput.value = '';
    if (domainSelect) domainSelect.value = 'all';
    if (sideSelect) sideSelect.value = 'all';
    if (dateInput) dateInput.value = '';
    if (dateMode) dateMode.value = 'exact';

    applySessionFilters();
}

function initSessionFilterListeners() {
    const searchInput = document.getElementById('session-search-input');
    const domainSelect = document.getElementById('session-domain-select');
    const sideSelect = document.getElementById('session-side-select');
    const dateInput = document.getElementById('session-date-input');
    const dateMode = document.getElementById('session-date-mode');

    if (searchInput && !searchInput.dataset.listenerAttached) {
        searchInput.addEventListener('input', applySessionFilters);
        searchInput.dataset.listenerAttached = 'true';
    }
    if (domainSelect && !domainSelect.dataset.listenerAttached) {
        domainSelect.addEventListener('change', applySessionFilters);
        domainSelect.dataset.listenerAttached = 'true';
    }
    if (sideSelect && !sideSelect.dataset.listenerAttached) {
        sideSelect.addEventListener('change', applySessionFilters);
        sideSelect.dataset.listenerAttached = 'true';
    }
    if (dateInput && !dateInput.dataset.listenerAttached) {
        dateInput.addEventListener('change', applySessionFilters);
        dateInput.dataset.listenerAttached = 'true';
    }
    if (dateMode && !dateMode.dataset.listenerAttached) {
        dateMode.addEventListener('change', applySessionFilters);
        dateMode.dataset.listenerAttached = 'true';
    }
}

// -------------------------------------------------------------
// SETTINGS PAGE & SYSTEM EXPORT
// -------------------------------------------------------------

async function loadSettingsPage() {
    try {
        const users = await getAllUsers();
        const adminUsers = users.filter(u => u.role === 'admin');

        const userCount = users.length;
        const sessionsCount = await getAllSessionsCount();
        
        let messageCount = 0;
        try {
            const { count } = await supabaseClient
                .from('messages')
                .select('*', { count: 'exact', head: true });
            messageCount = count || 0;
        } catch(e) {
            console.warn('Could not fetch message count:', e);
        }

        const usersEl = document.getElementById('settings-stat-users');
        if (usersEl) usersEl.textContent = userCount;

        const sessionsEl = document.getElementById('settings-stat-sessions');
        if (sessionsEl) sessionsEl.textContent = sessionsCount;

        const msgsEl = document.getElementById('settings-stat-messages');
        if (msgsEl) msgsEl.textContent = messageCount;

        const listEl = document.getElementById('admin-accounts-list');
        if (listEl) {
            listEl.innerHTML = '';
            if (adminUsers.length === 0) {
                listEl.innerHTML = '<p style="color: var(--subtext); padding: 10px;">No admin accounts found.</p>';
            } else {
                adminUsers.forEach(admin => {
                    const row = document.createElement('div');
                    row.className = 'admin-account-card';
                    row.innerHTML = `
                        <div class="user-avatar-cell">
                            <div class="avatar-circle">${(admin.full_name || admin.email || 'A').charAt(0).toUpperCase()}</div>
                            <div>
                                <div style="font-weight: 600; color: var(--text);">${escapeHtml(admin.full_name || 'Admin User')}</div>
                                <div style="font-size: 12px; color: var(--subtext);">${escapeHtml(admin.email)}</div>
                            </div>
                        </div>
                        <span class="badge-role admin">👑 Admin</span>
                    `;
                    listEl.appendChild(row);
                });
            }
        }
    } catch(e) {
        console.error('Error loading settings page:', e);
    }
}

function exportAllUserData() {
    getAllUsers().then(users => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(users, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `moot_court_ai_users_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('All user profiles exported successfully!', 'success');
    }).catch(err => {
        showToast('Failed to export user data: ' + err.message, 'error');
    });
}

// -------------------------------------------------------------
// CUSTOM CONFIRMATION MODAL & TOASTS
// -------------------------------------------------------------

function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;

    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-msg');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    const iconCircle = document.getElementById('confirm-modal-icon-circle');
    const iconEl = document.getElementById('confirm-modal-icon');
    const okBtn = document.getElementById('confirm-modal-ok');
    const cancelBtn = document.getElementById('confirm-modal-cancel');

    if (!okBtn || !cancelBtn) return;

    const isDeactivate = title.toLowerCase().includes('deactivate');
    const isActivate = title.toLowerCase().includes('activate');

    if (iconCircle && iconEl) {
        iconCircle.className = 'modal-icon-circle';
        if (isDeactivate) {
            iconCircle.classList.add('deactivate');
            iconEl.textContent = '🚫';
        } else if (isActivate) {
            iconCircle.classList.add('activate');
            iconEl.textContent = '✅';
        } else {
            iconCircle.classList.add('admin');
            iconEl.textContent = '👑';
        }
    }

    okBtn.className = 'modal-btn-confirm';
    if (isDeactivate) {
        okBtn.classList.add('deactivate');
    } else if (isActivate) {
        okBtn.classList.add('activate');
    } else {
        okBtn.classList.add('admin');
    }

    // Clone buttons to clear previous listeners
    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);

    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener('click', () => {
        modal.classList.remove('open');
        if (onConfirm) onConfirm();
    });

    newCancelBtn.addEventListener('click', () => {
        modal.classList.remove('open');
    });

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.remove('open');
        }
    };

    modal.classList.add('open');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function logoutAdmin() {
    if (typeof signOut === 'function') {
        signOut();
    }
    localStorage.clear();
    window.location.href = 'login.html';
}

// UTILITY FUNCTIONS
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}
