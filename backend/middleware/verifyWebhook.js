const crypto = require('crypto');
const kkiapay = require('../config/kkiapay');

const verifyWebhook = (req, res, next) => {
    try {
        const signature = req.headers['x-kkiapay-signature'];
        const payload = JSON.stringify(req.body);
        
        if (!signature) {
            console.error('❌ Signature manquante dans le webhook');
            return res.status(400).send('Signature manquante');
        }

        const computedSignature = crypto
            .createHmac('sha256', kkiapay.secretKey)
            .update(payload)
            .digest('hex');

        if (computedSignature !== signature) {
            console.error('❌ Signature webhook invalide');
            return res.status(400).send('Signature invalide');
        }

        console.log('✅ Signature webhook vérifiée avec succès');
        next();
    } catch (error) {
        console.error('❌ Erreur vérification signature webhook:', error);
        res.status(500).send('Erreur de vérification');
    }
};

module.exports = verifyWebhook;