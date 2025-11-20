const crypto = require('crypto');
const kkiapay = require('../config/kkiapay');

const verifyWebhook = (req, res, next) => {
    try {
        console.log('🔐 Vérification signature webhook...');
        
        const signature = req.headers['x-kkiapay-signature'];
        
        if (!signature) {
            console.error('❌ Signature manquante dans les headers du webhook');
            return res.status(400).json({ 
                success: false, 
                message: 'Signature manquante',
                received_headers: Object.keys(req.headers)
            });
        }

        // Utiliser le body brut pour la signature
        const payload = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
        
        console.log('📨 Payload webhook reçu:', payload.substring(0, 500) + '...');
        console.log('🔑 Signature reçue:', signature);

        const computedSignature = crypto
            .createHmac('sha256', kkiapay.secretKey)
            .update(payload)
            .digest('hex');

        console.log('🔑 Signature calculée:', computedSignature);

        if (computedSignature !== signature) {
            console.error('❌ Signature webhook INVALIDE');
            console.error('   Reçue:', signature);
            console.error('   Calculée:', computedSignature);
            return res.status(401).json({ 
                success: false, 
                message: 'Signature invalide',
                debug: {
                    received: signature,
                    computed: computedSignature,
                    payload_length: payload.length
                }
            });
        }

        console.log('✅ Signature webhook VÉRIFIÉE avec succès');
        next();
    } catch (error) {
        console.error('❌ Erreur lors de la vérification de la signature:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur de vérification de signature',
            error: error.message 
        });
    }
};

module.exports = verifyWebhook;