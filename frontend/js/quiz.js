import { CONFIG } from './config.js';

export class Quiz {
    constructor() {
        this.quizzes = [];
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.timerInterval = null;
        this.timeLeft = 0;
        
        this.init();
    }

    init() {
        console.log("✅ Initialisation du module Quiz");
        this.setupEventListeners();
        
        // ✅ CORRECTION: Charger TOUJOURS les quiz au démarrage
        // Ne pas attendre window.app.auth
        setTimeout(() => {
            this.loadQuizzes();
        }, 500); // Petit délai pour laisser le DOM se stabiliser
    }

    setupEventListeners() {
        document.getElementById('back-to-quizzes')?.addEventListener('click', () => {
            this.showQuizList();
        });
        
        document.getElementById('review-btn')?.addEventListener('click', () => {
            this.showQuestion(0);
        });

        document.getElementById('prev-btn')?.addEventListener('click', () => {
            this.prevQuestion();
        });

        document.getElementById('next-btn')?.addEventListener('click', () => {
            this.nextQuestion();
        });

        document.getElementById('submit-quiz')?.addEventListener('click', () => {
            this.submitQuiz();
        });
    }

    async loadQuizzes() {
        console.log('🔄 Début du chargement des quizs');
        
        this.showLoader();
        
        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // ✅ CORRECTION: Vérifier le token de manière plus robuste
            const token = localStorage.getItem('quizToken');
            if (token && token !== 'null' && token !== 'undefined' && token.length > 10) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${API_BASE_URL}/api/quiz`, {
                headers: headers
            });

            if (response.status === 401) {
                console.log('⚠️ Token expiré ou invalide');
                localStorage.removeItem('quizToken');
                localStorage.removeItem('quizUser');
                this.showLoginPrompt();
                return;
            }

            if (response.ok) {
                const data = await response.json();
                this.quizzes = data.quizzes || data.data || [];
                console.log(`✅ ${this.quizzes.length} quiz chargés`);
                this.displayQuizzes();
            } else {
                console.error('❌ Erreur lors du chargement des quizs:', response.status);
                this.showError('Erreur serveur. Veuillez réessayer plus tard.');
            }
        } catch (error) {
            console.error('❌ Erreur lors du chargement des quizs:', error);
            this.showError('Erreur de connexion. Vérifiez votre connexion internet.');
        }
    }

    displayQuizzes() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) {
            console.error("❌ Element #quiz-list non trouvé dans le DOM");
            return;
        }
        
        this.hideLoader();
        
        console.log("🎨 Rendu des quizs dans l'interface");
        quizList.innerHTML = '';

        if (this.quizzes.length === 0) {
            quizList.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Aucun quiz disponible pour le moment.
                    </div>
                </div>
            `;
            return;
        }

        // Regroupement par matière (subject)
        const quizzesBySubject = this.quizzes.reduce((acc, quiz) => {
            const subject = quiz.subject || 'Autres';
            if (!acc[subject]) {
                acc[subject] = [];
            }
            acc[subject].push(quiz);
            return acc;
        }, {});
        
        const sortedSubjects = Object.keys(quizzesBySubject).sort();

