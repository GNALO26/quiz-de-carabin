// Configuration centrale de l'application
export const CONFIG = {
    // URL principale
    API_BASE_URL: "https://quiz-de-carabin-backend.onrender.com",
    
    // URL de secours (pour développement)
    API_BACKUP_URL: "http://localhost:5000",
    
    FRONTEND_URL: "https://quiz-de-carabin.netlify.app",
    
    // Méthode pour obtenir l'URL active
    getAPIBaseURL: function() {
        // Teste la connexion à l'URL principale
        return testConnection(this.API_BASE_URL) 
            ? this.API_BASE_URL 
            : this.API_BACKUP_URL;
    }
};

// Fonction pour tester la connexion
async function testConnection(url) {
    try {
        const response = await fetch(`${url}/api/health`, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });
        return response.ok;
    } catch (error) {
        console.error(`Connection test failed for ${url}:`, error);
        return false;
    }
}