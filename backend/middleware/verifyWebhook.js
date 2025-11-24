const crypto = require('crypto');
const kkiapay = require('../config/kkiapay');

const verifyWebhook = (req, res, next) => {
    try {
        const signature = req.headers['x-kkiapay-signature'];
        const payload = JSON.stringify(req.body);
        
        console.log('🔐 Webhook reçu - Signature présente:', !!signature);
        console.log('📦 Payload:', req.body);

        if (!signature) {
            console.warn('⚠  Webhook sans signature - Mode DEBUG activé');
            console.log('🔧 Mode production sans signature - Traitement quand même');
            next();
            return;
        }

        const computedSignature = crypto
            .createHmac('sha256', kkiapay.secretKey)
            .update(payload)
            .digest('hex');

        if (computedSignature !== signature) {
            console.error('❌ Signature webhook invalide');
            console.log('🔍 Signature calculée:', computedSignature);
            console.log('🔍 Signature reçue:', signature);
            return res.status(400).send('Signature invalide');
        }

        console.log('✅ Signature webhook vérifiée avec succès');
        next();
    } catch (error) {
        console.error('❌ Erreur vérification signature webhook:', error);
        console.log('⚠  Erreur signature, mais on continue le traitement...');
        next();
    }
};

module.exports = verifyWebhook;