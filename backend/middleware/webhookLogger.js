const webhookLogger = (req, res, next) => {
  if (req.path.includes('/webhook')) {
    console.log('\n=== 📨 WEBHOOK REÇU ===');
    console.log('🕒 Date:', new Date().toISOString());
    console.log('🔗 URL:', req.originalUrl);
    console.log('📧 Méthode:', req.method);
    console.log('📦 Headers:', req.headers);
    console.log('📊 Body:', JSON.stringify(req.body, null, 2));
    console.log('=== 🏁 FIN WEBHOOK ===\n');
  }
  next();
};

module.exports = webhookLogger;