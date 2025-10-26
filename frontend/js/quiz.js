// quiz.js - Gestion complète des quiz
import { CONFIG } from './config.js';

class QuizManager {
    constructor() {
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.timer = null;
        this.timeLeft = 0;
        this.quizStarted = false;
        this.questions = [];
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadQuizFromURL();
    }

    bindEvents() {
        // Navigation
        document.getElementById('prev-btn')?.addEventListener('click', () => this.previousQuestion());
        document.getElementById('next-btn')?.addEventListener('click', () => this.nextQuestion());
        document.getElementById('submit-quiz')?.addEventListener('click', () => this.submitQuiz());
        document.getElementById('back-to-quizzes')?.addEventListener('click', () => this.showQuizList());
        document.getElementById('review-btn')?.addEventListener('click', () => this.reviewAnswers());

        // Validation de code d'accès
        document.getElementById('validate-code')?.addEventListener('click', () => this.validateAccessCode());
    }

    async loadQuizFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const quizId = urlParams.get('id');
        
        if (quizId) {
            await this.startQuiz(quizId);
        }
    }

    async startQuiz(quizId) {
        try {
            this.showLoading(true);
            
            const token = localStorage.getItem('quizToken');
            if (!token) {
                this.showLoginPrompt();
                return;
            }

            const API_BASE_URL = await this.getActiveAPIUrl();
            const response = await fetch(`${API_BASE_URL}/api/quiz/${quizId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.showLoginPrompt();
                    return;
                }
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.setupQuiz(data.quiz);
            } else {
                throw new Error(data.message || 'Erreur lors du chargement du quiz');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors du chargement du quiz');
        } finally {
            this.showLoading(false);
        }
    }

    setupQuiz(quizData) {
        this.currentQuiz = quizData;
        this.questions = quizData.questions || [];
        this.currentQuestionIndex = 0;
        this.userAnswers = new Array(this.questions.length).fill(null);
        this.quizStarted = true;

        // Masquer la liste des quizs et afficher l'interface du quiz
        this.showQuizInterface();

        // Démarrer le timer si nécessaire
        if (quizData.duration) {
            this.timeLeft = quizData.duration * 60; // Convertir en secondes
            this.startTimer();
        }

        // Afficher la première question
        this.displayCurrentQuestion();
        this.updateNavigation();
    }

    showQuizInterface() {
        document.getElementById('quiz-list-section').style.display = 'none';
        document.getElementById('quiz-interface').style.display = 'block';
        document.getElementById('results-container').style.display = 'none';
        
        // Mettre à jour le titre du quiz
        if (this.currentQuiz) {
            document.getElementById('quiz-title').textContent = this.currentQuiz.title;
        }
    }

    showQuizList() {
        document.getElementById('quiz-list-section').style.display = 'block';
        document.getElementById('quiz-interface').style.display = 'none';
        document.getElementById('results-container').style.display = 'none';
        window.history.pushState({}, '', 'quiz.html');
    }

    displayCurrentQuestion() {
        if (!this.questions.length || this.currentQuestionIndex >= this.questions.length) {
            return;
        }

        const question = this.questions[this.currentQuestionIndex];
        const container = document.getElementById('question-container');
        
        container.innerHTML = `
            <div class="question-card">
                <div class="d-flex align-items-start mb-4">
                    <div class="question-number bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px; font-weight: 700;">
                        ${this.currentQuestionIndex + 1}
                    </div>
                    <div class="flex-grow-1">
                        <h5 class="question-text fw-bold mb-3">${question.text}</h5>
                        ${question.image ? `<img src="${question.image}" class="img-fluid mb-3 rounded" style="max-height: 200px;" alt="Image question">` : ''}
                    </div>
                </div>
                
                <div class="options-container">
                    ${this.generateOptionsHTML(question.options, this.userAnswers[this.currentQuestionIndex])}
                </div>
                
                ${question.explanation ? `
                    <div class="mt-3 p-3 bg-light rounded">
                        <small class="text-muted"><strong>Note :</strong> ${question.explanation}</small>
                    </div>
                ` : ''}
            </div>
        `;

        this.attachOptionEvents();
        this.updateProgress();
    }

    generateOptionsHTML(options, selectedAnswer) {
        return options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const optionLetter = String.fromCharCode(65 + index); // A, B, C, D
            
            return `
                <div class="option ${isSelected ? 'selected' : ''}" data-option-index="${index}">
                    <div class="d-flex align-items-center">
                        <div class="option-letter bg-${isSelected ? 'primary' : 'light'} text-${isSelected ? 'white' : 'dark'} rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 30px; height: 30px; font-weight: 600; font-size: 0.9rem;">
                            ${optionLetter}
                        </div>
                        <div class="option-text">${option.text}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    attachOptionEvents() {
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                // Retirer la sélection précédente
                options.forEach(opt => opt.classList.remove('selected'));
                
                // Ajouter la nouvelle sélection
                option.classList.add('selected');
                
                // Sauvegarder la réponse
                const optionIndex = parseInt(option.getAttribute('data-option-index'));
                this.userAnswers[this.currentQuestionIndex] = optionIndex;
                
                // Mettre à jour la navigation
                this.updateNavigation();
            });
        });
    }

    updateNavigation() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const submitBtn = document.getElementById('submit-quiz');

        if (prevBtn) {
            prevBtn.disabled = this.currentQuestionIndex === 0;
        }

        if (nextBtn && submitBtn) {
            const isLastQuestion = this.currentQuestionIndex === this.questions.length - 1;
            nextBtn.style.display = isLastQuestion ? 'none' : 'block';
            submitBtn.style.display = isLastQuestion ? 'block' : 'none';
        }
    }

    updateProgress() {
        const progress = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        const progressBar = document.getElementById('quiz-progress');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.setAttribute('aria-valuenow', progress);
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayCurrentQuestion();
            this.updateNavigation();
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.displayCurrentQuestion();
            this.updateNavigation();
        }
    }

    async submitQuiz() {
        try {
            this.showLoading(true);
            
            const token = localStorage.getItem('quizToken');
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const quizResult = {
                quizId: this.currentQuiz._id,
                answers: this.userAnswers,
                timeSpent: this.currentQuiz.duration ? (this.currentQuiz.duration * 60 - this.timeLeft) : 0
            };

            const response = await fetch(`${API_BASE_URL}/api/quiz/submit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(quizResult)
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.showResults(result.data);
            } else {
                throw new Error(result.message || 'Erreur lors de la soumission');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors de la soumission du quiz');
        } finally {
            this.showLoading(false);
            this.stopTimer();
        }
    }

    showResults(results) {
        document.getElementById('quiz-interface').style.display = 'none';
        document.getElementById('results-container').style.display = 'block';
        
        this.displayScore(results);
        this.displayDetailedResults(results);
    }

    displayScore(results) {
        const scorePercentage = Math.round((results.score / results.totalQuestions) * 100);
        const scoreValue = document.getElementById('score-value');
        const scoreText = document.getElementById('score-text');
        const scoreDescription = document.getElementById('score-description');

        if (scoreValue) {
            scoreValue.textContent = scorePercentage;
            
            // Animation du cercle de score
            const scoreCircle = document.querySelector('.score-circle');
            if (scoreCircle) {
                scoreCircle.style.background = `conic-gradient(var(--primary-color) ${scorePercentage}%, #e2e8f0 ${scorePercentage}%)`;
            }
        }

        // Texte personnalisé selon le score
        if (scorePercentage >= 90) {
            scoreText.textContent = 'Excellent ! 🎉';
            scoreDescription.textContent = 'Maîtrise parfaite du sujet';
        } else if (scorePercentage >= 70) {
            scoreText.textContent = 'Très bien ! 👍';
            scoreDescription.textContent = 'Bonne compréhension globale';
        } else if (scorePercentage >= 50) {
            scoreText.textContent = 'Pas mal ! 💪';
            scoreDescription.textContent = 'Quelques révisions nécessaires';
        } else {
            scoreText.textContent = 'À travailler 📚';
            scoreDescription.textContent = 'Consultez les corrections attentivement';
        }
    }

    displayDetailedResults(results) {
        const container = document.getElementById('results-content');
        
        container.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card text-center h-100">
                        <div class="card-body">
                            <h6 class="card-title">Score Final</h6>
                            <div class="h3 text-primary fw-bold">${results.score}/${results.totalQuestions}</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card text-center h-100">
                        <div class="card-body">
                            <h6 class="card-title">Temps passé</h6>
                            <div class="h3 text-primary fw-bold">${this.formatTime(results.timeSpent)}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <h5 class="mb-3">Détail des réponses</h5>
            ${this.generateQuestionsReview(results.questions)}
        `;
    }

    generateQuestionsReview(questions) {
        return questions.map((q, index) => {
            const userAnswer = this.userAnswers[index];
            const isCorrect = userAnswer === q.correctAnswer;
            const userAnswerText = userAnswer !== null ? q.options[userAnswer]?.text : 'Non répondu';
            const correctAnswerText = q.options[q.correctAnswer]?.text;
            
            return `
                <div class="question-review mb-4 p-3 border rounded ${isCorrect ? 'border-success bg-light' : 'border-danger bg-light'}">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="mb-0">Question ${index + 1}</h6>
                        <span class="badge ${isCorrect ? 'bg-success' : 'bg-danger'}">
                            ${isCorrect ? '✓ Correct' : '✗ Incorrect'}
                        </span>
                    </div>
                    <p class="fw-bold">${q.text}</p>
                    
                    <div class="mb-2">
                        <small class="text-muted">Votre réponse :</small>
                        <div class="p-2 rounded ${isCorrect ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'}">
                            ${userAnswerText}
                        </div>
                    </div>
                    
                    ${!isCorrect ? `
                        <div class="mb-2">
                            <small class="text-muted">Bonne réponse :</small>
                            <div class="p-2 rounded bg-success bg-opacity-10">
                                ${correctAnswerText}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${q.explanation ? `
                        <div class="mt-2">
                            <small class="text-muted">Explication :</small>
                            <div class="p-2 rounded bg-info bg-opacity-10">
                                ${q.explanation}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    reviewAnswers() {
        document.getElementById('results-container').style.display = 'none';
        document.getElementById('quiz-interface').style.display = 'block';
        this.currentQuestionIndex = 0;
        this.displayCurrentQuestion();
        this.updateNavigation();
    }

    startTimer() {
        this.updateTimerDisplay();
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                this.stopTimer();
                this.submitQuiz();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    updateTimerDisplay() {
        const timerElement = document.getElementById('quiz-timer');
        if (timerElement) {
            const minutes = Math.floor(this.timeLeft / 60);
            const seconds = this.timeLeft % 60;
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Changer la couleur si le temps est critique
            if (this.timeLeft < 300) { // 5 minutes
                timerElement.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
            }
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    async validateAccessCode() {
        const codeInput = document.getElementById('accessCode');
        const code = codeInput.value.trim();
        
        if (!code || code.length !== 6) {
            this.showAlert('Veuillez entrer un code valide à 6 chiffres', 'error');
            return;
        }

        try {
            this.showLoading(true);
            
            const token = localStorage.getItem('quizToken');
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/payment/validate-code`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code })
            });

            const result = await response.json();
            
            if (result.success) {
                this.showAlert('Code validé avec succès !', 'success');
                
                // Fermer le modal
                const codeModal = bootstrap.Modal.getInstance(document.getElementById('codeModal'));
                if (codeModal) {
                    codeModal.hide();
                }
                
                // Redémarrer le chargement du quiz
                const quizId = document.getElementById('validate-code').getAttribute('data-quiz-id');
                if (quizId) {
                    await this.startQuiz(quizId);
                }
            } else {
                this.showAlert(result.message || 'Code invalide', 'error');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showAlert('Erreur lors de la validation du code', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async getActiveAPIUrl() {
        try {
            const response = await fetch('https://quiz-de-carabin-backend.onrender.com/api/health');
            if (response.ok) return 'https://quiz-de-carabin-backend.onrender.com';
        } catch (error) {
            console.warn('URL principale inaccessible');
        }
        return 'https://quiz-de-carabin-backend.onrender.com';
    }

    showLoading(show) {
        const loader = document.getElementById('loading-spinner');
        if (loader) {
            loader.style.display = show ? 'block' : 'none';
        }
    }

    showLoginPrompt() {
        const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
        loginModal.show();
    }

    showError(message) {
        this.showAlert(message, 'error');
    }

    showAlert(message, type = 'info') {
        const alertClass = type === 'error' ? 'alert-danger' : 
                          type === 'success' ? 'alert-success' : 'alert-info';
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${alertClass} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Ajouter l'alerte en haut de la page
        const container = document.querySelector('.container');
        container.insertBefore(alertDiv, container.firstChild);
        
        // Auto-supprimer après 5 secondes
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Initialisation quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier si on est sur la page quiz.html
    if (window.location.pathname.includes('quiz.html')) {
        window.quizManager = new QuizManager();
    }
});

// Gestion de la protection contre la copie
document.addEventListener('DOMContentLoaded', function() {
    const protectionOverlay = document.getElementById('protection-overlay');
    
    // Empêcher le clic droit
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showProtectionAlert();
    });

    // Empêcher la copie
    document.addEventListener('copy', function(e) {
        e.preventDefault();
        showProtectionAlert();
    });

    // Empêcher le glisser-déposer
    document.addEventListener('dragstart', function(e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    });

    function showProtectionAlert() {
        if (protectionOverlay) {
            protectionOverlay.style.display = 'flex';
            setTimeout(() => {
                protectionOverlay.style.display = 'none';
            }, 2000);
        }
    }
});

// Export pour une utilisation externe
export { QuizManager as Quiz };