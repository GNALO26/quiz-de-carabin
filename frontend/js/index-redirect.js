// =======================================
// SCRIPT POUR INDEX.HTML
// Gérer les boutons d'auth SANS redirection forcée
// =======================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ❌ SUPPRIMÉ: Pas de redirection automatique vers dashboard
    // Les utilisateurs PEUVENT rester sur l'accueil même connectés
    
    // ========================================
    // REMPLACER LES MODALS PAR DES LIENS
    // ========================================
    
    // Bouton "Se connecter"
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
    
    // Bouton "S'inscrire"
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
    
    // Boutons CTA "Commencer" → Register si non connecté, Quiz si connecté
    const ctaButtons = document.querySelectorAll('.btn-hero, .cta-button');
    ctaButtons.forEach(btn => {
        if (btn.textContent.includes('Commencer')) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                
                const token = localStorage.getItem('quizToken');
                
                if (token && token !== 'null') {
                    // Connecté → Quiz
                    window.location.href = '/quiz-modern.html';
                } else {
                    // Non connecté → Register
                    window.location.href = '/register.html';
                }
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
            
            const token = localStorage.getItem('quizToken');
            
            if (!token || token === 'null') {
                // Pas connecté → Register
                alert('Veuillez créer un compte pour vous abonner');
                window.location.href = '/register.html';
            } else {
                // Connecté → Premium
                window.location.href = '/premium.html';
            }
        });
    });
    
    console.log('✅ Redirections configurées (sans forcer dashboard)');
});