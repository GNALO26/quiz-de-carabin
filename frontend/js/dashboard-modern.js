/**
 * ================================================================
 * DASHBOARD MODERNE - JAVASCRIPT
 * ================================================================
 * Gestion du dashboard avec graphiques Chart.js
 * ================================================================
 */

import { CONFIG } from './config.js';

class ModernDashboard {
    constructor() {
        this.progressChart = null;
        this.subjectChart = null;
        this.init();
    }

    async init() {
        // Vérifier authentification
        const token = localStorage.getItem('quizToken');
        const user = JSON.parse(localStorage.getItem('quizUser') || '{}');
        
        if (!token) {
            window.location.href = 'index.html';
            return;
        }
        
        // Afficher info utilisateur
        document.getElementById('userName').textContent = user.name || 'Étudiant';
        
        // Afficher badge Premium si applicable
        if (user.isPremium) {
            this.showPremiumBadge(user);
        }
        
        // Charger les données
        await this.loadDashboardData();
    }

    showPremiumBadge(user) {
        const badge = document.getElementById('premiumBadge');
        badge.style.display = 'flex';
        
        if (user.premiumUntil) {
            const expiryDate = new Date(user.premiumUntil);
            document.getElementById('premiumExpires').textContent = 
                `Expire le ${expiryDate.toLocaleDateString('fr-FR')}`;
        }
    }

    async loadDashboardData() {
        try {
            const token = localStorage.getItem('quizToken');
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            // Charger stats dashboard
            const response = await fetch(`${API_BASE_URL}/api/stats/dashboard`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Erreur chargement dashboard');
            }

            const data = await response.json();
            
            if (data.success) {
                this.displayStats(data.data);
            }
        } catch (error) {
            console.error('Erreur loadDashboardData:', error);
            this.displayDemoData();
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

    displayStats(data) {
        const { global, bySubject, recentActivity } = data;
        
        // Quick stats
        document.getElementById('totalQuizzes').textContent = global.totalQuizzes || 0;
        document.getElementById('averageScore').textContent = 
            Math.round(global.averageMastery || 0) + '%';
        document.getElementById('streak').textContent = global.streak || 0;
        document.getElementById('level').textContent = global.level || 1;
        
        // XP Progress
        this.updateXPProgress(global);
        
        // Graphiques
        this.createProgressChart(recentActivity);
        this.createSubjectChart(bySubject);
        
        // Badges
        this.displayBadges(global.badges || []);
    }

    displayDemoData() {
        // Données de démonstration
        document.getElementById('totalQuizzes').textContent = '12';
        document.getElementById('averageScore').textContent = '75%';
        document.getElementById('streak').textContent = '5';
        document.getElementById('level').textContent = '3';
        
        this.updateXPProgress({ level: 3, xp: 250, nextLevelXP: 400 });
        
        // Charts démo
        this.createProgressChart([
            { date: '2024-01-01', averageScore: 65, quizzesCompleted: 2 },
            { date: '2024-01-03', averageScore: 70, quizzesCompleted: 3 },
            { date: '2024-01-05', averageScore: 75, quizzesCompleted: 2 },
            { date: '2024-01-07', averageScore: 80, quizzesCompleted: 4 }
        ]);
        
        this.createSubjectChart([
            { subject: 'Anatomie', averageMastery: 85 },
            { subject: 'Physiologie', averageMastery: 70 },
            { subject: 'Pharmacologie', averageMastery: 65 }
        ]);
        
        this.displayBadges(['first_quiz', 'streak_3', 'score_100']);
    }

    updateXPProgress(data) {
        const level = data.level || 1;
        const currentXP = data.xp || 0;
        const nextLevelXP = data.nextLevelXP || 100;
        
        document.getElementById('currentLevel').textContent = level;
        document.getElementById('currentXP').textContent = currentXP;
        document.getElementById('nextLevelXP').textContent = nextLevelXP;
        
        // Barre XP
        const percentage = (currentXP / nextLevelXP) * 100;
        document.getElementById('xpBar').style.width = `${percentage}%`;
        
        // Cercle XP
        const circle = document.getElementById('xpCircle');
        const radius = 65;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;
        
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = offset;
        
        // Ajouter gradient SVG
        if (!document.getElementById('xpGradient')) {
            const svg = circle.closest('svg');
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.innerHTML = `
                <linearGradient id="xpGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                </linearGradient>
            `;
            svg.insertBefore(defs, svg.firstChild);
        }
    }

    createProgressChart(data) {
        const ctx = document.getElementById('progressChart');
        
        if (this.progressChart) {
            this.progressChart.destroy();
        }
        
        const labels = data.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        });
        
        const scores = data.map(d => d.averageScore);
        
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
        
        if (this.subjectChart) {
            this.subjectChart.destroy();
        }
        
        const labels = data.map(d => d.subject);
        const scores = data.map(d => d.averageMastery);
        
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