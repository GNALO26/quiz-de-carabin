// =======================================
// SCRIPT POUR INDEX.HTML
// Rediriger les boutons d'auth vers pages dédiées
// =======================================

document.addEventListener('DOMContentLoaded', function() {
    
    // Si déjà connecté, rediriger vers dashboard
    const token = localStorage.getItem('quizToken');
    const user = localStorage.getItem('quizUser');
    
    if (token && user && token !== 'null' && user !== 'null') {
        // Vérifier si admin
        try {
            const userData = JSON.parse(user);
            if (userData.role === 'admin') {
                window.location.href = '/admin-dashboard.html';
                return;
            }
        } catch (e) {
            console.error('Erreur parse user:', e);
        }
        
        // Sinon rediriger vers dashboard
        window.location.href = '/dashboard-modern.html';
        return;
    }
    
    // ========================================
    // REMPLACER LES BOUTONS DE MODAL PAR DES LIENS
    // ========================================
    
    // Bouton "Se connecter" dans la navbar
    const loginButtons = document.querySelectorAll('[data-bs-toggle="modal"][data-bs-target="#loginModal"]');
    loginButtons.forEach(btn => {
        btn.removeAttribute('data-bs-toggle');
        btn.removeAttribute('data-bs-target');
        btn.href = '/login.html';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/login.html';
        });
    });
    
    // Bouton "S'inscrire" dans la navbar
    const registerButtons = document.querySelectorAll('[data-bs-toggle="modal"][data-bs-target="#registerModal"]');
    registerButtons.forEach(btn => {
        btn.removeAttribute('data-bs-toggle');
        btn.removeAttribute('data-bs-target');
        btn.href = '/register.html';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/register.html';
        });
    });
    
    // Boutons "Commencer" dans le hero
    const ctaButtons = document.querySelectorAll('.btn-primary, .btn-hero');
    ctaButtons.forEach(btn => {
        if (btn.textContent.includes('Commencer')) {
            btn.href = '/register.html';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/register.html';
            });
        }
    });
    
    // ========================================
    // GESTION DES BOUTONS D'ABONNEMENT
    // ========================================
    
    const subscribeButtons = document.querySelectorAll('.subscribe-btn, .pricing-card button');
    subscribeButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Vérifier si connecté
            const token = localStorage.getItem('quizToken');
            
            if (!token || token === 'null') {
                // Pas connecté → Rediriger vers register
                alert('Veuillez vous créer un compte pour vous abonner');
                window.location.href = '/register.html';
            } else {
                // Connecté → Rediriger vers premium.html
                window.location.href = '/premium.html';
            }
        });
    });
    
    console.log('✅ Redirections d\'authentification configurées');
});