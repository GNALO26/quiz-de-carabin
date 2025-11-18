const axios = require('axios');

class KkiaPay {
  constructor() {
    this.publicKey = process.env.KKIAPAY_PUBLIC_KEY;
    this.privateKey = process.env.KKIAPAY_PRIVATE_KEY;
    this.secretKey = process.env.KKIAPAY_SECRET_KEY;
    this.mode = process.env.KKIAPAY_MODE || 'live';
    // Attention: L'URL de sandbox peut différer, mais pour le live c'est api.kkiapay.me
    this.baseURL = this.mode === 'test' 
      ? 'https://api-sandbox.kkiapay.me' 
      : 'https://api.kkiapay.me';
  }

  // Créer un paiement - CORRIGÉ
  async createPayment(paymentData) {
    try {
      console.log('💰 Création paiement KkiaPay...');

      // 1. CORRECTION DE L'URL
      // L'ancien endpoint '/api/v1/transactions/request' renvoie 404.
      // Le bon endpoint standard est '/api/v1/payments'.
      const url = `${this.baseURL}/api/v1/payments`;

      // 2. CONSTRUCTION DU PAYLOAD
      const payload = {
        amount: Math.round(paymentData.amount),
        reason: paymentData.description || `Abonnement ${paymentData.planId || 'Premium'}`,
        name: paymentData.name || 'Client Quiz', // Optionnel mais recommandé
        phone: paymentData.phone, // Optionnel
        email: paymentData.email, // Optionnel
        callback: paymentData.callback, // URL de redirection après paiement
        partnerId: paymentData.metadata?.user_id, // Utile pour le tracking
        metadata: paymentData.metadata // Vos données personnalisées (plan_id, user_id)
      };

      console.log('🌐 URL:', url);
      // console.log('📤 Payload:', JSON.stringify(payload, null, 2)); // Décommentez pour debug

      // 3. APPEL API AVEC LES BONS HEADERS
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // KkiaPay utilise souvent ces headers spécifiques en plus ou à la place du Bearer
          'x-api-key': this.publicKey,
          'x-private-key': this.privateKey,
          'x-secret-key': this.secretKey
        },
        timeout: 15000 // Augmentation du timeout à 15s
      });

      console.log('✅ Réponse KkiaPay:', response.status);
      
      // La réponse de KkiaPay sur cet endpoint contient généralement { url: "..." } ou { redirect_url: "..." }
      return response.data;

    } catch (error) {
      // Gestion détaillée des erreurs
      console.error('❌ Erreur KkiaPay createPayment:');
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('Message:', error.message);
      }
      throw error;
    }
  }

  // Vérifier le statut d'une transaction
  async verifyTransaction(transactionId) {
    try {
      const url = `${this.baseURL}/api/v1/transactions/verify`;
      console.log('🔍 Vérification transaction:', transactionId);

      const response = await axios.post(url, {
        transactionId: transactionId
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.publicKey,
          'x-private-key': this.privateKey,
          'x-secret-key': this.secretKey
        }
      });

      return response.data;
    } catch (error) {
      console.error('Erreur KkiaPay verifyTransaction:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new KkiaPay();