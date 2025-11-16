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

  // Créer un paiement
  async createPayment(amount, phone, options = {}) {
    try {
      const payload = {
        amount: Math.round(amount), // KkiaPay attend le montant en entier
        phone: phone || undefined,
        apikey: this.publicKey,
        ...options
      };

      const response = await axios.post(`${this.baseURL}/api/v1/transactions/request, payload`, {
        headers: {
          'Authorization': Bearer `${this.secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Erreur KkiaPay createPayment:', error.response?.data || error.message);
      throw error;
    }
  }

  // Vérifier le statut d'une transaction
  async verifyTransaction(transactionId) {
    try {
      const response = await axios.get(`${this.baseURL}/api/v1/transactions/${transactionId}`, {
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