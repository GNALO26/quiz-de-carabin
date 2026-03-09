/**
 * ================================================================
 * QUIZ MODERNE - JAVASCRIPT
 * ================================================================
 * Gestion de l'interface moderne du quiz
 * ================================================================
 */

import { CONFIG } from './config.js';

class ModernQuiz {
    constructor() {
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.timerInterval = null;
        this.timeLeft = 0;
        this.reviewMode = false;
        
        this.init();
    }

    init() {
        // Récupérer l'ID du quiz depuis l'URL
        const urlParams = new URLSearchParams(window.location.search);
        const quizId = urlParams.get('id');
        
        if (!quizId) {
            alert('Aucun quiz sélectionné');
            window.location.href = 'quiz.html';
            return;
        }
        
        this.loadQuiz(quizId);
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('prevBtn').addEventListener('click', () => this.prevQuestion());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextQuestion());
        document.getElementById('submitBtn').addEventListener('click', () => this.confirmSubmit());
    }

    async loadQuiz(quizId) {
        try {
            const token = localStorage.getItem('quizToken');
            
            if (!token) {
                alert('Vous devez être connecté pour accéder au quiz');
                window.location.href = 'index.html';
                return;
            }

            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/quiz/${quizId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 403) {
                alert('Accès Premium requis pour ce quiz');
                window.location.href = 'quiz.html';
                return;
            }

            if (!response.ok) {
                throw new Error('Erreur lors du chargement du quiz');
            }

            const data = await response.json();
            
            if (data.success) {
                this.currentQuiz = data.quiz;
                this.userAnswers = new Array(this.currentQuiz.questions.length).fill().map(() => []);
                
                // Mettre à jour le header
                document.getElementById('quizTitle').textContent = this.currentQuiz.title;
                document.getElementById('quizSubject').textContent = this.currentQuiz.subject;
                document.getElementById('quizQuestionCount').textContent = this.currentQuiz.questions.length;
                document.getElementById('totalQuestions').textContent = this.currentQuiz.questions.length;
                
                // Afficher la première question
                this.displayQuestion(0);
                
                // Démarrer le timer
                this.startTimer(this.currentQuiz.duration * 60);
            }
        } catch (error) {
            console.error('Erreur loadQuiz:', error);
            alert('Erreur lors du chargement du quiz');
            window.location.href = 'quiz.html';
        }
    }

    async getActiveAPIUrl() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`);
            if (response.ok) return CONFIG.API_BASE_URL;
        } catch (error) {
            console.warn('URL principale inaccessible');
        }
        return CONFIG.API_BACKUP_URL;
    }

    displayQuestion(index) {
        this.currentQuestionIndex = index;
        const question = this.currentQuiz.questions[index];
        
        // Update question number and text
        document.getElementById('questionNumber').textContent = `Question ${index + 1}`;
        document.getElementById('currentQuestion').textContent = index + 1;
        document.getElementById('questionText').textContent = question.text;
        
        // Update progress
        const progress = ((index + 1) / this.currentQuiz.questions.length) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressPercentage').textContent = Math.round(progress);
        
        // Display options
        const optionsHTML = question.options.map((option, i) => {
            const isSelected = this.userAnswers[index].includes(i);
            return `
                <div class="option-modern ${isSelected ? 'selected' : ''}" data-index="${i}">
                    <div class="option-checkbox">
                        <i class="fas fa-check"></i>
                    </div>
                    <div class="option-text">${option.text}</div>
                </div>
            `;
        }).join('');
        
        document.getElementById('optionsContainer').innerHTML = optionsHTML;
        
        // Hide justification
        document.getElementById('justificationBox').classList.remove('show');
        
        // Add click handlers to options
        document.querySelectorAll('.option-modern').forEach(option => {
            option.addEventListener('click', (e) => {
                const optionIndex = parseInt(e.currentTarget.getAttribute('data-index'));
                this.toggleOption(optionIndex);
            });
        });
        
        // Update navigation buttons
        document.getElementById('prevBtn').disabled = index === 0;
        
        if (index === this.currentQuiz.questions.length - 1) {
            document.getElementById('nextBtn').style.display = 'none';
            document.getElementById('submitBtn').style.display = 'flex';
        } else {
            document.getElementById('nextBtn').style.display = 'flex';
            document.getElementById('submitBtn').style.display = 'none';
        }
        
        // Animate question card
        const questionCard = document.getElementById('questionCard');
        questionCard.style.animation = 'none';
        setTimeout(() => {
            questionCard.style.animation = 'fadeIn 0.5s ease';
        }, 10);
    }

    toggleOption(optionIndex) {
        const currentAnswers = this.userAnswers[this.currentQuestionIndex];
        const index = currentAnswers.indexOf(optionIndex);
        
        if (index > -1) {
            currentAnswers.splice(index, 1);
        } else {
            currentAnswers.push(optionIndex);
        }
        
        // Re-render current question
        this.displayQuestion(this.currentQuestionIndex);
    }

    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.displayQuestion(this.currentQuestionIndex - 1);
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.displayQuestion(this.currentQuestionIndex + 1);
        }
    }

    startTimer(seconds) {
        this.timeLeft = seconds;
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            // Warning when < 1 minute
            if (this.timeLeft <= 60) {
                document.getElementById('timer').classList.add('warning');
            }
            
            // Auto-submit when time is up
            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                alert('Temps écoulé ! Le quiz sera soumis automatiquement.');
                this.submitQuiz();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        document.getElementById('timerValue').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    confirmSubmit() {
        // Vérifier questions non répondues
        const unanswered = this.userAnswers.filter(answer => answer.length === 0).length;
        
        if (unanswered > 0) {
            const confirm = window.confirm(
                `Attention: ${unanswered} question(s) non répondue(s).\n\nVoulez-vous vraiment soumettre le quiz ?`
            );
            
            if (!confirm) return;
        }
        
        this.submitQuiz();
    }

    async submitQuiz() {
        clearInterval(this.timerInterval);
        
        try {
            const token = localStorage.getItem('quizToken');
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const timeSpent = (this.currentQuiz.duration * 60) - this.timeLeft;
            
            const response = await fetch(`${API_BASE_URL}/api/quiz/${this.currentQuiz._id}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    answers: this.userAnswers,
                    timeSpent: timeSpent
                })
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la soumission');
            }

            const data = await response.json();
            
            if (data.success) {
                // Stocker les résultats dans localStorage
                localStorage.setItem('quizResults', JSON.stringify({
                    quiz: this.currentQuiz,
                    score: data.score,
                    totalQuestions: data.totalQuestions,
                    correctAnswers: data.correctAnswers,
                    userAnswers: this.userAnswers,
                    timeSpent: timeSpent
                }));
                
                // Rediriger vers la page de résultats
                window.location.href = 'results-modern.html';
            }
        } catch (error) {
            console.error('Erreur submitQuiz:', error);
            alert('Erreur lors de la soumission du quiz');
        }
    }
}

// Initialiser quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    new ModernQuiz();
});