/**
 * ================================================================
 * ADMIN DASHBOARD - JAVASCRIPT
 * ================================================================
 * Gestion du panneau d'administration
 * ================================================================
 */

const API_URL = 'https://quiz-de-carabin-backend.onrender.com';

class AdminDashboard {
    constructor() {
        this.usersChart = null;
        this.premiumChart = null;
        this.init();
    }

    async init() {
        // Vérifier authentification et droits admin
        const token = localStorage.getItem('quizToken');
        const userStr = localStorage.getItem('quizUser');
        
        if (!token || !userStr) {
            window.location.href = '/login.html';
            return;
        }
        
        try {
            const user = JSON.parse(userStr);
            
            // Vérifier si admin
            if (!user.isAdmin && user.role !== 'admin') {
                alert('❌ Accès refusé. Vous devez être administrateur.');
                window.location.href = '/index.html';
                return;
            }
            
            // Afficher nom admin
            document.getElementById('adminName').textContent = user.name || 'Admin';
            
            // Initialiser navigation
            this.setupNavigation();
            
            // Charger données dashboard
            await this.loadDashboardStats();
            
            // Charger utilisateurs
            await this.loadUsers();
            
            // Charger quiz pour notifications
            await this.loadQuizList();
            
            // Setup event listeners
            this.setupEventListeners();
            
        } catch (e) {
            console.error('Erreur init admin:', e);
            window.location.href = '/login.html';
        }
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.content-section');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Retirer active de tous
                navItems.forEach(nav => nav.classList.remove('active'));
                sections.forEach(sec => sec.classList.remove('active'));
                
                // Ajouter active au cliqué
                item.classList.add('active');
                
                const sectionId = item.getAttribute('data-section') + '-section';
                const section = document.getElementById(sectionId);
                
                if (section) {
                    section.classList.add('active');
                    
                    // Mettre à jour titre
                    const title = item.textContent.trim();
                    document.getElementById('pageTitle').textContent = title;
                }
            });
        });
    }

    async loadDashboardStats() {
        try {
            const token = localStorage.getItem('quizToken');
            
            const response = await fetch(`${API_URL}/api/admin/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erreur chargement stats');
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.displayDashboardStats(data.stats);
            } else {
                console.error('Erreur stats:', data.message);
                this.displayDemoStats();
            }
            
        } catch (error) {
            console.error('Erreur loadDashboardStats:', error);
            this.displayDemoStats();
        }
    }

    displayDashboardStats(stats) {
        // Stats cards
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('premiumUsers').textContent = stats.premiumUsers || 0;
        document.getElementById('totalQuizzes').textContent = stats.totalQuizzes || 0;
        document.getElementById('totalRevenue').textContent = 
            `${(stats.totalRevenue || 0).toLocaleString()} XOF`;
        
        // Graphiques
        this.createUsersChart(stats.userGrowth || []);
        this.createPremiumChart(stats.premiumUsers || 0, stats.freeUsers || 0);
    }

    displayDemoStats() {
        document.getElementById('totalUsers').textContent = '156';
        document.getElementById('premiumUsers').textContent = '42';
        document.getElementById('totalQuizzes').textContent = '87';
        document.getElementById('totalRevenue').textContent = '1,250,000 XOF';
        
        // Charts démo
        this.createUsersChart([
            { date: '2024-01', count: 20 },
            { date: '2024-02', count: 45 },
            { date: '2024-03', count: 91 }
        ]);
        
        this.createPremiumChart(42, 114);
    }

    createUsersChart(data) {
        const ctx = document.getElementById('usersChart');
        
        if (this.usersChart) {
            this.usersChart.destroy();
        }
        
        const labels = data.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        });
        
        const counts = data.map(d => d.count);
        
        this.usersChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Inscriptions',
                    data: counts,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
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
                        beginAtZero: true
                    }
                }
            }
        });
    }

    createPremiumChart(premium, free) {
        const ctx = document.getElementById('premiumChart');
        
        if (this.premiumChart) {
            this.premiumChart.destroy();
        }
        
        this.premiumChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Premium', 'Gratuit'],
                datasets: [{
                    data: [premium, free],
                    backgroundColor: [
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(108, 117, 125, 0.3)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    async loadUsers() {
        try {
            const token = localStorage.getItem('quizToken');
            
            const response = await fetch(`${API_URL}/api/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erreur chargement users');
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.displayUsers(data.users);
            } else {
                this.displayDemoUsers();
            }
            
        } catch (error) {
            console.error('Erreur loadUsers:', error);
            this.displayDemoUsers();
        }
    }

    displayUsers(users) {
        const tbody = document.getElementById('usersTable');
        
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Aucun utilisateur</td></tr>';
            return;
        }
        
        const html = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>
                    ${user.isPremium 
                        ? '<span class="badge bg-warning"><i class="fas fa-crown me-1"></i>Premium</span>' 
                        : '<span class="badge bg-secondary">Gratuit</span>'}
                </td>
                <td>${new Date(user.createdAt).toLocaleDateString('fr-FR')}</td>
            </tr>
        `).join('');
        
        tbody.innerHTML = html;
    }

    displayDemoUsers() {
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = `
            <tr>
                <td>Jean Dupont</td>
                <td>jean@example.com</td>
                <td><span class="badge bg-warning"><i class="fas fa-crown me-1"></i>Premium</span></td>
                <td>15/03/2024</td>
            </tr>
            <tr>
                <td>Marie Martin</td>
                <td>marie@example.com</td>
                <td><span class="badge bg-secondary">Gratuit</span></td>
                <td>10/03/2024</td>
            </tr>
        `;
    }

    async loadQuizList() {
        try {
            const token = localStorage.getItem('quizToken');
            
            const response = await fetch(`${API_URL}/api/quiz`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erreur chargement quiz');
            }
            
            const data = await response.json();
            
            if (data.success && data.quizzes) {
                this.populateQuizSelect(data.quizzes);
            }
            
        } catch (error) {
            console.error('Erreur loadQuizList:', error);
        }
    }

    populateQuizSelect(quizzes) {
        const select = document.getElementById('quizSelect');
        
        const options = quizzes.map(quiz => 
            `<option value="${quiz._id}">${quiz.title}</option>`
        ).join('');
        
        select.innerHTML = '<option value="">Sélectionner un quiz...</option>' + options;
    }

    setupEventListeners() {
        // Recherche utilisateurs
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchUsers(e.target.value);
            });
        }
        
        // Envoi notification quiz
        const sendQuizBtn = document.getElementById('sendQuizNotif');
        if (sendQuizBtn) {
            sendQuizBtn.addEventListener('click', () => {
                this.sendQuizNotification();
            });
        }
        
        // Envoi digest
        const sendDigestBtn = document.getElementById('sendDigest');
        if (sendDigestBtn) {
            sendDigestBtn.addEventListener('click', () => {
                this.sendWeeklyDigest();
            });
        }
    }

    searchUsers(query) {
        const rows = document.querySelectorAll('#usersTable tr');
        const searchLower = query.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchLower) ? '' : 'none';
        });
    }

    async sendQuizNotification() {
        const quizId = document.getElementById('quizSelect').value;
        
        if (!quizId) {
            alert('❌ Veuillez sélectionner un quiz');
            return;
        }
        
        try {
            const token = localStorage.getItem('quizToken');
            
            const response = await fetch(`${API_URL}/api/notifications/send-quiz-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ quizId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ Notification envoyée avec succès !');
            } else {
                alert('❌ Erreur : ' + data.message);
            }
            
        } catch (error) {
            console.error('Erreur sendQuizNotification:', error);
            alert('❌ Erreur lors de l\'envoi de la notification');
        }
    }

    async sendWeeklyDigest() {
        if (!confirm('Envoyer le digest hebdomadaire à tous les utilisateurs actifs ?')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('quizToken');
            
            const response = await fetch(`${API_URL}/api/notifications/send-weekly-digest`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert(`✅ Digest envoyé à ${data.sent || 0} utilisateurs !`);
            } else {
                alert('❌ Erreur : ' + data.message);
            }
            
        } catch (error) {
            console.error('Erreur sendWeeklyDigest:', error);
            alert('❌ Erreur lors de l\'envoi du digest');
        }
    }
}

// Initialiser
document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard();
});