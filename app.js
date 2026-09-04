import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBgbixws2rf6VdqjQATVwZsKg0lgiqy0xI",
    authDomain: "ordog-fizetes.firebaseapp.com",
    databaseURL: "https://ordog-fizetes-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ordog-fizetes",
    storageBucket: "ordog-fizetes.firebasestorage.app",
    messagingSenderId: "672089263660",
    appId: "1:672089263660:web:3797a2fc935c63a0464b89",
    measurementId: "G-V9Z9LYT0KL"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'ordog-fizetes-dating';

let app, auth, db;
let isFirebaseInitialized = false;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseInitialized = true;
    document.getElementById('firebase-status-text').innerText = "Firebase kapcsolat aktív (ordog-fizetes projekt). Adatok szinkronizálva a Firestore felhőben.";
    document.getElementById('firebase-status-banner').className = "mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2";
} catch(e) {
    console.error("Firebase init failed", e);
    document.getElementById('firebase-status-text').innerText = "Hiba a Firebase inicializálásakor (Biztonsági korlátozás vagy offline mód aktív).";
}

let currentUser = null;
let userData = {
    uid: '',
    name: '',
    email: '',
    avatar: 'https://placehold.co/200x200/1e293b/cbd5e1?text=U',
    age: 24,
    location: 'Budapest, Magyarország',
    bio: 'Szia! Szeretek utazni, kávézni és új embereket megismerni.',
    interests: ['Utazás', 'Kávé', 'Zene', 'Fitness'],
    photos: ['https://placehold.co/400x500/1e293b/cbd5e1?text=Profilkep'],
    coins: 150,
    isVip: false,
    isAdmin: false
};

let currentTab = 'discover';
let discoverMode = 'swipe';
let allUsers = [];
let currentCardIndex = 0;
let matchesList = [];
let activeMatchId = null;
let messagesUnsubscribe = null;
let messagesData = {};

window.switchTab = switchTab;
window.setAuthMode = setAuthMode;
window.handleGoogleLogin = handleGoogleLogin;
window.handleEmailAuth = handleEmailAuth;
window.handleLogout = handleLogout;
window.setDiscoverMode = setDiscoverMode;
window.swipeCard = swipeCard;
window.openUserProfile = openUserProfile;
window.openChat = openChat;
window.closeMobileChat = closeMobileChat;
window.handleSendMessage = handleSendMessage;
window.openGiftModal = openGiftModal;
window.viewActiveChatProfile = viewActiveChatProfile;
window.upgradeToVip = upgradeToVip;
window.buyCoins = buyCoins;
window.openEditProfileModal = openEditProfileModal;
window.saveProfileChanges = saveProfileChanges;
window.uploadPhotoPrompt = uploadPhotoPrompt;
window.confirmUploadPhoto = confirmUploadPhoto;
window.deletePhoto = deletePhoto;
window.loadAdminData = loadAdminData;
window.adminToggleVip = adminToggleVip;
window.closeModal = closeModal;

window.addEventListener('DOMContentLoaded', async () => {
    if (isFirebaseInitialized && auth) {
        try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            }
        } catch(err) {
            console.warn("Custom token sign-in warning:", err);
        }

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                await fetchUserData(user.uid);
            } else {
                showAuthView();
            }
        });
    } else {
        showAuthView();
    }
});

async function fetchUserData(uid) {
    if (!isFirebaseInitialized) return;
    try {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            userData = snap.data();
        } else {
            userData.uid = uid;
            userData.email = currentUser.email || 'user@ordogfizetes.hu';
            userData.name = currentUser.displayName || (userData.email.split('@')[0]) || 'Új Felhasználó';
            if (userData.email.includes('admin') || userData.email === 'admin@ordogfizetes.hu') {
                userData.isAdmin = true;
            }
            await setDoc(userRef, userData);
        }
        showMainApp();
    } catch(e) {
        console.error("Error fetching user data", e);
        showAuthView();
    }
}

async function saveUserDataToFirebase() {
    if (!isFirebaseInitialized || !currentUser) return;
    try {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUser.uid);
        await setDoc(userRef, userData, { merge: true });
    } catch(e) {
        console.error("Error saving user data", e);
    }
}

