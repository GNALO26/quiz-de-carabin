const axios = require('axios');
const crypto = require('crypto');

class KkiaPay {
  constructor() {
    // ✅ CORRECTION: Utilisation de .trim() pour supprimer les espaces ou sauts de ligne invisibles
    this.publicKey = process.env.KKIAPAY_PUBLIC_KEY ? process.env.KKIAPAY_PUBLIC_KEY.trim() : null;
    this.privateKey = process.env.KKIAPAY_PRIVATE_KEY ? process.env.KKIAPAY_PRIVATE_KEY.trim() : null;
    this.secretKey = process.env.KKIAPAY_SECRET_KEY ? process.env.KKIAPAY_SECRET_KEY.trim() : null;
    
    this.mode = process.env.KKIAPAY_MODE || 'live';
    this.baseURL = this.mode === 'test' 
      ? 'https://api-sandbox.kkiapay.me' 
      : 'https://api.kkiapay.me';
  }

  // Créer un paiement - CORRIGÉ
  async createPayment(paymentData) {
    try {
      console.log('💰 Création paiement KkiaPay...');

      const url = `${this.baseURL}/api/v1/payments`;

      const payload = {
        amount: Math.round(paymentData.amount),
        reason: paymentData.description || `Abonnement ${paymentData.planId || 'Premium'}`,
        name: paymentData.name || 'Client Quiz',
        phone: paymentData.phone,
        email: paymentData.email,
        callback: paymentData.callback,
        partnerId: paymentData.metadata?.user_id,
        metadata: paymentData.metadata
      };

      console.log('🌐 URL:', url);

      // APPEL API AVEC LES BONS HEADERS (maintenant nettoyés)
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-api-key': this.publicKey,
          'x-private-key': this.privateKey,
          'x-secret-key': this.secretKey
        },
        timeout: 15000
      });

      console.log('✅ Réponse KkiaPay réussie. Statut:', response.status);
      return response.data;

    } catch (error) {
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

  // Valider une signature webhook
  verifyWebhookSignature(payload, signature) {
    try {
        const computedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(JSON.stringify(payload))
        .digest('hex');
        
        return computedSignature === signature;
    } catch(e) {
        console.error("Erreur de vérification de signature:", e);
        return false;
    }
  }
}

module.exports = new KkiaPay();