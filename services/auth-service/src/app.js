const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sequelize = require('./config/database');
require('./models/associations');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const tutorRoutes = require('./routes/tutorRoutes');
const annonceRoutes = require('./routes/annonceRoutes');
const userRoutes = require('./routes/userRoutes');
const reviewRoutes = require('./routes/reviews');
const aiConfigRoutes = require('./routes/aiConfigRoutes');
const initializeAdmin = require('./scripts/initAdmin');
const initializeGlobalConfig = require('./scripts/initGlobalConfig');

const app = express();

// Configuration CORS améliorée
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',     
    'http://127.0.0.1:5173',     
    'http://localhost:5174',     
    'http://127.0.0.1:5174', 
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/annonces', annonceRoutes);
app.use('/api/ai-config', aiConfigRoutes);
app.use('/api', userRoutes);
app.use('/api/reviews', reviewRoutes);

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'EduMate API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Gestion des erreurs 404
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

// Middleware de gestion des erreurs
app.use((error, req, res, next) => {
  console.error('Erreur serveur:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Erreur interne du serveur' : error.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

const PORT = process.env.PORT || 3001;


// Utilisation d'une IIFE async pour permettre l'utilisation de await
(async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Base de données connectée avec succès');
    console.log('📋 Tables disponibles:');
    console.log('   - users');
    console.log('   - profile_tutors');
    console.log('   - profile_students');
    console.log('   - diplomas');
    console.log('   - experiences');
    console.log('   - annonces');
    console.log('   - reviews');
    console.log('   - ai_configs');

    // Initialiser le compte admin unique
    await initializeAdmin();

    // Initialiser la config IA globale si elle n'existe pas
    await initializeGlobalConfig();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
      console.log(`🌐 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('🔐 Compte Admin:');
      console.log('   📧 Email: admin@edumate.com');
      console.log('   🔑 Mot de passe: admin');
    });
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error);
    process.exit(1);
  }
})();
  
module.exports = app;
