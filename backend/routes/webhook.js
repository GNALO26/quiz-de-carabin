const express = require('express');
const kkiapay = require('../config/kkiapay');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const { sendAccessCodeEmail } = require('../controllers/paymentController');
const router = express.Router();

// Fonction utilitaire pour ajouter des mois
const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

// Webhook KkiaPay
router.post('/kkiapay', express.json(), async (req, res) => {
  try {
    console.log('🔔 Webhook KkiaPay reçu:', req.body);

    const { data, type } = req.body;
    
    // Vérifier la signature (optionnel mais recommandé)
    const signature = req.headers['x-kkiapay-signature'];
    if (signature && !kkiapay.verifyWebhookSignature(req.body, signature)) {
      console.error('Signature webhook invalide');
      return res.status(401).json({ error: 'Signature invalide' });
    }

    if (type === 'transaction.success') {
      const { transaction_id, amount, metadata } = data;
      
      // Récupérer l'ID de transaction depuis les métadonnées
      const customTransactionId = metadata?.transactionId || metadata?.custom_data?.transaction_id;
      
      if (!customTransactionId) {
        console.error('Transaction ID manquant dans les métadonnées');
        return res.status(400).json({ error: 'Transaction ID manquant' });
      }

      // Trouver la transaction
      const transaction = await Transaction.findOne({ 
        transactionId: customTransactionId 
      });

      if (!transaction) {
        console.error('Transaction non trouvée:', customTransactionId);
        return res.status(404).json({ error: 'Transaction non trouvée' });
      }

      if (transaction.status === 'completed') {
        console.log('Transaction déjà traitée');
        return res.status(200).json({ success: true, message: 'Déjà traité' });
      }

      // Mettre à jour la transaction
      transaction.status = 'completed';
      transaction.kkiapayTransactionId = transaction_id;
      
      const accessCode = generateCode();
      transaction.accessCode = accessCode;

      const user = await User.findById(transaction.userId);
      
      if (user) {
        // Créer le code d'accès
        const newAccessCode = new AccessCode({
          code: accessCode,
          email: user.email,
          userId: user._id,
          expiresAt: addMonths(Date.now(), transaction.durationInMonths)
        });
        await newAccessCode.save();

        // Mettre à jour le statut premium
        let expiresAt = user.premiumExpiresAt && user.premiumExpiresAt > new Date()
          ? user.premiumExpiresAt
          : new Date();
          
        user.isPremium = true;
        user.premiumExpiresAt = addMonths(expiresAt, transaction.durationInMonths);
        await user.save();

        // Envoyer l'email
        await sendAccessCodeEmail(user.email, accessCode, user.name);
        
        console.log(`✅ Abonnement activé pour ${user.email}`);
      }

      await transaction.save();
      
      console.log(`✅ Transaction ${customTransactionId} complétée`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Erreur webhook KkiaPay:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Fonction pour générer un code (à adapter selon votre utils/generateCode)
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = router;