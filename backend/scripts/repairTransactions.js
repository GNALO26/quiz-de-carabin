// scripts/repairTransactions.js
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const Transaction = require('../models/Transaction');
const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const { sendAccessCodeEmail } = require('../controllers/paymentController');
const generateCode = require('../utils/generateCode');

async function repairTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Trouver les transactions complétées sans code d'accès
    const transactions = await Transaction.find({
      status: 'completed',
      $or: [
        { accessCode: { $exists: false } },
        { accessCode: null },
        { accessCode: '' }
      ]
    }).populate('userId');

    console.log(`Found ${transactions.length} transactions to repair`);

    for (const transaction of transactions) {
      try {
        // Générer un nouveau code d'accès
        const accessCode = generateCode();
        
        // Mettre à jour la transaction
        transaction.accessCode = accessCode;
        await transaction.save();
        
        console.log(`✅ Transaction ${transaction.transactionId} repaired with code: ${accessCode}`);
        
        // Créer un document AccessCode
        if (transaction.userId) {
          const accessCodeDoc = new AccessCode({
            code: accessCode,
            email: transaction.userId.email,
            userId: transaction.userId._id,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000)
          });
          
          await accessCodeDoc.save();
          console.log(`✅ AccessCode created for user ${transaction.userId.email}`);
          
          // Envoyer l'email
          const emailSent = await sendAccessCodeEmail(
            transaction.userId.email, 
            accessCode, 
            transaction.userId.name
          );
          
          if (emailSent) {
            console.log(`✅ Email sent to ${transaction.userId.email}`);
          } else {
            console.log(`❌ Failed to send email to ${transaction.userId.email}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error repairing transaction ${transaction.transactionId}:`, error);
      }
    }

    console.log('Repair process completed');
    process.exit(0);
  } catch (error) {
    console.error('Error in repair process:', error);
    process.exit(1);
  }
}

repairTransactions();