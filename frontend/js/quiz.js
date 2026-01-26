import { CONFIG } from './config.js';

export class Quiz {
    constructor() {
        this.quizzes = [];
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.timerInterval = null;
        this.timeLeft = 0;
        
        // Ne PAS appeler init() dans le constructeur
        console.log("📦 Quiz construit");
    }

    // ✅ Méthode d'initialisation EXTERNE appelée par App
    async init() {
        console.log("🎬 Quiz.init() appelé");
        this.setupEventListeners();
        await this.loadQuizzes();
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
        console.log('🔄 Chargement quiz...');
        
        this.showLoader();
        
        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const headers = {
                'Content-Type': 'application/json'
            };
            
            const token = localStorage.getItem('quizToken');
            if (token && token !== 'null' && token !== 'undefined') {
                headers['Authorization'] = `Bearer ${token}`;
                console.log('🔑 Token ajouté');
            }

            console.log(`📡 Requête: ${API_BASE_URL}/api/quiz`);
            
            const response = await fetch(`${API_BASE_URL}/api/quiz`, {
                headers: headers
            });

            console.log(`📥 Réponse: ${response.status}`);

            if (response.status === 401) {
                console.log('⚠️ Non authentifié');
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
                console.error('❌ Erreur serveur:', response.status);
                this.showError('Erreur serveur. Réessayez plus tard.');
            }
        } catch (error) {
            console.error('❌ Erreur fetch:', error);
            this.showError('Erreur connexion. Vérifiez votre réseau.');
        }
    }

    displayQuizzes() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) {
            console.error("❌ #quiz-list introuvable");
            return;
        }
        
        this.hideLoader();
        quizList.innerHTML = '';

        if (this.quizzes.length === 0) {
            quizList.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Aucun quiz disponible.
                    </div>
                </div>
            `;
            return;
        }

        console.log(`🎨 Affichage ${this.quizzes.length} quiz`);

        const quizzesBySubject = this.quizzes.reduce((acc, quiz) => {
            const subject = quiz.subject || 'Autres';
            if (!acc[subject]) acc[subject] = [];
            acc[subject].push(quiz);
            return acc;
        }, {});
        
        const sortedSubjects = Object.keys(quizzesBySubject).sort();

        sortedSubjects.forEach(subject => {
            const quizzes = quizzesBySubject[subject];
            
            const subjectSection = document.createElement('div');
            subjectSection.className = 'col-12 mb-5 animate-fadeInUp';
            
            subjectSection.innerHTML = `
                <div class="subject-header mb-4 mt-4">
                    <h3 class="fw-bold text-primary">${subject}</h3>
                    <hr class="mt-2 mb-4" style="border-top: 3px solid var(--secondary); opacity: 1;">
                </div>
                <div class="row" id="subject-row-${subject.replace(/\s+/g, '-').toLowerCase()}"></div>
            `;
            
            quizList.appendChild(subjectSection);
            
            const subjectRow = document.getElementById(`subject-row-${subject.replace(/\s+/g, '-').toLowerCase()}`);

            quizzes.forEach(quiz => {
                const isFree = quiz.free || false;
                
                let isPremium = false;
                try {
                    const userStr = localStorage.getItem('quizUser');
                    if (userStr && userStr !== 'null') {
                        const user = JSON.parse(userStr);
                        isPremium = user.isPremium || false;
                    }
                } catch (e) {
                    console.error('Erreur user:', e);
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
                            <p class="card-text">${quiz.description || ''}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <small><i class="fas fa-question-circle me-1"></i> ${quiz.questions?.length || 0} questions</small>
                                <small><i class="fas fa-clock me-1"></i> ${quiz.duration || 10} min</small>
                            </div>
                        </div>
                        <div class="card-footer bg-white">
                            <button class="btn ${hasAccess ? 'btn-primary' : 'btn-outline-primary'} w-100 start-quiz" 
                                    data-quiz-id="${quiz._id}" 
                                    data-has-access="${hasAccess}">
                                ${hasAccess ? 'Commencer' : 'Premium requis'}
                            </button>
                        </div>
                    </div>
                `;
                subjectRow.appendChild(quizCard);
            });
        });

        this.addQuizEventListeners();
        console.log("✅ Quiz affichés");
    }

    addQuizEventListeners() {
        document.querySelectorAll('.start-quiz').forEach(button => {
            button.addEventListener('click', (e) => {
                const quizId = e.target.getAttribute('data-quiz-id');
                const hasAccess = e.target.getAttribute('data-has-access') === 'true';
                
                if (!hasAccess) {
                    alert('Abonnement Premium requis.');
                    const pricing = document.getElementById('pricing-section');
                    if (pricing) pricing.scrollIntoView({ behavior: 'smooth' });
                } else {
                    this.startQuiz(quizId);
                }
            });
        });
    }

    showLoader() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;
        
        quizList.innerHTML = `
            <div class="col-12">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                    <p class="mt-3">Chargement des quiz...</p>
                </div>
            </div>
        `;
    }

    hideLoader() {
        const loader = document.querySelector('.spinner-border');
        if (loader && loader.parentElement) {
            loader.parentElement.style.display = 'none';
        }
    }

    showLoginPrompt() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;
        
        this.hideLoader();
        
        quizList.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-warning">
                    <h4>Connexion requise</h4>
                    <p>Connectez-vous pour accéder aux quiz.</p>
                    <button class="btn btn-primary mt-2" id="quiz-login-button">
                        Se connecter
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
                        Actualiser
                    </button>
                </div>
            </div>
        `;
    }

    async getActiveAPIUrl() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
                method: 'GET',
                cache: 'no-cache'
            });
            
            if (response.ok) return CONFIG.API_BASE_URL;
        } catch (error) {
            console.warn('URL principale inaccessible');
        }
        
        return CONFIG.API_BACKUP_URL;
    }

    async startQuiz(quizId) {
        try {
            const token = localStorage.getItem('quizToken');
            
            if (!token) {
                alert('Connectez-vous pour accéder au quiz.');
                return;
            }

            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/quiz/${quizId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.status === 403) {
                alert('Accès Premium requis.');
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.currentQuiz = data.quiz || data.data;
                this.userAnswers = new Array(this.currentQuiz.questions.length).fill().map(() => []);
                this.currentQuestionIndex = 0;

                const quizListSection = document.getElementById('quiz-list-section'); 
                const quizInterface = document.getElementById('quiz-interface');
                
                if (quizListSection) quizListSection.style.display = 'none';
                if (quizInterface) quizInterface.style.display = 'block';

                document.getElementById('quiz-title').textContent = this.currentQuiz.title;
                this.showQuestion(0);
                this.startTimer(this.currentQuiz.duration * 60);
            }
        } catch (error) {
            console.error('Erreur startQuiz:', error);
            alert('Erreur chargement quiz: ' + error.message);
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
                <h5 class="mb-3">Question ${index + 1}/${this.currentQuiz.questions.length}</h5>
                <p class="question-text">${question.text}</p>
            </div>
            <div class="options-container">${optionsHTML}</div>
        `;

        document.getElementById('prev-btn').disabled = index === 0;
        document.getElementById('next-btn').style.display = index < this.currentQuiz.questions.length - 1 ? 'block' : 'none';
        document.getElementById('submit-quiz').style.display = index === this.currentQuiz.questions.length - 1 ? 'block' : 'none';

        const progressPercent = ((index + 1) / this.currentQuiz.questions.length) * 100;
        const progressBar = document.getElementById('quiz-progress');
        if (progressBar) progressBar.style.width = `${progressPercent}%`;

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
                alert('Temps écoulé!');
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
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            
            if (data.success) {
                this.showResults(data);
            } else {
                alert('Erreur soumission: ' + data.message);
            }
        } catch (error) {
            console.error('Erreur submit:', error);
            alert('Erreur: ' + error.message);
        }
    }

    showResults(data) {
        const resultsContainer = document.getElementById('results-container');
        const resultsContent = document.getElementById('results-content');
        const scorePercent = Math.round((data.score / data.totalQuestions) * 100);
        
        document.getElementById('score-value').textContent = scorePercent;
        
        let scoreText, scoreDescription;
        
        if (scorePercent >= 80) {
            scoreText = 'Excellent!';
            scoreDescription = 'Vous maîtrisez ce sujet!';
        } else if (scorePercent >= 60) {
            scoreText = 'Bon travail!';
            scoreDescription = 'Bonne compréhension.';
        } else if (scorePercent >= 40) {
            scoreText = 'Pas mal!';
            scoreDescription = 'Continuez à réviser.';
        } else {
            scoreText = 'À améliorer';
            scoreDescription = 'Étudiez davantage.';
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
                <div class="result-item mb-4 p-3 border rounded ${isCorrect ? 'border-success' : 'border-danger'}">
                    <h6>Question ${index + 1}: ${question.text}</h6>
                    <p class="${isCorrect ? 'text-success' : 'text-danger'}">
                        <strong>Vos réponses:</strong> 
                        ${userAnswer.length > 0 ? userAnswer.map(idx => question.options[idx].text).join(', ') : 'Aucune'}
                        ${isCorrect ? '<i class="fas fa-check ms-2"></i>' : '<i class="fas fa-times ms-2"></i>'}
                    </p>
                    ${!isCorrect ? `<p class="text-success"><strong>Correctes:</strong> ${correctAnswers.map(idx => question.options[idx].text).join(', ')}</p>` : ''}
                    <div class="justification mt-2 border-top pt-2">
                        <strong>Explication:</strong> ${question.justification || 'N/A'}
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

window.Quiz = Quiz;