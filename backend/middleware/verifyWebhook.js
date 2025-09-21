// backend/middleware/verifyWebhook.js
const crypto = require('crypto');

const verifyPaydunyaSignature = (req, res, next) => {
  try {
    const signature = req.headers['paydunya-signature'];
    const secret = process.env.PAYDUNYA_MASTER_KEY;
    
    if (!signature) {
      console.error('Signature manquante dans les headers');
      return res.status(403).send('Signature manquante');
    }
    
    // Le corps brut (rawBody) est la source fiable pour la signature du webhook.
    const payload = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    if (computedSignature !== signature) {
      console.error('Signature invalide:', {
        computed: computedSignature,
        received: signature
      });
      return res.status(403).send('Signature invalide');
    }
    
    next();
  } catch (error) {
    console.error('Erreur lors de la vérification de signature:', error);
    res.status(500).send('Erreur de vérification de signature');
  }
};

module.exports = verifyPaydunyaSignature;