const crypto = require('crypto');
const kkiapay = require('../config/kkiapay');

const verifyWebhook = (req, res, next) => {
    try {
        const signature = req.headers['x-kkiapay-signature'];
        const payload = JSON.stringify(req.body);
        
        console.log('\n=== 🔐 VÉRIFICATION SIGNATURE WEBHOOK ===');
        console.log('Signature présente:', !!signature);

        // ✅ MODE PRODUCTION: Vérification stricte de la signature
        if (!signature) {
            console.warn('⚠ Webhook sans signature - REJETÉ');
            return res.status(400).json({ 
                error: 'Signature manquante' 
            });
        }

        if (!kkiapay.secretKey) {
            console.error('❌ Secret key manquante');
            return res.status(500).json({ 
                error: 'Configuration serveur incomplète' 
            });
        }

        const computedSignature = crypto
            .createHmac('sha256', kkiapay.secretKey)
            .update(payload)
            .digest('hex');

        if (computedSignature !== signature) {
            console.error('❌ Signature invalide');
            console.log('🔍 Signature calculée:', computedSignature.substring(0, 10) + '...');
            console.log('🔍 Signature reçue:', signature.substring(0, 10) + '...');
            return res.status(400).json({ 
                error: 'Signature invalide' 
            });
        }

        console.log('✅ Signature vérifiée avec succès');
        next();
        
    } catch (error) {
        console.error('❌ Erreur vérification signature:', error.message);
        return res.status(500).json({ 
            error: 'Erreur vérification signature' 
        });
    }
};

module.exports = verifyWebhook;