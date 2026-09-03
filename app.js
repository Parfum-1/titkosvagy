document.addEventListener('DOMContentLoaded', () => {
    console.log('Titkosvagy kliens szkript betöltve.');

    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const keyword = document.getElementById('keyword').value;
            const gender = document.getElementById('gender').value;
            
            alert(`Keresés paraméterei:\nKulcsszó: ${keyword || 'Összes'}\nNem: ${gender || 'Mindegy'}`);
            // Itt köthető be abackend API hívás a találatok lekérésére
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            alert(`Bejelentkezési kísérlet ezzel az e-mailnel: ${email}`);
        });
    }
});