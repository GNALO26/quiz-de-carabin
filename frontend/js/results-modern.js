/**
 * ================================================================
 * RESULTS MODERNE - JAVASCRIPT
 * ================================================================
 * Affichage des résultats avec animations et confetti
 * ================================================================
 */

class ModernResults {
    constructor() {
        this.results = null;
        this.init();
    }

    init() {
        // Récupérer les résultats du localStorage
        const resultsData = localStorage.getItem('quizResults');
        
        if (!resultsData) {
            alert('Aucun résultat trouvé');
            window.location.href = 'quiz.html';
            return;
        }
        
        this.results = JSON.parse(resultsData);
        this.displayResults();
    }

    displayResults() {
        const { quiz, score, totalQuestions, userAnswers, timeSpent } = this.results;
        
        const percentage = Math.round((score / totalQuestions) * 100);
        const incorrectCount = totalQuestions - score;
        
        // Déterminer le niveau de performance
        let level, levelClass, message;
        
        if (percentage >= 80) {
            level = 'Excellent !';
            levelClass = 'excellent';
            message = 'Vous maîtrisez parfaitement ce sujet !';
            this.launchConfetti();
        } else if (percentage >= 60) {
            level = 'Bon travail !';
            levelClass = 'good';
            message = 'Vous avez une bonne compréhension du sujet.';
        } else if (percentage >= 40) {
            level = 'Pas mal !';
            levelClass = 'average';
            message = 'Continuez vos efforts, vous progressez.';
        } else {
            level = 'À améliorer';
            levelClass = 'poor';
            message = 'Révisez et réessayez, vous allez y arriver !';
        }
        
        // Afficher le score principal
        document.getElementById('scorePercentage').textContent = `${percentage}%`;
        document.getElementById('scoreText').textContent = level;
        document.getElementById('scoreText').className = `score-text ${levelClass}`;
        document.getElementById('scoreDescription').textContent = message;
        
        // Animer le cercle de score
        this.animateScoreCircle(percentage, levelClass);
        
        // Afficher les stats
        document.getElementById('correctCount').textContent = score;
        document.getElementById('incorrectCount').textContent = incorrectCount;
        document.getElementById('timeSpent').textContent = this.formatTime(timeSpent);
        
        // Afficher la révision des questions
        this.displayQuestionsReview(quiz, userAnswers);
    }

    animateScoreCircle(percentage, levelClass) {
        const circle = document.getElementById('scoreCircle');
        const radius = 90;
        const circumference = 2 * Math.PI * radius;
        
        circle.classList.add(levelClass);
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = circumference;
        
        setTimeout(() => {
            const offset = circumference - (percentage / 100) * circumference;
            circle.style.strokeDashoffset = offset;
        }, 100);
    }

    displayQuestionsReview(quiz, userAnswers) {
        const container = document.getElementById('questionsReview');
        
        const questionsHTML = quiz.questions.map((question, index) => {
            const userAnswer = userAnswers[index] || [];
            const correctAnswer = question.correctAnswers;
            
            // Vérifier si la réponse est correcte
            const isCorrect = JSON.stringify(userAnswer.sort()) === JSON.stringify(correctAnswer.sort());
            
            // Formater les réponses
            const userAnswerText = userAnswer.length > 0
                ? userAnswer.map(i => question.options[i].text).join(', ')
                : 'Aucune réponse';
                
            const correctAnswerText = correctAnswer.map(i => question.options[i].text).join(', ');
            
            return `
                <div class="question-review ${isCorrect ? 'correct' : 'incorrect'}">
                    <div class="question-header-review">
                        <span class="question-number-review">Question ${index + 1}</span>
                        <span class="question-status ${isCorrect ? 'correct' : 'incorrect'}">
                            ${isCorrect ? '<i class="fas fa-check me-1"></i>Correct' : '<i class="fas fa-times me-1"></i>Incorrect'}
                        </span>
                    </div>
                    
                    <div class="question-text-review">${question.text}</div>
                    
                    <div class="answer-comparison">
                        <div class="answer-item user-answer">
                            <div class="answer-label">Votre réponse</div>
                            <div>${userAnswerText}</div>
                        </div>
                        
                        ${!isCorrect ? `
                            <div class="answer-item correct-answer">
                                <div class="answer-label">Réponse correcte</div>
                                <div>${correctAnswerText}</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${question.justification ? `
                        <div class="justification-review">
                            <div class="justification-title">
                                <i class="fas fa-lightbulb"></i>
                                Explication
                            </div>
                            <div class="justification-content">${question.justification}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        container.innerHTML = questionsHTML;
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    launchConfetti() {
        // Configuration du confetti
        const duration = 3000;
        const end = Date.now() + duration;

        const colors = ['#667eea', '#764ba2', '#06d6a0', '#ffd166', '#ef476f'];

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors
            });
            
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
        
        // Grand confetti au centre
        setTimeout(() => {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: colors
            });
        }, 500);
    }
}

// Initialiser quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    new ModernResults();
});