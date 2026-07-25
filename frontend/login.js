// ═════════════════════════════════════════════════════════════
// MOOT COURT AI — AUTHENTICATION HANDLER (SUPABASE + GUEST)
// ═════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check if user is already logged in as guest
    const isGuest = localStorage.getItem('mootcourt_is_guest') === 'true';
    if (isGuest) {
        window.location.href = 'app.html';
        return;
    }

    // 2. Check if user is already logged in via Supabase
    if (typeof getCurrentUser === 'function') {
        try {
            const user = await getCurrentUser();
            if (user) {
                window.location.href = 'app.html';
                return;
            }
        } catch (e) {
            console.warn('Supabase auth check deferred:', e);
        }
    }

    // 3. Check for OAuth callback token in URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        window.location.href = 'app.html';
        return;
    }

    // 4. Initialize event listeners
    initAuthEventListeners();
});

function initAuthEventListeners() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleEmailLogin);
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleEmailSignup);
    }

    const googleBtn = document.getElementById('google-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', handleGoogleLogin);
    }

    const guestBtn = document.getElementById('guest-btn');
    if (guestBtn) {
        guestBtn.addEventListener('click', handleGuestLogin);
    }

    // Password Toggle Listeners
    document.querySelectorAll('.toggle-password-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-target');
            if (targetId) togglePasswordVisibility(targetId, btn);
        });
    });
}

// ═════════════════════════════════════════════════════════════
// EMAIL LOGIN
// ═════════════════════════════════════════════════════════════

async function handleEmailLogin(e) {
    if (e) e.preventDefault();
    clearErrors();

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const btn = document.getElementById('login-btn');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (!email || !password) {
        showError('login-error', 'Please enter your email and password.');
        return;
    }

    if (btn) {
        btn.textContent = 'Signing in...';
        btn.classList.add('btn-loading');
        btn.disabled = true;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            let msg = error.message;
            if (error.message.includes('Invalid login credentials')) {
                msg = 'Wrong email or password. Try again.';
            } else if (error.message.includes('Email not confirmed')) {
                msg = 'Please check your email to confirm your account.';
            }
            showError('login-error', msg);

            if (btn) {
                btn.textContent = 'Sign In →';
                btn.classList.remove('btn-loading');
                btn.disabled = false;
            }
            return;
        }

        // Login successful — clear guest status
        localStorage.removeItem('mootcourt_is_guest');
        localStorage.removeItem('mootcourt_user');

        const errEl = document.getElementById('login-error');
        if (errEl) {
            errEl.className = 'success-msg';
            errEl.textContent = 'Welcome back! Redirecting...';
            errEl.style.display = 'block';
        }

        setTimeout(() => {
            window.location.href = 'app.html';
        }, 1000);

    } catch (err) {
        showError('login-error', err.message || 'An unexpected error occurred.');
        if (btn) {
            btn.textContent = 'Sign In →';
            btn.classList.remove('btn-loading');
            btn.disabled = false;
        }
    }
}

// ═════════════════════════════════════════════════════════════
// EMAIL SIGN UP
// ═════════════════════════════════════════════════════════════