        // Rendu par matière
        sortedSubjects.forEach(subject => {
            const quizzes = quizzesBySubject[subject];
            
            const subjectSection = document.createElement('div');
            subjectSection.className = 'col-12 mb-5 animate-fadeInUp';
            
            subjectSection.innerHTML = `
                <div class="subject-header mb-4 mt-4">
                    <h3 class="fw-bold text-primary">${subject}</h3>
                    <hr class="mt-2 mb-4" style="border-top: 3px solid var(--secondary); opacity: 1;">
                </div>
                <div class="row" id="subject-row-${subject.replace(/\s+/g, '-').toLowerCase()}">
                </div>
            `;
            
            quizList.appendChild(subjectSection);
            
            const subjectRow = document.getElementById(`subject-row-${subject.replace(/\s+/g, '-').toLowerCase()}`);

            quizzes.forEach(quiz => {
                const isFree = quiz.free || false;
                
                // ✅ CORRECTION: Vérifier isPremium de manière plus sûre
                let isPremium = false;
                try {
                    const userStr = localStorage.getItem('quizUser');
                    if (userStr && userStr !== 'null') {
                        const user = JSON.parse(userStr);
                        isPremium = user.isPremium || false;
                    }
                } catch (e) {
                    console.warn('Erreur lecture user:', e);
                }
                
                const hasAccess = isFree || isPremium;
                
                const quizCard = document.createElement('div');
                quizCard.className = 'col-md-4 mb-4';
                quizCard.innerHTML = `
                    <div class="card quiz-card h-100">
                        <div class="card-body">
                            <span class="badge ${isFree ? 'bg-success' : 'bg-warning text-dark'} mb-2">
                                ${isFree ? 'GRATUIT' : 'PREMIUM'}
                            </span>
                            <h5 class="card-title">${quiz.title}</h5>
                            <h6 class="card-subtitle mb-2 text-muted">${quiz.category || ''}</h6> 
                            <p class="card-text">${quiz.description || 'Testez vos connaissances'}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <small><i class="fas fa-question-circle me-1"></i> ${quiz.questions?.length || 0} questions</small>
                                <small><i class="fas fa-clock me-1"></i> ${quiz.duration || 10} minutes</small>
                            </div>
                        </div>
                        <div class="card-footer bg-white">
                            <button class="btn ${hasAccess ? 'btn-primary' : 'btn-outline-primary'} w-100 start-quiz" 
                                    data-quiz-id="${quiz._id}" 
                                    data-quiz-free="${isFree}"
                                    ${!hasAccess && !isFree ? 'disabled' : ''}>
                                ${hasAccess ? 'Commencer le quiz' : 'Accéder (Premium requis)'}
                            </button>
                            ${!hasAccess && !isFree ? `
                                <small class="text-muted d-block mt-2 text-center">
                                    <i class="fas fa-lock me-1"></i>Abonnement premium requis
                                </small>
                            ` : ''}
                        </div>
                    </div>
                `;
                subjectRow.appendChild(quizCard);
            });
        });

