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

    async init() {
        console.log("✅ Initialisation du module Quiz");
        this.setupEventListeners();
        
        // ✅ CORRECTION CRITIQUE : Toujours charger les quiz immédiatement
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
        console.log('🔄 Début du chargement des quizs');
        
        this.showLoader();
        
        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const headers = {
                'Content-Type': 'application/json'
            };
            
            const token = localStorage.getItem('quizToken');
            if (token && token !== 'null' && token !== 'undefined') {
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
                console.error('❌ Erreur serveur:', response.status);
                this.showError('Erreur serveur. Veuillez réessayer plus tard.');
            }
        } catch (error) {
            console.error('❌ Erreur connexion:', error);
            this.showError('Erreur de connexion. Vérifiez votre connexion internet.');
        }
    }

    displayQuizzes() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) {
            console.error("❌ Element #quiz-list non trouvé");
            return;
        }
        
        this.hideLoader();
        
        console.log("🎨 Rendu des quizs");
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

        // Regrouper par matière
        const quizzesBySubject = this.quizzes.reduce((acc, quiz) => {
            const subject = quiz.subject || 'Autres';
            if (!acc[subject]) {
                acc[subject] = [];
            }
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
                <div class="row" id="subject-row-${subject.replace(/\s+/g, '-').toLowerCase()}">
                </div>
            `;
            
            quizList.appendChild(subjectSection);
            
            const subjectRow = document.getElementById(`subject-row-${subject.replace(/\s+/g, '-').toLowerCase()}`);

            quizzes.forEach(quiz => {
                const isFree = quiz.free || false;
                
                // ✅ Vérifier isPremium de manière sécurisée
                let isPremium = false;
                try {
                    const userStr = localStorage.getItem('quizUser');
                    if (userStr && userStr !== 'null') {
                        const user = JSON.parse(userStr);
                        isPremium = user.isPremium || false;
                    }
                } catch (e) {
                    console.error('Erreur lecture user:', e);
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
                                <small><i class="fas fa-clock me-1"></i> ${quiz.duration || 10} minutes</small>
                            </div>
                        </div>
                        <div class="card-footer bg-white">
                            <button class="btn ${hasAccess ? 'btn-primary' : 'btn-outline-primary'} w-100 start-quiz" 
                                    data-quiz-id="${quiz._id}" 
                                    data-has-access="${hasAccess}">
                                ${hasAccess ? 'Commencer le quiz' : 'Accès Premium requis'}
                            </button>
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
                const hasAccess = e.target.getAttribute('data-has-access') === 'true';
                
                if (!hasAccess) {
                    alert('Abonnement Premium requis pour ce quiz.');
                    const pricingSection = document.getElementById('pricing-section');
                    if (pricingSection) {
                        pricingSection.scrollIntoView({ behavior: 'smooth' });
                    }
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
        if (loader) {
            loader.style.display = 'none';
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
                    <p>Vous devez vous connecter pour accéder aux quiz.</p>
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
                        Actualiser la page
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
            
            if (response.ok) {
                return CONFIG.API_BASE_URL;
            }
        } catch (error) {
            console.warn('URL principale inaccessible');
        }
        
        return CONFIG.API_BACKUP_URL;
    }

    async startQuiz(quizId) {
        try {
            const token = localStorage.getItem('quizToken');
            
            if (!token) {
                alert('Vous devez vous connecter pour accéder à ce quiz.');
                return;
            }

            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/quiz/${quizId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.status === 403) {
                const errorData = await response.json();
                alert(errorData.message || 'Accès Premium requis pour ce quiz.');
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

                const quizListSection = document.getElementById('quiz-list-section'); 
                const quizInterface = document.getElementById('quiz-interface');
                
                if (quizListSection) quizListSection.style.display = 'none';
                if (quizInterface) quizInterface.style.display = 'block';

                document.getElementById('quiz-title').textContent = this.currentQuiz.title;
                this.showQuestion(0);
                this.startTimer(this.currentQuiz.duration * 60);
            }
        } catch (error) {
            console.error('Error starting quiz:', error);
            alert('Erreur lors du chargement du quiz: ' + error.message);
        }
    }

    // ... Gardez toutes les autres méthodes (showQuestion, nextQuestion, etc.) EXACTEMENT comme elles sont
    
    showQuizList() {
        document.getElementById('quiz-interface').style.display = 'none';
        const quizListSection = document.getElementById('quiz-list-section');
        if (quizListSection) quizListSection.style.display = 'block';
        document.getElementById('results-container').style.display = 'none';
        
        this.loadQuizzes();
    }
}

window.Quiz = Quiz;