const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest';
const DEFAULT_OPENROUTER_MODEL = 'qwen/qwen1.5-110b-chat';

function normalizeProvider(provider) {
    return (provider || '').trim().toLowerCase();
}

function getPreferredProvider() {
    if (process.env.MISTRAL_API_KEY) {
        return 'mistral';
    }

    const envProvider = normalizeProvider(process.env.LLM_PROVIDER);
    if (envProvider) {
        return envProvider;
    }

    return process.env.OPENROUTER_API_KEY ? 'openrouter' : 'mistral';
}

function getEnvLLMConfig(preferredProvider = getPreferredProvider()) {
    const provider = normalizeProvider(preferredProvider) || getPreferredProvider();

    if (provider === 'mistral') {
        const apiKey = process.env.MISTRAL_API_KEY;
        if (!apiKey) {
            return null;
        }

        return {
            provider: 'mistral',
            modelName: process.env.MISTRAL_MODEL || DEFAULT_MISTRAL_MODEL,
            apiKey
        };
    }

    if (provider === 'openrouter') {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return null;
        }

        return {
            provider: 'openrouter',
            modelName: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
            apiKey
        };
    }

    return null;
}

module.exports = {
    getPreferredProvider,
    getEnvLLMConfig,
    normalizeProvider
};