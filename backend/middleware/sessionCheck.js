const Session = require('../models/Session');

const sessionCheck = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }
    
    // Vérifier si la session est toujours active
    const activeSession = await Session.findOne({
      userId: req.user._id,
      sessionId: req.user.activeSessionId,
      isActive: true
    });
    
    if (!activeSession) {
      return res.status(401).json({
        success: false,
        message: 'Session expirée ou invalide. Veuillez vous reconnecter.',
        code: 'SESSION_EXPIRED'
      });
    }
    
    // Mettre à jour lastActive
    activeSession.lastActive = new Date();
    await activeSession.save();
    
    next();
  } catch (error) {
    console.error('Erreur sessionCheck:', error);
    next();
  }
};

module.exports = sessionCheck;