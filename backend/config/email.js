// Configuration globale de l'application
export const CONFIG = {
  // URLs de l'API
  API_BASE_URL: 'https://quiz-de-carabin-backend.onrender.com',
  API_BACKUP_URL: 'https://quiz-de-carabin-backend.onrender.com',
  
  // URLs du frontend
  FRONTEND_URL: 'https://quiz-de-carabin.netlify.app',
  
  // Configuration des plans
  PRICING_PLANS: {
    '1-month': {
      id: '1-month',
      name: '1 Mois',
      price: 5000,
      duration: 1,
      description: 'Accès premium pendant 1 mois',
      features: ['Quiz illimités', 'Statistiques détaillées', 'Support prioritaire']
    },
    '3-months': {
      id: '3-months', 
      name: '3 Mois',
      price: 12000,
      duration: 3,
      description: 'Accès premium pendant 3 mois',
      features: ['Économisez 20%', 'Quiz illimités', 'Statistiques détaillées', 'Support prioritaire']
    },
    '10-months': {
      id: '10-months',
      name: '10 Mois', 
      price: 25000,
      duration: 10,
      description: 'Accès premium pendant 10 mois',
      features: ['Économisez 50%', 'Quiz illimités', 'Statistiques détaillées', 'Support prioritaire', 'Accès anticipé']
    }
  },
  
  // Configuration KkiaPay
  KKIAPAY: {
    publicKey: '2c79c85d47f4603c5c9acc9f9ca7b8e32d65c751',
    theme: '#13a718',
    callbackUrl: 'https://quiz-de-carabin.netlify.app/payment-callback.html'
  },
  
  // Paramètres de l'application
  APP: {
    name: 'Quiz de Carabin',
    version: '1.0.0',
    description: 'Plateforme de quiz médicaux pour étudiants en médecine',
    contactEmail: 'quizdecarabin4@gmail.com'
  },
  
  // Paramètres de timeout
  TIMEOUTS: {
    apiCall: 15000,
    paymentRedirect: 2000,
    emailResend: 30000
  }
};

// Fonction utilitaire pour obtenir l'URL active de l'API
export const getActiveApiUrl = async () => {
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
    console.warn('🌐 URL principale inaccessible:', error.message);
  }
  
  console.log('🔄 Utilisation de l\'URL de backup');
  return CONFIG.API_BACKUP_URL;
};

// Fonction pour formater les prix
export const formatPrice = (price) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF'
  }).format(price);
};

// Fonction pour formater les dates
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Export global pour compatibilité
window.APP_CONFIG = CONFIG;