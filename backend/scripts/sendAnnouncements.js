const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
require('dotenv').config();

async function sendAnnouncementToAllUsers() {
  try {
    console.log('Connexion à la base de données...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Charger le modèle User
    const User = require('../models/User');
    const users = await User.find({});
    
    console.log(`Préparation de l'envoi à ${users.length} utilisateurs...`);
    
    // Configuration de l'email - CORRECTION: createTransport() au lieu de createTransporter()
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      subject: '🎉 Problèmes résolus - Quiz de Carabin est de retour!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c6eb5;">Bonjour cher utilisateur,</h2>
          
          <p>Nous avons le plaisir de vous informer que les problèmes techniques rencontrés récemment sur Quiz de Carabin ont été complètement résolus.</p>
          
          <p><strong>Votre compte est intact et accessible:</strong></p>
          <ul>
            <li>Tous vos données sont sauvegardées</li>
            <li>Vos historiques de quiz sont conservés</li>
            <li>Vos abonnements premium sont préservés</li>
          </ul>
          
          <p>Vous pouvez dès maintenant vous reconnecter à votre compte et profiter de toutes les fonctionnalités:</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://quiz-de-carabin.netlify.app" 
               style="background-color: #2c6eb5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
               Se connecter à Quiz de Carabin
            </a>
          </div>
          
          <p>En guise de compensation pour ces désagréments, nous vous offrons <strong>7 jours d'abonnement premium gratuit</strong> sur votre compte.</p>
          
          <p>Pour toute question ou difficulté, n'hésitez pas à nous contacter à l'adresse: ${process.env.EMAIL_USER}</p>
          
          <p>Cordialement,<br>L'équipe Quiz de Carabin</p>
        </div>
      `
    };
    
    let successCount = 0;
    let errorCount = 0;
    
    // Envoyer à chaque utilisateur
    for (const user of users) {
      try {
        mailOptions.to = user.email;
        await transporter.sendMail(mailOptions);
        console.log(`✓ Email envoyé à: ${user.email}`);
        successCount++;
        
        // Petite pause pour éviter de surcharger le service d'email
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`✗ Erreur pour ${user.email}:, error.message`);
        errorCount++;
      }
    }
    
    console.log(`\nRésumé de l'envoi:`);
    console.log(`- Emails envoyés avec succès: ${successCount}`);
    console.log(`- Erreurs d'envoi: ${errorCount}`);
    
    await mongoose.connection.close();
    console.log('\nOpération terminée!');
    
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'annonce:', error);
    process.exit(1);
  }
}

sendAnnouncementToAllUsers();