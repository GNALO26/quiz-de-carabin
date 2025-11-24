const transporter = require('../config/email');

// Fonction pour envoyer des emails avec code d'accès
const sendAccessCodeEmail = async (email, accessCode, userName = 'Utilisateur', durationMonths = 1) => {
  try {
    console.log(`[EMAIL] 🔄 Tentative d'envoi de code d'accès (${accessCode}) à: ${email}`);
    
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
    const formattedDate = expiryDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Votre code d\'accès Premium - 🩺 Quiz de Carabin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #13a718ff; color: white; padding: 20px; text-align: center;">
            <h1>Quiz de Carabin</h1>
          </div>
          
          <div style="padding: 20px;">
            <h2 style="color: #13a718ff;">Félicitations ${userName}!</h2>
            <p>Votre abonnement premium a été activé avec succès pour <strong>${durationMonths} mois</strong>.</p>
            <p><strong>Date d'expiration : ${formattedDate}</strong></p>
            
            <p>Voici votre code d'accès unique:</p>
            <div style="text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #1e53a2ff; background: #f8f9fa; padding: 15px; border-radius: 8px; display: inline-block;">
                ${accessCode}
              </span>
            </div>
            
            <p><strong>Vous pouvez utiliser ce code sur la page de validation si nécessaire. Votre compte Premium est maintenant actif.</strong></p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p>Merci pour votre confiance!</p>
              <p>L'équipe 🩺 Quiz de Carabin 🩺</p>
              <p><small>Si vous n'avez pas effectué cette demande, veuillez ignorer cet email.</small></p>
            </div>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] ✅ Code envoyé avec succès. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] ❌ ERREUR FATALE ENVOI DE CODE D'ACCÈS à ${email}:`, error);
    return false;
  }
};

module.exports = {
  sendAccessCodeEmail
};