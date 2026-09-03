window.switchView = function(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('nav a').forEach(el => el.classList.remove('active'));

    const targetView = document.getElementById('view-' + viewName);
    if (targetView) targetView.classList.add('active');
    
    const navEl = document.getElementById('nav-' + viewName);
    if (navEl) navEl.classList.add('active');
    
    window.scrollTo(0, 0);
};

window.resetFilters = function() {
    document.getElementById('search-keyword').value = '';
    document.getElementById('search-gender').value = 'Mindegy';
    document.getElementById('search-min-age').value = '18';
    document.getElementById('search-max-age').value = '99';
    document.getElementById('search-region').value = 'Összes megye / régió';
};

document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();

    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const displayName = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName, email, password })
                });
                const data = await res.json();
                if (res.ok) {
                    alert('Sikeres regisztráció! Kérlek, jelentkezz be.');
                    window.switchView('login');
                } else {
                    alert(data.error || 'Hiba történt.');
                }
            } catch (err) {
                alert('Szerverhiba.');
            }
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (res.ok) {
                    localStorage.setItem('token', data.token);
                    alert('Sikeres bejelentkezés!');
                    window.location.reload();
                } else {
                    alert(data.error || 'Hibás adatok.');
                }
            } catch (err) {
                alert('Szerverhiba.');
            }
        });
    }

    const profileInfoForm = document.getElementById('profile-info-form');
    if (profileInfoForm) {
        profileInfoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const displayName = document.getElementById('profile-name-input').value;
            const age = document.getElementById('profile-age-input').value;
            const gender = document.getElementById('profile-gender-input').value;

            try {
                const res = await fetch('/api/user/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ displayName, age, gender })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Profil adatok sikeresen mentve!');
                    loadUserProfile();
                } else {
                    alert(data.error || 'Hiba a mentés során.');
                }
            } catch (err) {
                alert('Szerverhiba.');
            }
        });
    }

    const photoForm = document.getElementById('photo-upload-form');
    if (photoForm) {
        photoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            const profileFile = document.getElementById('input-profile-img').files[0];
            const privateFile = document.getElementById('input-private-img').files[0];

            if (profileFile) formData.append('profileImage', profileFile);
            if (privateFile) formData.append('privateImage', privateFile);

            try {
                const res = await fetch('/api/user/upload-photos', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    alert('Képek sikeresen feltöltve!');
                    loadUserProfile();
                } else {
                    alert('Hiba a képek feltöltésekor.');
                }
            } catch (err) {
                alert('Szerverhiba.');
            }
        });
    }

    if (window.google) {
        const GOOGLE_CLIENT_ID = '685022025527-sj6jsgq4l67doi63d124pj2630pmqeac.apps.googleusercontent.com';
        try {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleResponse
            });

            const loginBtnDiv = document.getElementById('google-signin-btn-login');
            if (loginBtnDiv) {
                google.accounts.id.renderButton(loginBtnDiv, { theme: 'outline', size: 'large', width: '320' });
            }
            const regBtnDiv = document.getElementById('google-signin-btn-reg');
            if (regBtnDiv) {
                google.accounts.id.renderButton(regBtnDiv, { theme: 'outline', size: 'large', width: '320' });
            }
        } catch (e) {
            console.log('Google Auth nem inicializálódott.');
        }
    }
});

async function handleGoogleResponse(response) {
    try {
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            alert('Sikeres Google bejelentkezés!');
            window.location.reload();
        } else {
            alert(data.error || 'Google hitelesítési hiba.');
        }
    } catch (err) {
        alert('Szerverhiba.');
    }
}

async function checkAuthState() {
    const token = localStorage.getItem('token');
    if (token) {
        const profileNav = document.getElementById('nav-profile');
        if (profileNav) profileNav.style.display = 'inline';

        const navButtons = document.getElementById('nav-buttons-container');
        if (navButtons) {
            navButtons.innerHTML = `<button class="btn-primary" onclick="window.switchView('profile')">Saját Profilom</button>`;
        }
        loadUserProfile();
    }
}

async function loadUserProfile() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const user = await res.json();
            document.getElementById('profile-name-input').value = user.displayName || '';
            document.getElementById('profile-age-input').value = user.age || 18;
            document.getElementById('profile-gender-input').value = user.gender || 'Nő';
            document.getElementById('profile-credits').textContent = user.credits || 0;
            
            if (user.profileImage) {
                document.getElementById('prev-profile-img').src = user.profileImage;
            }
            if (user.privateImage) {
                document.getElementById('prev-private-img').src = user.privateImage;
            }
        }
    } catch (err) {
        console.error('Nem sikerült betölteni a profil adatokat.');
    }
}

window.logout = function() {
    localStorage.removeItem('token');
    window.location.href = '/';
};

window.buyCredits = async function(packageSize) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('A vásárláshoz be kell jelentkezned!');
        window.switchView('login');
        return;
    }

    try {
        const res = await fetch('/api/payment/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ creditPackage: packageSize })
        });
        const data = await res.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            alert(data.error || 'Hiba a fizetés indításakor.');
        }
    } catch (err) {
        alert('Szerverhiba.');
    }
};
