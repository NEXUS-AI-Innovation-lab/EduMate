const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { sequelize } = require('../models/associations');
const annonceService = require('../services/annonceService');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie');

    console.log('🚀 Lancement de la migration des embeddings...');
    
    const result = await annonceService.migrateExistingAnnoncesToEmbeddings();
    
    console.log('✅ Migration terminée:', result);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    process.exit(1);
  }
}

migrate();