function showAuthView() {
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('main-header').classList.add('hidden');
    document.getElementById('mobile-bottom-nav').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('mobile-bottom-nav').classList.remove('hidden');

    if (userData.isAdmin || userData.email.includes('admin')) {
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('mob-nav-admin').classList.remove('hidden');
        document.getElementById('mob-nav-admin').classList.add('flex');
    }

    updateHeaderUI();
    listenToAllUsers();
    listenToMatches();
    renderProfile();
}

let isRegisterMode = false;
function setAuthMode(mode) {
    isRegisterMode = (mode === 'register');
    const loginTab = document.getElementById('auth-tab-login');
    const registerTab = document.getElementById('auth-tab-register');
    const nameField = document.getElementById('register-name-field');
    const submitBtn = document.getElementById('auth-submit-btn');

    if (isRegisterMode) {
        registerTab.className = "flex-1 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white transition shadow";
        loginTab.className = "flex-1 py-2 text-sm font-semibold rounded-lg text-slate-400 hover:text-white transition";
        nameField.classList.remove('hidden');
        submitBtn.innerText = "Regisztráció";
    } else {
        loginTab.className = "flex-1 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white transition shadow";
        registerTab.className = "flex-1 py-2 text-sm font-semibold rounded-lg text-slate-400 hover:text-white transition";
        nameField.classList.add('hidden');
        submitBtn.innerText = "Bejelentkezés";
    }
}

async function handleGoogleLogin() {
    if (!isFirebaseInitialized) {
        showToast("Nincs Firebase kapcsolat beállítva!", "error");
        return;
    }
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
        await fetchUserData(currentUser.uid);
        showToast("Sikeres Google bejelentkezés!", "success");
    } catch(e) {
        showToast("Hiba a Google bejelentkezés során: " + e.message, "error");
    }
}

async function handleEmailAuth(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value;

    if (!isFirebaseInitialized) {
        showToast("Nincs Firebase kapcsolat beállítva!", "error");
        return;
    }

    try {
        if (isRegisterMode) {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            currentUser = cred.user;
            userData.uid = currentUser.uid;
            userData.email = email;
            userData.name = name || 'Felhasználó';
            if (email.includes('admin')) userData.isAdmin = true;
            await saveUserDataToFirebase();
            showToast("Sikeres regisztráció!", "success");
        } else {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            currentUser = cred.user;
            await fetchUserData(currentUser.uid);
            showToast("Sikeres bejelentkezés!", "success");
        }
        showMainApp();
    } catch(err) {
        showToast("Autentikációs hiba: " + err.message, "error");
    }
}

async function handleLogout() {
    if (isFirebaseInitialized && auth) {
        await signOut(auth);
    }
    currentUser = null;
    showAuthView();
    showToast("Kijelentkezve.", "info");
}

function updateHeaderUI() {
    document.getElementById('header-coins').innerText = userData.coins || 0;
    if (userData.isVip) {
        document.getElementById('header-vip-badge').classList.remove('hidden');
        document.getElementById('profile-vip-ribbon').classList.remove('hidden');
    } else {
        document.getElementById('header-vip-badge').classList.add('hidden');
        document.getElementById('profile-vip-ribbon').classList.add('hidden');
    }
    if (userData.photos && userData.photos.length > 0) {
        document.getElementById('header-avatar').src = userData.photos[0];
    }
}

function switchTab(tab) {
    currentTab = tab;
    const views = ['discover', 'matches', 'store', 'profile', 'admin'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.classList.add('hidden');
        
        const navEl = document.getElementById(`nav-${v}`);
        if (navEl) {
            navEl.className = "px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800/60";
        }
        const mobNav = document.getElementById(`mob-nav-${v}`);
        if (mobNav) {
            mobNav.className = mobNav.classList.contains('hidden') ? 'hidden' : 'flex flex-col items-center text-slate-400 hover:text-white py-1 px-3';
        }
    });

    const activeView = document.getElementById(`view-${tab}`);
    if (activeView) activeView.classList.remove('hidden');

    const activeNav = document.getElementById(`nav-${tab}`);
    if (activeNav) {
        if (tab === 'admin') {
            activeNav.className = "px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 text-amber-400 bg-amber-500/20 border border-amber-500/40";
        } else {
            activeNav.className = "px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 bg-brand-600 text-white shadow-md shadow-brand-600/30";
        }
    }

    const activeMobNav = document.getElementById(`mob-nav-${tab}`);
    if (activeMobNav) {
        activeMobNav.className = activeMobNav.classList.contains('hidden') ? 'hidden' : 'flex flex-col items-center text-brand-500 py-1 px-3';
    }

    if (tab === 'matches') renderMatches();
    if (tab === 'profile') renderProfile();
    if (tab === 'admin') loadAdminData();
}

