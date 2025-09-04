import { CONFIG } from './config.js';
import { Auth } from './auth.js';
import { Quiz } from './quiz.js';
import { Payment } from './payment.js';

// Initialize application after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize modules
    window.auth = new Auth();
    window.quiz = new Quiz();
    window.payment = new Payment();

    // Load quizzes
    window.quiz.loadQuizzes();

    // Setup global event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Back to quizzes button
    const backButton = document.getElementById('back-to-quizzes');
    if (backButton) {
        backButton.addEventListener('click', function() {
            document.getElementById('quiz-interface').style.display = 'none';
            document.getElementById('results-container').style.display = 'none';
            document.getElementById('quiz-section').style.display = 'block';
        });
    }
}