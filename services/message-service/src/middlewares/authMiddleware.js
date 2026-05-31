// middlewares/authMiddleware.js
const axios = require('axios');

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token manquant' });
  }

  try {
    const response = await axios.get(`${process.env.AUTH_SERVICE_URL || 'http://auth-service:3001'}/api/auth/check`, {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true
    });

    if (!response.data.success) {
      console.error('[Message-Service] Token invalide →', response.data.message);

      await axios.post(
        `${process.env.AUTH_SERVICE_URL || 'http://auth-service:3001'}/api/auth/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch(() => {});

      return res.status(401).json({ success: false, message: 'Token invalide, vous avez été déconnecté' });
    }

    req.user = response.data.data; // injecte l’utilisateur renvoyé par le auth-service
    next();

  } catch (error) {
    console.error('[Message-Service] Erreur lors de la vérification du token :', error.message);
    return res.status(500).json({ success: false, message: 'Erreur interne lors de la vérification du token' });
  }
}

module.exports = authMiddleware;
