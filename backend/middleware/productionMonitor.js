// Surveillance en production
const productionMonitor = (req, res, next) => {
  // Logger les requêtes importantes
  if (req.path.includes('/payment') || req.path.includes('/webhook')) {
    console.log(`[LIVE] ${new Date().toISOString()} - ${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body // Ne pas logger les données sensibles en prod
    });
  }
  
  // Surveiller la santé de l'application
  if (req.path === '/api/health') {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      paydunya: 'live'
    };
    
    // Ajouter les infos de santé à la réponse
    req.healthData = health;
  }
  
  next();
};

module.exports = productionMonitor;