// services/message-service/app.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectMongoDB = require('./config/mongodb');
const messageRoutes = require('./routes/messageRoutes');
const authMiddleware = require('./middlewares/authMiddleware');
const fileRoutes = require('./routes/fileRoutes');
const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// Route publique pour accéder aux fichiers
app.use('/api/messages/file', fileRoutes);

// Middleware d'authentification pour toutes les routes
app.use(authMiddleware);

// Routes
app.use('/api/messages', messageRoutes);


// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Message Service',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    routes: [
      '/api/messages/conversations',
      '/api/messages/messages/send',
      '/api/messages/search/users',
      '/api/messages/stats'
    ]
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

// Gestion des erreurs
app.use((error, req, res, next) => {
  console.error('Erreur globale:', error);
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur de messagerie'
  });
});

const PORT = process.env.PORT || 3002;

// Démarrer le service
const startServer = async () => {
  try {
    // Connexion à MongoDB
    await connectMongoDB();
    
    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`🚀 Message Service démarré sur le port ${PORT}`);
      console.log('📊 Routes disponibles:');
      console.log('   - GET  /health');
      console.log('   - GET  /api/messages/conversations');
      console.log('   - POST /api/messages/conversations/start');
      console.log('   - GET  /api/messages/conversations/:id/messages');
      console.log('   - POST /api/messages/messages/send');
      console.log('   - GET  /api/messages/search/users');
      console.log('   - GET  /api/messages/stats');
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du Message Service:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;