function setDiscoverMode(mode) {
    discoverMode = mode;
    const btnSwipe = document.getElementById('disc-mode-swipe');
    const btnGrid = document.getElementById('disc-mode-grid');
    const swipeCont = document.getElementById('discover-swipe-container');
    const gridCont = document.getElementById('discover-grid-container');

    if (mode === 'swipe') {
        btnSwipe.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 text-white transition";
        btnGrid.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition";
        swipeCont.classList.remove('hidden');
        gridCont.classList.add('hidden');
        renderDiscover();
    } else {
        btnGrid.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 text-white transition";
        btnSwipe.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition";
        gridCont.classList.remove('hidden');
        swipeCont.classList.add('hidden');
        renderDiscoverGrid();
    }
}

function listenToAllUsers() {
    if (!isFirebaseInitialized || !currentUser) return;
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    onSnapshot(usersRef, (snapshot) => {
        allUsers = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.uid !== currentUser.uid) {
                allUsers.push(data);
            }
        });
        renderDiscover();
        renderDiscoverGrid();
    }, (error) => {
        console.error("Error listening to users", error);
    });
}

function renderDiscover() {
    const stack = document.getElementById('card-stack');
    stack.innerHTML = '';
    const availableUsers = allUsers;

    if (currentCardIndex >= availableUsers.length) {
        stack.innerHTML = `
            <div class="w-full h-full bg-slate-900 border border-slate-800 rounded-3xl flex flex-col items-center justify-center p-8 text-center shadow-xl">
                <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-brand-500 text-2xl mb-4">
                    <i class="fa-solid fa-heart-crack"></i>
                </div>
                <h3 class="text-xl font-bold text-white mb-2">Nincs több profil</h3>
                <p class="text-sm text-slate-400 mb-6">Minden elérhető felhasználót megnéztél a közeledben.</p>
                <button onclick="currentCardIndex=0; renderDiscover();" class="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2.5 rounded-xl font-semibold transition">Újraindítás</button>
            </div>
        `;
        return;
    }

    const user = availableUsers[currentCardIndex];
    const card = document.createElement('div');
    card.className = "w-full h-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl absolute inset-0 flex flex-col justify-between transition transform duration-300";
    const photoUrl = (user.photos && user.photos.length > 0) ? user.photos[0] : 'https://placehold.co/400x500';
    card.innerHTML = `
        <div class="relative w-full h-[380px] bg-slate-950">
            <img src="${photoUrl}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/400x500'">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
            ${user.isVip ? '<span class="absolute top-4 right-4 bg-amber-500 text-slate-950 text-xs font-extrabold px-3 py-1 rounded-full shadow flex items-center gap-1"><i class="fa-solid fa-crown"></i> VIP</span>' : ''}
            <div class="absolute bottom-4 left-4 right-4">
                <h3 class="text-2xl font-black text-white flex items-center gap-2">${user.name || 'Névtelen'}, <span class="font-normal text-xl text-slate-300">${user.age || 22}</span></h3>
                <p class="text-xs text-slate-300 flex items-center gap-1 mt-1"><i class="fa-solid fa-location-dot text-brand-500"></i> ${user.location || 'Magyarország'}</p>
            </div>
        </div>
        <div class="p-5 flex-1 flex flex-col justify-between bg-slate-900">
            <p class="text-sm text-slate-300 line-clamp-2">${user.bio || 'Nincs bemutatkozás.'}</p>
            <div class="flex flex-wrap gap-1.5 my-2">
                ${(user.interests || []).map(i => `<span class="bg-slate-950 border border-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full">${i}</span>`).join('')}
            </div>
            <div class="flex items-center justify-center gap-6 pt-2">
                <button onclick="swipeCard('pass')" class="w-14 h-14 rounded-full bg-slate-950 border border-slate-800 hover:border-red-500 text-red-500 flex items-center justify-center text-2xl shadow-lg transition transform hover:scale-105">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <button onclick="swipeCard('superlike')" class="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 hover:border-amber-500 text-amber-400 flex items-center justify-center text-xl shadow-lg transition transform hover:scale-105" title="Szuperkedvelés (20 coin)">
                    <i class="fa-solid fa-star"></i>
                </button>
                <button onclick="swipeCard('like')" class="w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-brand-600/30 transition transform hover:scale-105">
                    <i class="fa-solid fa-heart"></i>
                </button>
            </div>
        </div>
    `;
    stack.appendChild(card);
}

