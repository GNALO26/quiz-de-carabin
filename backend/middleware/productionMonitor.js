// Middleware de monitoring pour la production
const productionMonitor = (req, res, next) => {
    const start = Date.now();
    
    // Log des requêtes importantes
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 400 ? 'WARN' : 'INFO';
        
        if (req.path.includes('/api/') && !req.path.includes('/health')) {
            console.log(`[${logLevel}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - IP: ${req.ip}`);
        }
        
        // Alertes pour les erreurs serveur
        if (res.statusCode >= 500) {
            console.error(`🚨 ERREUR SERVEUR: ${req.method} ${req.originalUrl} - ${res.statusCode}`);
        }
    });
    
    next();
};

module.exports = productionMonitor;