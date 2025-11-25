// ✅ MIDDLEWARE DE MONITORING PRODUCTION

const productionMonitor = (req, res, next) => {
    const startTime = Date.now();
    
    // Log de la requête entrante
    console.log(`\n📥 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    
    if (req.method !== 'GET') {
        console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    }
    
    // Capturer la fin de la réponse
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - startTime;
        
        console.log(`📤 [${new Date().toISOString()}] ${res.statusCode} ${req.method} ${req.originalUrl} - ${duration}ms`);
        
        // Alertes pour requêtes lentes
        if (duration > 5000) {
            console.warn(`⚠  ALERTE: Requête lente détectée (${duration}ms) - ${req.method} ${req.originalUrl}`);
        }
        
        // Alertes pour erreurs 5xx
        if (res.statusCode >= 500) {
            console.error(`🚨 ERREUR SERVEUR: ${res.statusCode} - ${req.method} ${req.originalUrl}`);
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

module.exports = productionMonitor;