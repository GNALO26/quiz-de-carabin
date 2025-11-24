const axios = require('axios');
const crypto = require('crypto');

class KkiaPay {
  constructor() {
    this.publicKey = process.env.KKIAPAY_PUBLIC_KEY?.trim();
    this.privateKey = process.env.KKIAPAY_PRIVATE_KEY?.trim();
    this.secretKey = process.env.KKIAPAY_SECRET_KEY?.trim();
    this.mode = process.env.KKIAPAY_MODE || 'live';
    
    this.baseURL = 'https://api.kkiapay.me';
    
    console.log('🔧 Configuration KkiaPay - Mode:', this.mode);
  }

  async verifyTransaction(transactionId) {
    try {
      console.log(`🔍 Vérification transaction: ${transactionId}`);
      
      const response = await axios({
        method: 'GET',
        url: `${this.baseURL}/api/v1/transactions/status`,
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': this.publicKey
        },
        params: { transactionId },
        timeout: 10000
      });
      
      console.log('✅ Statut transaction:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur vérification:', error.response?.data || error.message);
      throw error;
    }
  }

  verifyWebhookSignature(payload, signature) {
    try {
      if (!signature) {
        console.warn('⚠  Signature manquante');
        return true;
      }

      const computedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      return computedSignature === signature;
    } catch (error) {
      console.error("❌ Erreur vérification signature:", error);
      return false;
    }
  }
}

module.exports = new KkiaPay();