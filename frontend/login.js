// Check if already logged in
window.onload = function () {
    const user = JSON.parse(localStorage.getItem('mootUser'));
    if (user) {
        window.location.href = 'index.html';
    }
};

// Google Login Handler
function handleGoogleLogin(response) {
    const token = response.credential;
    const payload = parseJwt(token);

    const user = {
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        loginType: 'google'
    };

    localStorage.setItem('mootUser', JSON.stringify(user));
    window.location.href = 'index.html';
}

// Parse Google JWT token
function parseJwt(token) {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(json);
}

// Email Login
function handleEmailLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorEl = document.getElementById('login-error');

    if (!email || !password) {
        showError(errorEl, 'Please enter your email and password.');
        return;
    }

    const users = JSON.parse(localStorage.getItem('mootUsers')) || [];
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        showError(errorEl, 'Invalid email or password. Please try again.');
        return;
    }

    localStorage.setItem('mootUser', JSON.stringify({
        name: user.name,
        email: user.email,
        loginType: 'email'
    }));

    window.location.href = 'index.html';
}

// Register
function handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const errorEl = document.getElementById('register-error');

    if (!name || !email || !password) {
        showError(errorEl, 'Please fill in all fields.');
        return;
    }

    if (password.length < 6) {
        showError(errorEl, 'Password must be at least 6 characters.');
        return;
    }

    const users = JSON.parse(localStorage.getItem('mootUsers')) || [];
    const exists = users.find(u => u.email === email);

    if (exists) {
        showError(errorEl, 'An account with this email already exists.');
        return;
    }

    users.push({ name, email, password });
    localStorage.setItem('mootUsers', JSON.stringify(users));

    localStorage.setItem('mootUser', JSON.stringify({
        name,
        email,
        loginType: 'email'
    }));

    window.location.href = 'index.html';
}

// Show register card
function showRegister() {
    document.querySelector('.login-card').style.display = 'none';
    document.getElementById('register-card').style.display = 'flex';
}

// Show login card
function showLogin() {
    document.querySelector('.login-card').style.display = 'flex';
    document.getElementById('register-card').style.display = 'none';
}

// Show error message
function showError(el, msg) {
    el.innerText = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}