        this.addQuizEventListeners();
    }

    addQuizEventListeners() {
        document.querySelectorAll('.start-quiz').forEach(button => {
            button.addEventListener('click', (e) => {
                const quizId = e.target.getAttribute('data-quiz-id');
                const isFree = e.target.getAttribute('data-quiz-free') === 'true';
                const quiz = this.quizzes.find(q => q._id === quizId);
                
                if (!quiz) {
                    console.error('Quiz non trouvé:', quizId);
                    return;
                }
                
                // ✅ CORRECTION: Vérification premium plus robuste
                let isPremium = false;
                try {
                    const userStr = localStorage.getItem('quizUser');
                    if (userStr && userStr !== 'null') {
                        const user = JSON.parse(userStr);
                        isPremium = user.isPremium || false;
                    }
                } catch (e) {
                    console.warn('Erreur lecture user:', e);
                }
                
                if (!isFree && !isPremium) {
                    // Afficher modal d'abonnement ou rediriger
                    alert("Abonnement Premium requis pour ce quiz.");
                    
                    // Scroll vers la section pricing si elle existe
                    const pricingSection = document.getElementById('pricing-section');
                    if (pricingSection) {
                        pricingSection.scrollIntoView({ behavior: 'smooth' });
                    }
                    return;
                }
                
                this.startQuiz(quizId);
            });
        });
    }

    showLoader() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;
        
        quizList.innerHTML = `
            <div class="col-12">
                <div class="quiz-loader text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                    <p class="mt-3">Chargement des quiz...</p>
                </div>
            </div>
        `;
    }

    hideLoader() {
        const loader = document.querySelector('.quiz-loader');
        if (loader && loader.parentElement) {
            loader.parentElement.remove();
        }
    }

    showLoginPrompt() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;
        
        this.hideLoader();
        
        quizList.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-warning">
                    <h4><i class="fas fa-sign-in-alt me-2"></i>Connexion requise</h4>
                    <p>Vous devez vous connecter pour accéder aux quiz.</p>
                    <button class="btn btn-primary mt-2" id="quiz-login-button">
                        <i class="fas fa-user me-2"></i>Se connecter
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('quiz-login-button')?.addEventListener('click', () => {
            const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            loginModal.show();
        });
    }

    showError(message) {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;
        
        this.hideLoader();
        
        quizList.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-danger">
                    <h4><i class="fas fa-exclamation-triangle me-2"></i>Erreur</h4>
                    <p>${message}</p>
                    <button class="btn btn-primary mt-2" onclick="window.location.reload()">
                        <i class="fas fa-sync me-2"></i>Actualiser la page
                    </button>
                </div>
            </div>
        `;
    }

    async getActiveAPIUrl() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
                method: 'GET',
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return CONFIG.API_BASE_URL;
            }
        } catch (error) {
            console.warn('⚠️ URL principale inaccessible');
        }
        
        return CONFIG.API_BACKUP_URL || CONFIG.API_BASE_URL;
    }

    async startQuiz(quizId) {
        try {
            const token = localStorage.getItem('quizToken');
            
            if (!token || token === 'null') {
                alert('Vous devez vous connecter pour accéder à ce quiz.');
                const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                loginModal.show();
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
                const errorData = await response.json();
                alert(errorData.message || 'Accès Premium requis pour ce quiz.');
                
                const pricingSection = document.getElementById('pricing-section');
                if (pricingSection) {
                    pricingSection.scrollIntoView({ behavior: 'smooth' });
                }
                return;
            }

            if (response.status === 401) {
                localStorage.removeItem('quizToken');
                localStorage.removeItem('quizUser');
                alert('Session expirée. Veuillez vous reconnecter.');
                window.location.reload();
                return;
            }

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.currentQuiz = data.quiz || data.data;
                this.userAnswers = new Array(this.currentQuiz.questions.length).fill().map(() => []);
                this.currentQuestionIndex = 0;

                // ✅ CORRECTION: Masquer la liste et afficher l'interface
                const quizListSection = document.getElementById('quiz-list-section'); 
                const quizInterface = document.getElementById('quiz-interface');
                
                if (quizListSection) quizListSection.style.display = 'none';
                if (quizInterface) {
                    quizInterface.style.display = 'block';
                    document.getElementById('quiz-title').textContent = this.currentQuiz.title;
                    this.showQuestion(0);
                    this.startTimer(this.currentQuiz.duration * 60);
                }
            } else {
                throw new Error(data.message || 'Erreur inconnue');
            }
        } catch (error) {
            console.error('❌ Error starting quiz:', error);
            alert('Erreur lors du chargement du quiz: ' + error.message);
        }
    }

    showQuestion(index) {
        if (!this.currentQuiz || index < 0 || index >= this.currentQuiz.questions.length) return;

        const question = this.currentQuiz.questions[index];
        const questionContainer = document.getElementById('question-container');
        this.currentQuestionIndex = index;

        let optionsHTML = '';
        question.options.forEach((option, i) => {
            const isSelected = this.userAnswers[index].includes(i);
            optionsHTML += `
                <div class="option-item ${isSelected ? 'selected' : ''}">
                    <input type="checkbox" id="option-${i}" data-index="${i}" ${isSelected ? 'checked' : ''}>
                    <label for="option-${i}">${option.text}</label>
                </div>
            `;
        });

        questionContainer.innerHTML = `
            <div class="question-card">
                <h5>Question ${index + 1}/${this.currentQuiz.questions.length}</h5>
                <p class="lead">${question.text}</p>
            </div>
            <div class="options mt-3">${optionsHTML}</div>
        `;

        // Navigation
        document.getElementById('prev-btn').disabled = index === 0;
        document.getElementById('next-btn').style.display = index < this.currentQuiz.questions.length - 1 ? 'block' : 'none';
        document.getElementById('submit-quiz').style.display = index === this.currentQuiz.questions.length - 1 ? 'block' : 'none';

        // Barre de progression
        const progressPercent = ((index + 1) / this.currentQuiz.questions.length) * 100;
        const progressBar = document.getElementById('quiz-progress');
        if (progressBar) {
            progressBar.style.width = `${progressPercent}%`;
        }

        this.addOptionEventListeners(index);
    }

    addOptionEventListeners(questionIndex) {
        document.querySelectorAll('.option-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const optionIndex = parseInt(e.target.getAttribute('data-index'));
                const optionItem = e.target.closest('.option-item');
                
                if (e.target.checked) {
                    if (!this.userAnswers[questionIndex].includes(optionIndex)) {
                        this.userAnswers[questionIndex].push(optionIndex);
                    }
                    optionItem.classList.add('selected');
                } else {
                    this.userAnswers[questionIndex] = this.userAnswers[questionIndex].filter(idx => idx !== optionIndex);
                    optionItem.classList.remove('selected');
                }
            });
        });
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.showQuestion(this.currentQuestionIndex + 1);
        }
    }

    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.showQuestion(this.currentQuestionIndex - 1);
        }
    }

    startTimer(seconds) {
        this.timeLeft = seconds;
        clearInterval(this.timerInterval);
        
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                alert('Temps écoulé! Le quiz sera soumis automatiquement.');
                this.submitQuiz();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const timerElement = document.getElementById('quiz-timer');
        if (timerElement) {
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    async submitQuiz() {
        clearInterval(this.timerInterval);
        
        try {
            const token = localStorage.getItem('quizToken');
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/quiz/${this.currentQuiz._id}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    answers: this.userAnswers,
                    timeSpent: (this.currentQuiz.duration * 60) - this.timeLeft
                })
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.showResults(data);
            } else {
                alert('Erreur lors de la soumission du quiz: ' + data.message);
            }
        } catch (error) {
            console.error('❌ Error submitting quiz:', error);
            alert('Erreur lors de la soumission du quiz: ' + error.message);
        }
    }

    showResults(data) {
        const resultsContainer = document.getElementById('results-container');
        const resultsContent = document.getElementById('results-content');
        const scorePercent = Math.round((data.score / data.totalQuestions) * 100);
        
        document.getElementById('score-value').textContent = scorePercent;
        
        let scoreText = '';
        let scoreDescription = '';
        
        if (scorePercent >= 80) {
            scoreText = 'Excellent!';
            scoreDescription = 'Vous maîtrisez parfaitement ce sujet!';
        } else if (scorePercent >= 60) {
            scoreText = 'Bon travail!';
            scoreDescription = 'Vous avez une bonne compréhension de ce sujet.';
        } else if (scorePercent >= 40) {
            scoreText = 'Pas mal!';
            scoreDescription = 'Quelques révisions vous aideront à améliorer votre score.';
        } else {
            scoreText = 'À améliorer';
            scoreDescription = 'Continuez à étudier, vous vous améliorerez!';
        }
        
        document.getElementById('score-text').textContent = scoreText;
        document.getElementById('score-description').textContent = scoreDescription;
        
        let resultsHTML = '';
        
        this.currentQuiz.questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index] || [];
            const correctAnswers = question.correctAnswers; 
            const isCorrect = userAnswer.length === correctAnswers.length && 
                              userAnswer.every(val => correctAnswers.includes(val));
            
            resultsHTML += `
                <div class="result-item mb-4 p-3 border rounded">
                    <h6>Question ${index + 1}: ${question.text}</h6>
                    <p class="${isCorrect ? 'text-success' : 'text-danger'}">
                        <strong>Vos réponses:</strong> 
                        ${userAnswer.length > 0 ? userAnswer.map(idx => question.options[idx].text).join(', ') : 'Aucune réponse'}
                        ${isCorrect ? '<i class="fas fa-check ms-2"></i>' : '<i class="fas fa-times ms-2"></i>'}
                    </p>
            `;

            if (!isCorrect) {
                resultsHTML += `<p class="text-success"><strong>Réponses correctes:</strong> ${correctAnswers.map(idx => question.options[idx].text).join(', ')}</p>`;
            }

            resultsHTML += `
                    <div class="justification mt-2 border-top pt-2">
                        <strong>Explication:</strong> ${question.justification}
                    </div>
                </div>
            `;
        });

        resultsContent.innerHTML = resultsHTML;

        document.getElementById('question-container').style.display = 'none';
        resultsContainer.style.display = 'block';
    }

    showQuizList() {
        document.getElementById('quiz-interface').style.display = 'none';
        const quizListSection = document.getElementById('quiz-list-section');
        if (quizListSection) quizListSection.style.display = 'block';
        document.getElementById('results-container').style.display = 'none';
        
        this.loadQuizzes();
    }
}

console.log('✅ Module Quiz chargé');