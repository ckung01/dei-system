const DEI_AUTH_KEY = 'dei_current_user';
const DEI_PREFILL_LOGIN_KEY = 'dei_prefill_login';

const ROLE_LABELS = {
    inspector: 'ผู้ตรวจสอบ',
    approver: 'ผู้อนุมัติ',
    admin: 'ผู้ดูแลระบบ'
};

function extractFirstName(fullName) {
    const clean = String(fullName || '').trim().replace(/\s+/g, ' ');
    if (!clean) return 'ผู้ใช้งาน';
    return clean.split(' ')[0];
}

const DEIAuth = {
    getUser() {
        try {
            const raw = sessionStorage.getItem(DEI_AUTH_KEY) || localStorage.getItem(DEI_AUTH_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    setUser(user, remember = true) {
        const str = JSON.stringify(user);
        localStorage.setItem(DEI_AUTH_KEY, str);
        if (remember) {
            sessionStorage.setItem(DEI_AUTH_KEY, str);
        }
    },

    setPrefillLogin(username, password) {
        sessionStorage.setItem(DEI_PREFILL_LOGIN_KEY, JSON.stringify({ username, password }));
    },

    consumePrefillLogin() {
        try {
            const raw = sessionStorage.getItem(DEI_PREFILL_LOGIN_KEY);
            if (!raw) return null;
            sessionStorage.removeItem(DEI_PREFILL_LOGIN_KEY);
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    },

    logout() {
        localStorage.removeItem(DEI_AUTH_KEY);
        sessionStorage.removeItem(DEI_AUTH_KEY);
        window.location.href = 'login.html';
    },

    async login(username, password) {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok && data.success && data.user) {
            this.setUser(data.user, true);
        }
        return data;
    },

    async register(payload) {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    },

    async requestResetCode(email) {
        const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        return await res.json();
    },

    async confirmNewPassword(email, code, newPassword) {
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, newPassword })
        });
        return await res.json();
    },

    getHomePageByRole(role) {
        if (role === 'approver') return 'approval.html';
        if (role === 'admin') return 'admin.html';
        return 'index.html';
    },

    canAccessPage(role, pageName) {
        if (role === 'admin') return true;
        if (role === 'inspector') {
            return ['index.html', 'history.html'].includes(pageName);
        }
        if (role === 'approver') {
            return ['approval.html', 'history.html'].includes(pageName);
        }
        return false;
    },

    enforceAccess(allowedRoles = []) {
        const user = this.getUser();
        const pathParts = window.location.pathname.split('/');
        const currentPage = pathParts[pathParts.length - 1] || 'index.html';

        if (!user) {
            window.location.href = 'login.html';
            return null;
        }

        if (!this.canAccessPage(user.role, currentPage)) {
            window.location.href = this.getHomePageByRole(user.role);
            return null;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
            window.location.href = this.getHomePageByRole(user.role);
            return null;
        }

        this.applyRoleUI(user);
        return user;
    },

    applyRoleUI(user) {
        const firstName = extractFirstName(user.fullName || user.username);
        const roleText = ROLE_LABELS[user.role] || 'ผู้ตรวจสอบ';
        const headerRight = document.querySelector('.header-right');

        if (headerRight) {
            let firstNameBadge = headerRight.querySelector('.user-first-name');
            if (!firstNameBadge) {
                firstNameBadge = document.createElement('div');
                firstNameBadge.className = 'user-first-name';
                firstNameBadge.style.cssText = 'font-weight:600;color:#ffffff;margin-right:6px;';
                const roleBadge = headerRight.querySelector('.user-role-badge');
                if (roleBadge) {
                    headerRight.insertBefore(firstNameBadge, roleBadge);
                } else {
                    headerRight.appendChild(firstNameBadge);
                }
            }
            firstNameBadge.textContent = firstName;
        }

        const roleBadge = document.querySelector('.user-role-badge');
        if (roleBadge) {
            roleBadge.innerHTML = `<span class="role-dot"></span> ${roleText}`;
        }

        const logoutBtn = document.querySelector('.btn-logout');
        if (logoutBtn) {
            logoutBtn.removeAttribute('onclick');
            logoutBtn.onclick = () => this.logout();
        }

        const navList = document.querySelector('.nav-list');
        if (!navList) return;

        let adminLink = navList.querySelector('a[href="admin.html"]');
        if (user.role === 'admin' && !adminLink) {
            adminLink = document.createElement('a');
            adminLink.href = 'admin.html';
            adminLink.className = 'nav-item';
            adminLink.textContent = 'จัดการระบบ (Admin)';
            navList.appendChild(adminLink);
        } else if (user.role !== 'admin' && adminLink) {
            adminLink.remove();
        }

        const navItems = navList.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const href = item.getAttribute('href');
            if (user.role === 'inspector') {
                item.style.display = (href === 'index.html' || href === 'history.html') ? '' : 'none';
            } else if (user.role === 'approver') {
                item.style.display = (href === 'approval.html' || href === 'history.html') ? '' : 'none';
            } else if (user.role === 'admin') {
                item.style.display = '';
            }
        });
    }
};

