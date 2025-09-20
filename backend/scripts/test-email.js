require('dotenv').config();
const transporter = require('../config/email');

console.log('Testing email configuration...');

transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Email configuration error:', error);
  } else {
    console.log('✅ Server is ready to take our messages');
    
    // Send a test email
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'Test Email Configuration - Quiz de Carabin',
      text: 'This is a test email to verify the email configuration.',
      html: '<p>This is a <b>test email</b> to verify the email configuration.</p>'
    }, (err, info) => {
      if (err) {
        console.error('❌ Error sending test email:', err);
      } else {
        console.log('✅ Test email sent successfully:', info.response);
      }
    });
  }
});