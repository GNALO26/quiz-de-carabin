const API_BASE_URL = 'https://quiz-de-carabin-backend.onrender.com';

document.addEventListener('DOMContentLoaded', function() {
    // Vérifier l'état d'authentification
    if (auth.isAuthenticated()) {
        // Charger les quiz
        quiz.loadQuizzes();
    }

    // Gestionnaire pour le bouton de retour aux quiz
    document.getElementById('back-to-quizzes').addEventListener('click', function() {
        document.getElementById('quiz-interface').style.display = 'none';
        document.getElementById('results-container').style.display = 'none';
        document.getElementById('quiz-section').style.display = 'block';
    });

    // Gestionnaire pour le tableau de bord
    document.getElementById('dashboard-btn').addEventListener('click', function(e) {
        e.preventDefault();
        alert('Tableau de bord - Fonctionnalité à venir');
    });

    // Gestionnaire pour l'historique
    document.getElementById('history-btn').addEventListener('click', function(e) {
        e.preventDefault();
        alert('Historique - Fonctionnalité à venir');
    });
});