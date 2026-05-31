const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { getEnvLLMConfig, getPreferredProvider } = require('./llmConfig');

class AIConfigManager {
    constructor() {
        // Plus besoin d'auth service URL, on charge depuis .env
    }

    async getConfig(serviceName = 'global') {
        try {
            const envConfig = getEnvLLMConfig(getPreferredProvider());
            if (envConfig) {
                console.log(`[AIConfigManager] Config chargée depuis l'environnement: ${envConfig.modelName} | Provider: ${envConfig.provider}`);
                return {
                    modelName: envConfig.modelName,
                    apiKey: envConfig.apiKey,
                    provider: envConfig.provider,
                    isActive: true,
                    source: 'env'
                };
            }

            // Charge la config IA depuis Auth Service (DB)
            const apiUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
            const res = await axios.get(`${apiUrl}/api/ai-config/public/global`, { timeout: 3000 });
            const data = res.data?.data;
            if (!data || !data.apiKey || !data.modelName) {
                throw new Error('Configuration IA globale manquante ou incomplète');
            }
            console.log(`[AIConfigManager] Config DB chargée: ${data.modelName} | ${data.apiKey.slice(0, 10)}... | Provider: ${data.provider}`);
            return {
                modelName: data.modelName,
                apiKey: data.apiKey,
                provider: data.provider,
                isActive: data.isActive
            };
        } catch (error) {
            console.error(`[AIConfigManager] Erreur récupération config DB:`, error.message);
            throw new Error(`Configuration IA manquante: ${error.message}`);
        }
    }

    clearCache() {
        // Plus de cache nécessaire, on charge directement depuis la DB
        console.log(`[AIConfigManager] Rien à vider (config depuis DB)`);
    }
}

module.exports = AIConfigManager;