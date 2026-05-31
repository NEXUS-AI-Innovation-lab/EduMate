const express = require('express');
const router = express.Router();
const { getPreferredProvider } = require('../utils/llmConfig');

// IMPORT CORRIGÉ : "./" car dans le même dossier src
const chatbotService = require('../services/ChatbotService');

// Cache middleware pour les requêtes identiques
const requestCache = new Map();
const CACHE_TTL = 30000; // 30 secondes

router.post('/chat', async (req, res) => {
    try {
        const { message, history = [], context = '' } = req.body;
        
        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message requis'
            });
        }
        
        // Vérifier le cache rapide
        const cacheKey = `req:${message.substring(0, 30)}:${JSON.stringify(history.slice(-1))}`;
        const cached = requestCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            console.log(`⚡ Requête servie depuis le cache`);
            return res.json(cached.data);
        }
        
        const result = await chatbotService.chat(message, history, context);
        
        // Mettre en cache les réponses simples
        if (result.success && message.length < 60) {
            requestCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            // Nettoyer le cache périodiquement
            if (requestCache.size > 100) {
                const now = Date.now();
                for (const [key, value] of requestCache.entries()) {
                    if (now - value.timestamp > CACHE_TTL) {
                        requestCache.delete(key);
                    }
                }
            }
        }
        
        res.json({
            success: result.success,
            reply: result.reply,
            intent: result.intent,
            ragResults: result.ragResults,
            metadata: result.metadata,
            error: result.error || null
        });
    } catch (error) {
        console.error('❌ [Chat API] Erreur:', error.message);
        res.status(500).json({
            success: false,
            reply: "Une erreur s'est produite. Veuillez réessayer.",
            error: error.message
        });
    }
});

router.get('/chat/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Chatbot',
        provider: getPreferredProvider(),
        cacheSize: requestCache.size,
        timestamp: new Date().toISOString()
    });
});

// Endpoint pour vider le cache (débogage)
router.delete('/chat/cache', (req, res) => {
    requestCache.clear();
    res.json({ success: true, message: 'Cache vidé' });
});

module.exports = router;