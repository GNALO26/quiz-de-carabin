require('dotenv').config();
const nodemailer = require('nodemailer');
const generateCode = require('../utils/generateCode');

console.log('=== TEST EMAIL FORMAT PRODUCTION ===');

const testEmail = async () => {
  const accessCode = generateCode();
  
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: {
      name: 'Quiz de Carabin',
      address: process.env.EMAIL_USER
    },
    to: 'alfredsossa17@gmail.com',
    subject: 'TEST: Votre code d\'accès Premium - Quiz de Carabin',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Félicitations !</h2>
        <p>Votre abonnement premium a été activé avec succès.</p>
        <p>Voici votre code d'accès unique :</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #4CAF50; background: #f8f9fa; padding: 10px 20px; border-radius: 5px; display: inline-block;">
            ${accessCode}
          </span>
        </div>
        <p><strong>Ce code expire dans 30 minutes.</strong> Utilisez-le sur la page de validation pour activer votre compte premium.</p>
        <p>Référence de transaction: <strong>TXN_TEST_123456</strong></p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #6c757d; font-size: 14px;">
            Si vous n'avez pas effectué cet achat, veuillez contacter immédiatement notre support à
            <a href="mailto:support@quizdecarabin.bj" style="color: #4CAF50;">support@quizdecarabin.bj</a>
          </p>
        </div>
        <br>
        <p style="color: #6c757d; font-size: 14px; text-align: center;">
          L'équipe Quiz de Carabin<br>
          <a href="https://quizdecarabin.bj" style="color: #4CAF50;">https://quizdecarabin.bj</a>
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email de test envoyé avec succès');
    console.log('Message ID:', info.messageId);
    console.log('Code d\'accès:', accessCode);
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
  }
};

testEmail();