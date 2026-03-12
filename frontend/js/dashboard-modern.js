/**
 * ================================================================
 * DASHBOARD MODERNE - JAVASCRIPT
 * ================================================================
 * Gestion du dashboard avec graphiques Chart.js
 * ================================================================
 */

const API_URL = 'https://quiz-de-carabin-backend.onrender.com';

class ModernDashboard {
    constructor() {
        this.progressChart = null;
        this.subjectChart = null;
        this.init();
    }

    async init() {
        // Vérifier authentification
        const token = localStorage.getItem('quizToken');
        const userStr = localStorage.getItem('quizUser');
        
        if (!token || !userStr) {
            window.location.href = '/login.html';
            return;
        }
        
        try {
            const user = JSON.parse(userStr);
            
            // Afficher info utilisateur
            document.getElementById('userName').textContent = user.name || 'Étudiant';
            
            // Afficher badge Premium si applicable
            if (user.isPremium) {
                this.showPremiumBadge(user);
            }
        } catch (e) {
            console.error('Erreur parse user:', e);
        }
        
        // Charger les données
        await this.loadDashboardData();
    }

    showPremiumBadge(user) {
        const badge = document.getElementById('premiumBadge');
        if (badge) {
            badge.style.display = 'flex';
            
            if (user.premiumExpiresAt) {
                const expiryDate = new Date(user.premiumExpiresAt);
                const expiresEl = document.getElementById('premiumExpires');
                if (expiresEl) {
                    expiresEl.textContent = `Expire le ${expiryDate.toLocaleDateString('fr-FR')}`;
                }
            }
        }
    }

    async loadDashboardData() {
        try {
            const token = localStorage.getItem('quizToken');
            
            // ✅ Utiliser la route /api/user/dashboard-stats
            const response = await fetch(`${API_URL}/api/user/dashboard-stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                localStorage.clear();
                window.location.href = '/login.html';
                return;
            }

            if (!response.ok) {
                throw new Error('Erreur chargement dashboard');
            }

            const data = await response.json();
            
            if (data.success) {
                this.displayStats(data);
            } else {
                this.displayDemoData();
            }
        } catch (error) {
            console.error('Erreur loadDashboardData:', error);
            this.displayDemoData();
        }
    }

    displayStats(data) {
        const stats = data.stats || {};
        const user = data.user || {};
        
        // Quick stats
        document.getElementById('totalQuizzes').textContent = stats.totalQuizzes || 0;
        document.getElementById('averageScore').textContent = (stats.averageScore || 0) + '%';
        document.getElementById('streak').textContent = stats.streak || 0;
        document.getElementById('level').textContent = stats.level || 1;
        
        // XP Progress
        this.updateXPProgress({
            level: stats.level || 1,
            xp: (stats.totalQuizzes || 0) * 10,
            nextLevelXP: (stats.level || 1) * 100
        });
        
        // Graphiques avec données réelles (à améliorer plus tard)
        this.createProgressChart([
            { date: new Date().toISOString(), averageScore: stats.averageScore || 0, quizzesCompleted: stats.totalQuizzes || 0 }
        ]);
        
        this.createSubjectChart([
            { subject: 'Général', averageMastery: stats.averageScore || 0 }
        ]);
        
        // Badges
        const badges = [];
        if (stats.totalQuizzes >= 1) badges.push('first_quiz');
        if (stats.totalQuizzes >= 10) badges.push('quiz_10');
        if (stats.averageScore >= 100) badges.push('score_100');
        
        this.displayBadges(badges);
    }

    displayDemoData() {
        // Données de démonstration
        document.getElementById('totalQuizzes').textContent = '0';
        document.getElementById('averageScore').textContent = '0%';
        document.getElementById('streak').textContent = '0';
        document.getElementById('level').textContent = '1';
        
        this.updateXPProgress({ level: 1, xp: 0, nextLevelXP: 100 });
        
        // Charts démo
        this.createProgressChart([
            { date: new Date().toISOString(), averageScore: 0, quizzesCompleted: 0 }
        ]);
        
        this.createSubjectChart([
            { subject: 'Aucune donnée', averageMastery: 0 }
        ]);
        
        this.displayBadges([]);
    }

    updateXPProgress(data) {
        const level = data.level || 1;
        const currentXP = data.xp || 0;
        const nextLevelXP = data.nextLevelXP || 100;
        
        const currentLevelEl = document.getElementById('currentLevel');
        const currentXPEl = document.getElementById('currentXP');
        const nextLevelXPEl = document.getElementById('nextLevelXP');
        const xpBarEl = document.getElementById('xpBar');
        const xpCircleEl = document.getElementById('xpCircle');
        
        if (currentLevelEl) currentLevelEl.textContent = level;
        if (currentXPEl) currentXPEl.textContent = currentXP;
        if (nextLevelXPEl) nextLevelXPEl.textContent = nextLevelXP;
        
        // Barre XP
        const percentage = Math.min((currentXP / nextLevelXP) * 100, 100);
        if (xpBarEl) {
            xpBarEl.style.width = `${percentage}%`;
        }
        
        // Cercle XP
        if (xpCircleEl) {
            const radius = 65;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (percentage / 100) * circumference;
            
            xpCircleEl.style.strokeDasharray = circumference;
            xpCircleEl.style.strokeDashoffset = offset;
        }
    }

    createProgressChart(data) {
        const ctx = document.getElementById('progressChart');
        if (!ctx) return;
        
        if (this.progressChart) {
            this.progressChart.destroy();
        }
        
        const labels = data.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        });
        
        const scores = data.map(d => d.averageScore || 0);
        
        this.progressChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score moyen (%)',
                    data: scores,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    createSubjectChart(data) {
        const ctx = document.getElementById('subjectChart');
        if (!ctx) return;
        
        if (this.subjectChart) {
            this.subjectChart.destroy();
        }
        
        const labels = data.map(d => d.subject);
        const scores = data.map(d => d.averageMastery || 0);
        
        this.subjectChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Maîtrise (%)',
                    data: scores,
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(6, 214, 160, 0.8)',
                        'rgba(255, 209, 102, 0.8)',
                        'rgba(239, 71, 111, 0.8)',
                        'rgba(17, 138, 178, 0.8)'
                    ],
                    borderRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    displayBadges(badges) {
        const container = document.getElementById('badgesContainer');
        if (!container) return;
        
        const allBadges = [
            { id: 'first_quiz', icon: '🎯', name: 'Premier quiz', unlocked: badges.includes('first_quiz') },
            { id: 'streak_3', icon: '🔥', name: '3 jours', unlocked: badges.includes('streak_3') },
            { id: 'streak_7', icon: '🚀', name: '7 jours', unlocked: badges.includes('streak_7') },
            { id: 'score_100', icon: '💯', name: 'Score parfait', unlocked: badges.includes('score_100') },
            { id: 'quiz_10', icon: '📚', name: '10 quiz', unlocked: badges.includes('quiz_10') },
            { id: 'quiz_50', icon: '🏆', name: '50 quiz', unlocked: badges.includes('quiz_50') }
        ];
        
        const badgesHTML = allBadges.map(badge => `
            <div class="badge-item ${badge.unlocked ? 'unlocked' : 'locked'}">
                <div class="badge-icon">${badge.icon}</div>
                <div class="badge-name">${badge.name}</div>
            </div>
        `).join('');
        
        container.innerHTML = badgesHTML;
    }
}

// Initialiser
document.addEventListener('DOMContentLoaded', () => {
    new ModernDashboard();
});