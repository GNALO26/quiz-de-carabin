// middleware/webhookLogger.js
const webhookLogger = (req, res, next) => {
  if (req.path.includes('/payment/callback')) {
    console.log('=== WEBHOOK REÇU ===');
    console.log('Date:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Raw Body:', req.rawBody ? req.rawBody.toString() : 'No raw body');
    console.log('================================');
  }
  next();
};

module.exports = webhookLogger;