async function handleEmailSignup(e) {
    if (e) e.preventDefault();
    clearErrors();

    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const confirmInput = document.getElementById('signup-confirm');
    const btn = document.getElementById('signup-btn');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    const confirm = confirmInput ? confirmInput.value.trim() : '';

    if (!name) {
        showError('signup-error', 'Please enter your name.');
        return;
    }

    if (!email) {
        showError('signup-error', 'Please enter a valid email address.');
        return;
    }

    if (!password || password.length < 6) {
        showError('signup-error', 'Password must be at least 6 characters.');
        return;
    }

    if (password !== confirm) {
        showError('signup-error', 'Passwords do not match.');
        return;
    }

    if (btn) {
        btn.textContent = 'Creating Account...';
        btn.classList.add('btn-loading');
        btn.disabled = true;
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: name
                }
            }
        });

        if (error) {
            showError('signup-error', error.message);
            if (btn) {
                btn.textContent = 'Create Account →';
                btn.classList.remove('btn-loading');
                btn.disabled = false;
            }
            return;
        }

        // Signup successful
        localStorage.removeItem('mootcourt_is_guest');
        localStorage.removeItem('mootcourt_user');

        const signupForm = document.getElementById('signup-form');
        if (signupForm) signupForm.style.display = 'none';

        const successEl = document.getElementById('signup-success');
        if (successEl) {
            successEl.textContent = '✅ Account created successfully! Signing you in...';
            successEl.style.display = 'block';
        }

        setTimeout(() => {
            window.location.href = 'app.html';
        }, 1500);

    } catch (err) {
        showError('signup-error', err.message || 'An unexpected error occurred.');
        if (btn) {
            btn.textContent = 'Create Account →';
            btn.classList.remove('btn-loading');
            btn.disabled = false;
        }
    }
}

// ═════════════════════════════════════════════════════════════
// GOOGLE LOGIN
// ═════════════════════════════════════════════════════════════

async function handleGoogleLogin() {
    clearErrors();
    const btn = document.getElementById('google-btn');
    if (btn) {
        btn.textContent = 'Connecting to Google...';
        btn.classList.add('btn-loading');
        btn.disabled = true;
    }

    try {
        localStorage.removeItem('mootcourt_is_guest');
        localStorage.removeItem('mootcourt_user');

        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/app.html'
            }
        });

        if (error) {
            showError('login-error', error.message);
            if (btn) {
                btn.textContent = 'Continue with Google';
                btn.classList.remove('btn-loading');
                btn.disabled = false;
            }
        }
    } catch (err) {
        showError('login-error', err.message || 'Failed to connect to Google.');
        if (btn) {
            btn.textContent = 'Continue with Google';
            btn.classList.remove('btn-loading');
            btn.disabled = false;
        }
    }
}

// ═════════════════════════════════════════════════════════════
// GUEST LOGIN
// ═════════════════════════════════════════════════════════════

function handleGuestLogin() {
    clearErrors();
    const guestUser = {
        id: 'guest_' + Date.now(),
        name: 'Guest',
        email: 'guest@mootcourt.ai',
        isGuest: true
    };

    localStorage.setItem('mootcourt_user', JSON.stringify(guestUser));
    localStorage.setItem('mootcourt_is_guest', 'true');
    window.location.href = 'app.html';
}

// ═════════════════════════════════════════════════════════════
// SHOW / HIDE PASSWORD TOGGLE
// ═════════════════════════════════════════════════════════════

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.textContent = '🙈';
    } else {
        input.type = 'password';
        if (btn) btn.textContent = '👁';
    }
}

// ═════════════════════════════════════════════════════════════
// FORM TOGGLE (LOGIN / SIGNUP)
// ═════════════════════════════════════════════════════════════

function showSignup() {
    const loginSec = document.getElementById('login-section');
    const signupSec = document.getElementById('signup-section');
    const signupForm = document.getElementById('signup-form');

    if (loginSec) loginSec.style.display = 'none';
    if (signupSec) signupSec.style.display = 'block';
    if (signupForm) signupForm.style.display = 'block';

    clearErrors();
    const nameInput = document.getElementById('signup-name');
    if (nameInput) nameInput.focus();
}

function showLogin() {
    const loginSec = document.getElementById('login-section');
    const signupSec = document.getElementById('signup-section');

    if (signupSec) signupSec.style.display = 'none';
    if (loginSec) loginSec.style.display = 'block';

    clearErrors();
    const emailInput = document.getElementById('login-email');
    if (emailInput) emailInput.focus();
}

// ═════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.className = 'error-msg';
        el.textContent = message;
        el.style.display = 'block';
    }
}

function clearErrors() {
    const errors = document.querySelectorAll('.error-msg, .success-msg');
    errors.forEach(e => {
        e.textContent = '';
        e.style.display = 'none';
    });
}