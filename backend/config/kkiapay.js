const axios = require('axios');

class KkiaPay {
  constructor() {
    this.publicKey = process.env.KKIAPAY_PUBLIC_KEY;
    this.privateKey = process.env.KKIAPAY_PRIVATE_KEY;
    this.secretKey = process.env.KKIAPAY_SECRET_KEY;
    this.mode = process.env.KKIAPAY_MODE || 'live';
    this.baseURL = this.mode === 'test' 
      ? 'https://api-sandbox.kkiapay.me' 
      : 'https://api.kkiapay.me';
  }

  // Créer un paiement - VERSION CORRIGÉE
  async createPayment(paymentData) {
    try {
      console.log('💰 Création paiement KkiaPay avec données:', {
        amount: paymentData.amount,
        hasPhone: !!paymentData.phone,
        hasMetadata: !!paymentData.metadata,
        hasCallback: !!paymentData.callback
      });

      // Construction du payload selon la documentation KkiaPay
      const payload = {
        amount: Math.round(paymentData.amount),
        apikey: this.publicKey
      };

      // Ajouter le phone seulement si fourni
      if (paymentData.phone) {
        payload.phone = paymentData.phone;
      }

      // Ajouter le callback seulement si fourni
      if (paymentData.callback) {
        payload.callback = paymentData.callback;
      }

      // Ajouter les métadonnées
      if (paymentData.metadata) {
        payload.data = paymentData.metadata;
      }

      console.log('📤 Payload final KkiaPay:', JSON.stringify(payload, null, 2));

      const url = `${this.baseURL}/api/v1/transactions/request`;
      console.log('🌐 URL KkiaPay:', url);

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('✅ Réponse KkiaPay réussie:', response.data);
      return response.data;

    } catch (error) {
      console.error('❌ Erreur KkiaPay createPayment:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
      throw error;
    }
  }

  // Vérifier le statut d'une transaction
  async verifyTransaction(transactionId) {
    try {
      const url = `${this.baseURL}/api/v1/transactions/${transactionId}`;
      console.log('🔍 Vérification transaction:', url);

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
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
    const crypto = require('crypto');
    const computedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return computedSignature === signature;
  }
}

module.exports = new KkiaPay();