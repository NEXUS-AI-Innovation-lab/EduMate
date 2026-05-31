#!/usr/bin/env node
/**
 * Script pour créer/mettre à jour la configuration IA globale
 * Usage: node src/scripts/seedGlobalAIConfig.js
 */

const sequelize = require('../config/database');
const AIConfig = require('../models/AIConfig');
const { User } = require('../models/associations');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function seedGlobalAIConfig() {
  try {
    console.log('🔧 Initialisation de la configuration IA globale...\n');

    // Vérifier la connexion DB
    await sequelize.authenticate();
    console.log('✅ Connecté à la base de données\n');

    // Trouver l'admin
    const admin = await User.findOne({ where: { role: 'admin' } });
    if (!admin) {
      console.error('❌ Aucun utilisateur admin trouvé. Exécutez d\'abord le script initAdmin.');
      process.exit(1);
    }

    // Configuration par défaut - À PERSONNALISER
    const defaultConfig = {
      serviceName: 'global',
      modelName: process.env.DEFAULT_AI_MODEL || 'deepseek/deepseek-r1-0528:free',
      apiKey: process.env.DEFAULT_AI_API_KEY || 'VOTRE_CLE_API_ICI',
      provider: 'openrouter',
      isActive: true,
      notes: 'Configuration globale créée automatiquement',
      lastModifiedBy: admin.id
    };

    // Vérifier si une config existe déjà
    const existing = await AIConfig.findOne({ where: { serviceName: 'global' } });

    if (existing) {
      console.log('⚠️  Une configuration globale existe déjà:');
      console.log(`   - Modèle: ${existing.modelName}`);
      console.log(`   - Provider: ${existing.provider}`);
      console.log(`   - Active: ${existing.isActive ? 'Oui' : 'Non'}`);
      console.log(`   - Clé API: ${existing.apiKey.slice(0, 8)}...`);
      console.log('\n✅ Configuration existante conservée.\n');
      process.exit(0);
    }

    // Créer la nouvelle config
    const config = await AIConfig.create(defaultConfig);

    console.log('✅ Configuration IA globale créée avec succès!\n');
    console.log('📋 Détails:');
    console.log(`   - ID: ${config.id}`);
    console.log(`   - Service: ${config.serviceName}`);
    console.log(`   - Modèle: ${config.modelName}`);
    console.log(`   - Provider: ${config.provider}`);
    console.log(`   - Active: ${config.isActive ? 'Oui' : 'Non'}`);
    console.log(`   - Clé API: ${config.apiKey.slice(0, 8)}...`);
    console.log(`\n⚠️  IMPORTANT: Modifiez la clé API et le modèle dans la page Admin si nécessaire.\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la création de la configuration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  seedGlobalAIConfig();
}

module.exports = seedGlobalAIConfig;