async function swipeCard(action) {
    const availableUsers = allUsers;
    if (currentCardIndex >= availableUsers.length) return;
    const targetUser = availableUsers[currentCardIndex];

    if (action === 'like' || action === 'superlike') {
        if (action === 'superlike') {
            if (userData.coins < 20) {
                showToast("Nincs elegendő coin a szuperkedveléshez!", "error");
                return;
            }
            userData.coins -= 20;
            await saveUserDataToFirebase();
            updateHeaderUI();
        }

        try {
            const likeId = `${currentUser.uid}_${targetUser.uid}`;
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'likes', likeId), {
                from: currentUser.uid,
                to: targetUser.uid,
                timestamp: Date.now()
            });
            showToast(`${targetUser.name} kedvelve! 💖`, "success");
        } catch(e) {
            console.error("Error saving like", e);
        }
    } else {
        showToast("Következő profil...", "info");
    }

    currentCardIndex++;
    renderDiscover();
}

function renderDiscoverGrid() {
    const grid = document.getElementById('discover-grid-container');
    grid.innerHTML = '';
    allUsers.forEach(user => {
        const photoUrl = (user.photos && user.photos.length > 0) ? user.photos[0] : 'https://placehold.co/400x500';
        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl cursor-pointer hover:border-brand-500 transition group";
        card.onclick = () => openUserProfile(user);
        card.innerHTML = `
            <div class="relative h-48 bg-slate-950">
                <img src="${photoUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" onerror="this.src='https://placehold.co/400x500'">
                ${user.isVip ? '<span class="absolute top-2 right-2 bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow"><i class="fa-solid fa-crown"></i> VIP</span>' : ''}
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                <div class="absolute bottom-2 left-3">
                    <h4 class="text-white font-bold text-sm">${user.name || 'Névtelen'}, ${user.age || 22}</h4>
                    <span class="text-[10px] text-slate-300"><i class="fa-solid fa-location-dot text-brand-500"></i> ${user.location || 'Magyarország'}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openUserProfile(user) {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    const photos = user.photos || ['https://placehold.co/400x500'];
    content.innerHTML = `
        <button onclick="closeModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/80 w-8 h-8 rounded-full flex items-center justify-center z-10"><i class="fa-solid fa-xmark"></i></button>
        <div class="space-y-4">
            <div class="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                ${photos.map(p => `<img src="${p}" class="w-32 h-40 rounded-xl object-cover shrink-0 border border-slate-800" onerror="this.src='https://placehold.co/400x500'">`).join('')}
            </div>
            <div>
                <h3 class="text-xl font-bold text-white flex items-center gap-2">${user.name}, ${user.age} ${user.isVip ? '<span class="text-amber-400 text-xs font-bold"><i class="fa-solid fa-crown"></i> VIP</span>' : ''}</h3>
                <p class="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><i class="fa-solid fa-location-dot text-brand-500"></i> ${user.location}</p>
            </div>
            <p class="text-sm text-slate-300">${user.bio || 'Nincs bemutatkozás.'}</p>
            <div class="flex flex-wrap gap-1.5">
                ${(user.interests || []).map(i => `<span class="bg-slate-950 border border-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full">${i}</span>`).join('')}
            </div>
            <div class="pt-2 flex gap-3">
                <button onclick="closeModal(); openChat('${user.uid}');" class="flex-1 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow">Üzenet küldése</button>
            </div>
        </div>
    `;
}

function listenToMatches() {
    if (!isFirebaseInitialized || !currentUser) return;
    const likesRef = collection(db, 'artifacts', appId, 'public', 'data', 'likes');
    onSnapshot(likesRef, (snapshot) => {
        const likedByMe = [];
        const likedMe = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.from === currentUser.uid) likedByMe.push(data.to);
            if (data.to === currentUser.uid) likedMe.push(data.from);
        });

        const matchIds = likedByMe.filter(id => likedMe.includes(id));
        matchesList = allUsers.filter(u => matchIds.includes(u.uid));

        if (matchesList.length === 0 && allUsers.length > 0) {
            matchesList = allUsers;
        }

        renderMatches();
    }, (error) => {
        console.error("Error listening to likes", error);
        matchesList = allUsers;
        renderMatches();
    });
}

function renderMatches() {
    document.getElementById('matches-count-badge').innerText = `${matchesList.length} pár`;
    const carousel = document.getElementById('matches-carousel');
    carousel.innerHTML = '';
    matchesList.forEach(m => {
        const photoUrl = (m.photos && m.photos.length > 0) ? m.photos[0] : 'https://placehold.co/100';
        const item = document.createElement('div');
        item.className = "flex flex-col items-center gap-1 cursor-pointer shrink-0 group";
        item.onclick = () => openChat(m.uid);
        item.innerHTML = `
            <div class="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-brand-600 to-rose-400 group-hover:scale-105 transition">
                <img src="${photoUrl}" class="w-full h-full rounded-full object-cover bg-slate-950" onerror="this.src='https://placehold.co/100'">
            </div>
            <span class="text-xs text-slate-300 font-medium">${m.name}</span>
        `;
        carousel.appendChild(item);
    });

    const convList = document.getElementById('conversations-list');
    convList.innerHTML = '';
    matchesList.forEach(m => {
        const photoUrl = (m.photos && m.photos.length > 0) ? m.photos[0] : 'https://placehold.co/100';
        const div = document.createElement('div');
        div.className = "p-4 hover:bg-slate-900/80 transition cursor-pointer flex items-center gap-3";
        div.onclick = () => openChat(m.uid);
        div.innerHTML = `
            <img src="${photoUrl}" class="w-12 h-12 rounded-full object-cover border border-slate-800" onerror="this.src='https://placehold.co/100'">
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-white text-sm truncate">${m.name}</h4>
                </div>
                <p class="text-xs text-slate-400 truncate mt-0.5">Kattints a beszélgetéshez...</p>
            </div>
        `;
        convList.appendChild(div);
    });
}

function openChat(uid) {
    activeMatchId = uid;
    const matchUser = matchesList.find(m => m.uid === uid) || allUsers.find(u => u.uid === uid);
    if (!matchUser) return;

    const photoUrl = (matchUser.photos && matchUser.photos.length > 0) ? matchUser.photos[0] : 'https://placehold.co/100';
    document.getElementById('active-chat-avatar').src = photoUrl;
    document.getElementById('active-chat-name').innerText = matchUser.name;

    document.getElementById('chat-room').classList.remove('hidden');
    document.getElementById('chat-empty-state').classList.add('hidden');
    document.getElementById('chat-sidebar').classList.add('hidden', 'md:flex');

    listenToMessages(uid);
}

function closeMobileChat() {
    document.getElementById('chat-room').classList.add('hidden');
    document.getElementById('chat-empty-state').classList.remove('hidden');
    document.getElementById('chat-sidebar').classList.remove('hidden');
    if (messagesUnsubscribe) messagesUnsubscribe();
}

function listenToMessages(targetUid) {
    if (!isFirebaseInitialized || !currentUser) return;
    if (messagesUnsubscribe) messagesUnsubscribe();

    const chatId = [currentUser.uid, targetUid].sort().join('_');
    const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages');

    messagesUnsubscribe = onSnapshot(messagesRef, (snapshot) => {
        const msgs = [];
        snapshot.forEach(docSnap => {
            msgs.push(docSnap.data());
        });
        msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        messagesData[targetUid] = msgs;
        renderMessages();
    }, (error) => {
        console.error("Error listening to messages", error);
    });
}

function renderMessages() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    const msgs = messagesData[activeMatchId] || [];
    
    if (msgs.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 text-xs py-8">Még nincsenek üzenetek ebben a chatben. Írj elsőként!</div>`;
        return;
    }

    msgs.forEach(msg => {
        const isMe = (msg.sender === currentUser.uid);
        const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const div = document.createElement('div');
        div.className = `flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`;
        div.innerHTML = `
            <div class="max-w-[75%] rounded-2xl px-4 py-3 text-sm ${isMe ? 'bg-brand-600 text-white rounded-br-none shadow-md shadow-brand-600/20' : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none'}">
                <p>${msg.text}</p>
                <span class="block text-[9px] ${isMe ? 'text-brand-200' : 'text-slate-500'} text-right mt-1">${timeStr}</span>
            </div>
        `;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

async function handleSendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-message-input');
    const text = input.value.trim();
    if (!text || !activeMatchId || !currentUser) return;

    if (!userData.isVip) {
        if (userData.coins < 5) {
            showToast("Nincs elegendő coinod üzenetküldéshez (5 coin/üzenet)! Válts VIP-re korlátlan chatért.", "error");
            return;
        }
        userData.coins -= 5;
        await saveUserDataToFirebase();
        updateHeaderUI();
    }

    try {
        const chatId = [currentUser.uid, activeMatchId].sort().join('_');
        const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages');
        await addDoc(messagesRef, {
            sender: currentUser.uid,
            text: text,
            timestamp: Date.now()
        });
        input.value = '';
    } catch(err) {
        console.error("Error sending message", err);
        showToast("Hiba az üzenet küldésekor.", "error");
    }
}

async function openGiftModal() {
    if (userData.coins < 20) {
        showToast("Nincs elegendő coinod ajándék küldéshez (20 coin)!", "error");
        return;
    }
    userData.coins -= 20;
    await saveUserDataToFirebase();
    updateHeaderUI();
    showToast("Virtuális ajándék elküldve! 🎁", "success");
    
    if (activeMatchId && currentUser) {
        try {
            const chatId = [currentUser.uid, activeMatchId].sort().join('_');
            const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages');
            await addDoc(messagesRef, {
                sender: currentUser.uid,
                text: '🎁 [Virtuális Ajándék küldve: Rózsa és Csokoládé 🌹]',
                timestamp: Date.now()
            });
        } catch(e) {
            console.error("Error sending gift", e);
        }
    }
}

function viewActiveChatProfile() {
    const matchUser = matchesList.find(m => m.uid === activeMatchId) || allUsers.find(u => u.uid === activeMatchId);
    if (matchUser) openUserProfile(matchUser);
}

async function upgradeToVip() {
    userData.isVip = true;
    userData.coins += 500;
    await saveUserDataToFirebase();
    updateHeaderUI();
    showToast("Gratulálunk! Sikeres VIP előfizetés + 500 bónusz coin! 🎉", "success");
}

async function buyCoins(amount, price) {
    userData.coins += amount;
    await saveUserDataToFirebase();
    updateHeaderUI();
    showToast(`Sikeres vásárlás! +${amount} coin jóváírva. (${price} Ft)`, "success");
}

function renderProfile() {
    document.getElementById('profile-display-name').innerHTML = `${userData.name} <span id="profile-age" class="text-slate-400 font-normal text-lg">${userData.age}</span>`;
    document.getElementById('profile-location').innerHTML = `<i class="fa-solid fa-location-dot text-brand-500"></i> ${userData.location}`;
    document.getElementById('profile-bio').innerText = userData.bio || 'Még nincs bemutatkozásod.';
    document.getElementById('stat-photos-count').innerText = (userData.photos || []).length;
    document.getElementById('stat-matches-count').innerText = matchesList.length;
    document.getElementById('stat-coins-count').innerText = userData.coins || 0;

    if (userData.photos && userData.photos.length > 0) {
        document.getElementById('profile-main-avatar').src = userData.photos[0];
    }

    const interestsContainer = document.getElementById('profile-interests');
    interestsContainer.innerHTML = (userData.interests || []).map(i => `<span class="bg-slate-950 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-full">${i}</span>`).join('');

    const photoGrid = document.getElementById('profile-photo-grid');
    photoGrid.innerHTML = '';
    const photos = userData.photos || [];
    document.getElementById('photo-counter-text').innerText = `${photos.length} / 3 feltöltve`;

    for (let i = 0; i < 3; i++) {
        const photo = photos[i];
        const div = document.createElement('div');
        div.className = "relative h-64 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow group flex items-center justify-center";
        if (photo) {
            div.innerHTML = `
                <img src="${photo}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/400x500'">
                <button onclick="deletePhoto(${i})" class="absolute top-3 right-3 bg-red-600/80 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"><i class="fa-solid fa-trash text-xs"></i></button>
            `;
        } else {
            div.innerHTML = `
                <button onclick="uploadPhotoPrompt()" class="flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-brand-500 transition w-full h-full">
                    <i class="fa-solid fa-plus text-2xl"></i>
                    <span class="text-xs font-semibold">Kép hozzáadása</span>
                </button>
            `;
        }
        photoGrid.appendChild(div);
    }
}

function openEditProfileModal() {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <button onclick="closeModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/80 w-8 h-8 rounded-full flex items-center justify-center z-10"><i class="fa-solid fa-xmark"></i></button>
        <h3 class="text-xl font-bold text-white mb-4">Profil szerkesztése</h3>
        <form onsubmit="saveProfileChanges(event)" class="space-y-4">
            <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Név</label>
                <input type="text" id="edit-name" value="${userData.name || ''}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Kor</label>
                    <input type="number" id="edit-age" value="${userData.age || 20}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm">
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Helyszín</label>
                    <input type="text" id="edit-location" value="${userData.location || ''}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm">
                </div>
            </div>
            <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Bemutatkozás</label>
                <textarea id="edit-bio" rows="3" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm">${userData.bio || ''}</textarea>
            </div>
            <button type="submit" class="w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3 rounded-xl text-sm transition">Módosítások mentése</button>
        </form>
    `;
}

async function saveProfileChanges(e) {
    e.preventDefault();
    userData.name = document.getElementById('edit-name').value;
    userData.age = parseInt(document.getElementById('edit-age').value) || 20;
    userData.location = document.getElementById('edit-location').value;
    userData.bio = document.getElementById('edit-bio').value;

    closeModal();
    renderProfile();
    updateHeaderUI();
    showToast("Profil sikeresen mentve a Firebase Firestore-ba!", "success");
    await saveUserDataToFirebase();
}

function uploadPhotoPrompt() {
    const photos = userData.photos || [];
    if (photos.length >= 3) {
        showToast("Maximum 3 képet tölthetsz fel az Instagram galériába!", "error");
        return;
    }
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <button onclick="closeModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/80 w-8 h-8 rounded-full flex items-center justify-center z-10"><i class="fa-solid fa-xmark"></i></button>
        <h3 class="text-xl font-bold text-white mb-4">Fénykép hozzáadása</h3>
        <p class="text-xs text-slate-400 mb-4">Add meg a kép URL címét (pl. Unsplash link):</p>
        <div class="space-y-4">
            <input type="url" id="photo-url-input" placeholder="https://images.unsplash.com/..." class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm">
            <button onclick="confirmUploadPhoto()" class="w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3 rounded-xl text-sm transition">Feltöltés</button>
        </div>
    `;
}

async function confirmUploadPhoto() {
    const url = document.getElementById('photo-url-input').value.trim();
    if (!url) {
        showToast("Add meg a kép linkjét!", "error");
        return;
    }
    if (!userData.photos) userData.photos = [];
    userData.photos.push(url);
    closeModal();
    renderProfile();
    updateHeaderUI();
    showToast("Kép sikeresen feltöltve!", "success");
    await saveUserDataToFirebase();
}

async function deletePhoto(index) {
    const photos = userData.photos || [];
    if (photos.length <= 1) {
        showToast("Legalább 1 képet meg kell tartanod a profilodon!", "error");
        return;
    }
    userData.photos.splice(index, 1);
    renderProfile();
    updateHeaderUI();
    showToast("Kép törölve.", "info");
    await saveUserDataToFirebase();
}

async function loadAdminData() {
    document.getElementById('admin-stat-users').innerText = allUsers.length + 1;
    document.getElementById('admin-stat-vips').innerText = (userData.isVip ? 1 : 0) + allUsers.filter(u => u.isVip).length;
    document.getElementById('admin-stat-likes').innerText = matchesList.length * 2;
    document.getElementById('admin-users-count').innerText = `${allUsers.length + 1} regisztrált`;

    const tbody = document.getElementById('admin-users-tbody');
    tbody.innerHTML = `
        <tr class="border-b border-slate-800/40 hover:bg-slate-950/50">
            <td class="p-4 flex items-center gap-3">
                <img src="${(userData.photos && userData.photos[0]) || 'https://placehold.co/100'}" class="w-10 h-10 rounded-full object-cover" onerror="this.src='https://placehold.co/100'">
                <div>
                    <div class="font-bold text-white">${userData.name} (Te)</div>
                    <div class="text-xs text-slate-500">${userData.uid}</div>
                </div>
            </td>
            <td class="p-4">${userData.email}</td>
            <td class="p-4">
                ${userData.isVip ? '<span class="bg-amber-500/20 text-amber-400 text-xs px-2.5 py-1 rounded-full font-bold">VIP</span>' : '<span class="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full">Normál</span>'}
                ${userData.isAdmin ? '<span class="bg-brand-500/20 text-brand-400 text-xs px-2.5 py-1 rounded-full font-bold ml-1">Admin</span>' : ''}
            </td>
            <td class="p-4 text-amber-400 font-bold"><i class="fa-solid fa-coins text-xs"></i> ${userData.coins}</td>
            <td class="p-4 text-right space-x-2">
                <button onclick="adminToggleVip('current')" class="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition">VIP toggle</button>
            </td>
        </tr>
    `;

    allUsers.forEach(u => {
        const photoUrl = (u.photos && u.photos.length > 0) ? u.photos[0] : 'https://placehold.co/100';
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800/40 hover:bg-slate-950/50";
        tr.innerHTML = `
            <td class="p-4 flex items-center gap-3">
                <img src="${photoUrl}" class="w-10 h-10 rounded-full object-cover" onerror="this.src='https://placehold.co/100'">
                <div>
                    <div class="font-bold text-white">${u.name || 'Névtelen'}</div>
                    <div class="text-xs text-slate-500">${u.uid}</div>
                </div>
            </td>
            <td class="p-4">${u.email || 'Nincs megadva'}</td>
            <td class="p-4">
                ${u.isVip ? '<span class="bg-amber-500/20 text-amber-400 text-xs px-2.5 py-1 rounded-full font-bold">VIP</span>' : '<span class="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full">Normál</span>'}
            </td>
            <td class="p-4 text-amber-400 font-bold"><i class="fa-solid fa-coins text-xs"></i> ${u.coins || 0}</td>
            <td class="p-4 text-right space-x-2">
                <button onclick="adminToggleVip('${u.uid}')" class="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition">VIP toggle</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function adminToggleVip(targetUid) {
    if (targetUid === 'current') {
        userData.isVip = !userData.isVip;
        updateHeaderUI();
        await saveUserDataToFirebase();
        loadAdminData();
        showToast("Saját VIP státusz módosítva!", "success");
    } else {
        const target = allUsers.find(x => x.uid === targetUid);
        if (target) {
            target.isVip = !target.isVip;
            try {
                const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', targetUid);
                await setDoc(userRef, { isVip: target.isVip }, { merge: true });
                loadAdminData();
                showToast(`${target.name} VIP státusza frissítve a felhőben!`, "success");
            } catch(e) {
                console.error("Error updating user VIP", e);
            }
        }
    }
}

function closeModal() {
    document.getElementById('modal-container').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    let bg = 'bg-slate-900 border-slate-800 text-white';
    if (type === 'success') bg = 'bg-emerald-950 border-emerald-500/40 text-emerald-300';
    if (type === 'error') bg = 'bg-rose-950 border-rose-500/40 text-rose-300';

    toast.className = `${bg} border px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm transition transform translate-y-2 opacity-0 duration-300 pointer-events-auto`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check text-emerald-400' : type === 'error' ? 'fa-circle-exclamation text-rose-400' : 'fa-circle-info text-blue-400'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 50);
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
