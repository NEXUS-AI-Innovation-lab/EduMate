const axios = require('axios');
const NodeCache = require('node-cache');
const AIConfigManager = require('../utils/AIConfigManager');
const { getPreferredProvider, normalizeProvider } = require('../utils/llmConfig');

class ChatbotService {
    constructor() {
        // Pas de valeurs par défaut - tout vient de la DB
        this.apiProvider = null;
        this.model = null;
        this.apiKey = null;
        this.embedModel = 'nomic-embed-text';
        this.ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:3005';
        this.cache = new NodeCache({ stdTTL: 3600 });
        this.configManager = new AIConfigManager();
    }

    /**
     * Charge la configuration depuis la base de données
     */
    async ensureConfig() {
        try {
            // Récupérer UNIQUEMENT depuis la base de données (Auth Service via configManager)
            const cfg = await this.configManager.getConfig('global');
            if (!cfg) {
                throw new Error('Configuration IA globale manquante');
            }
            this.apiProvider = normalizeProvider(cfg.provider) || getPreferredProvider();
            this.model = cfg.modelName;
            this.apiKey = cfg.apiKey;
            console.log(`✅ [Chatbot] Config chargée: ${this.model} | ${this.apiKey.slice(0, 8)}... | Provider: ${this.apiProvider}`);
        } catch (error) {
            console.error('❌ [Chatbot] Erreur chargement config:', error.message);
            throw new Error(`Configuration IA globale manquante: Veuillez configurer l'IA dans la page Admin`);
        }
    }

    /**
     * Traite un message du chat
     */
    async chat(message, history = [], context = '') {
        try {
            // ensureConfig va échouer si pas de config DB
            await this.ensureConfig();
            const startTime = Date.now();

            const chatCacheKey = `chat:${this.apiProvider}:${this.model}:${message.substring(0, 200)}:${context.substring(0, 200)}`;
            const cachedReply = this.cache.get(chatCacheKey);
            if (cachedReply) {
                return {
                    success: true,
                    reply: cachedReply,
                    intent: 'cached',
                    ragResults: null,
                    metadata: {
                        provider: this.apiProvider,
                        model: this.model,
                        responseTime: `${Date.now() - startTime}ms`,
                        timestamp: new Date().toISOString(),
                        cached: true
                    }
                };
            }

            const intent = await this.detectIntent(message);
            console.log(`🎯 Intent détecté: ${intent.type} (${Date.now() - startTime}ms)`);

            
            let ragResults = null;
            if (intent.shouldSearchRag) {
                const expandedQuery = await this.expandQueryWithAI(message);
                console.log(`🧠 Requete etendue: ${expandedQuery}`);
                ragResults = await this.performRagSearch(expandedQuery, intent, { useRawQuery: true, originalQuery: message });
                console.log(`📚 RAG Results: ${ragResults?.found ? ragResults.count + ' résultats' : 'Aucun résultat'} (${Date.now() - startTime}ms)`);
            }
            
            const response = await this.generateResponse(message, history, context, ragResults, intent);
            
            this.cache.set(chatCacheKey, response, 300);

            const totalTime = Date.now() - startTime;
            console.log(`✅ Réponse générée en ${totalTime}ms total`);
            
            return {
                success: true,
                reply: response,
                intent: intent.type,
                ragResults: ragResults,
                metadata: {
                    provider: this.apiProvider,
                    model: this.model,
                    responseTime: `${totalTime}ms`,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('❌ [ChatbotService] Erreur:', error.message);
            return {
                success: false,
                reply: "⚠️ Service IA non configuré. Veuillez contacter l'administrateur pour configurer l'IA dans la page Admin.",
                error: error.message,
                requiresConfig: true
            };
        }
    }

    /**
     * Génère la réponse
     */
    async generateResponse(message, history, context, ragResults, intent) {
        if (!intent.shouldSearchRag || !ragResults?.found) {
            const systemPrompt = this.buildSystemPrompt(context, ragResults, intent);
            return await this.callOpenRouter(message, history, systemPrompt);
        }

        // Réponse hybride : intro/conclusion IA, listing structuré (cartes)
        const tutors = ragResults.tutors;
        let tutorsSummary = tutors.map((tutor, idx) => {
            return `Tuteur ${idx+1} :\nNom : ${tutor.name}\nMatière : ${tutor.subject}\nCompétences : ${(tutor.skills||[]).join(', ')}\nNiveau : ${tutor.level}\nTarif : ${tutor.price}\nLieu : ${tutor.location}\nMode : ${tutor.teachingMode}`;
        }).join("\n---\n");

        // On demande à l'IA une phrase d'intro et de conclusion personnalisée
        const systemPrompt = [
            "Tu es l'assistant IA d'EduMate, une plateforme de mise en relation élèves/tuteurs.",
            "Voici un résumé des profils trouvés :",
            tutorsSummary,
            "Génère uniquement :\n- Une phrase d'introduction personnalisée pour l'utilisateur (1-2 phrases max)\n- Une phrase de conclusion ou de conseil (1-2 phrases max)\nN'inclus pas de listing, pas de détails, pas de répétition des profils. Le listing sera ajouté par le système."
        ].join("\n\n");

        const iaReply = await this.callOpenRouter(message, history, systemPrompt);

        // Listing structuré (cartes)
        let response = '';
        if (iaReply) {
            response += iaReply + "\n\n";
        }
        response += `🎯 __${tutors.length} tuteur${tutors.length > 1 ? 's' : ''} trouvé${tutors.length > 1 ? 's' : ''}__ pour "${message}"\n\n`;
        tutors.forEach((tutor, index) => {
            response += this.formatSingleTutorCard(tutor, index + 1);
            if (index < tutors.length - 1) {
                response += "\n" + "─".repeat(40) + "\n\n";
            }
        });
        response += "\n📋 Prochaines étapes :\n";
        response += "• 📅 Réserver une séance d'essai\n";
        response += "• 💬 Contacter directement via le chat\n";
        response += "• 🔄 Élargir la recherche avec d'autres critères\n\n";
        response += "Dites-moi sur quel tuteur vous souhaitez plus d'informations !";
        return response;
    }

    /**
     * Formate les cartes de tuteurs
     */
    formatTutorCards(ragResults, originalMessage) {
        const tutors = ragResults.tutors;
        
        if (tutors.length === 0) {
            return "Je n'ai trouvé aucun tuteur correspondant à votre recherche. Essayez d'élargir vos critères !";
        }
        
        let response = `🎯 __${tutors.length} tuteur${tutors.length > 1 ? 's' : ''} trouvé${tutors.length > 1 ? 's' : ''}__ pour "${originalMessage}"\n\n`;
        
        tutors.forEach((tutor, index) => {
            response += this.formatSingleTutorCard(tutor, index + 1);
            
            if (index < tutors.length - 1) {
                response += "\n" + "─".repeat(40) + "\n\n";
            }
        });
        
        response += "\n📋 Prochaines étapes :\n";
        response += "• 👉 Voir le profil complet (expérience, disponibilités, avis)\n";
        response += "• 📅 Réserver une séance d'essai\n";
        response += "• 💬 Contacter directement via le chat\n";
        response += "• 🔄 Élargir la recherche avec d'autres critères\n\n";
        
        response += "Dites-moi sur quel tuteur vous souhaitez plus d'informations !";
        
        return response;
    }

    /**
     * Formate une carte de tuteur
     */
    formatSingleTutorCard(tutor, number) {
        const tutorId = tutor.tutorId ? String(tutor.tutorId) : '';
        const annonceId = tutor.annonceId ? String(tutor.annonceId) : '';

        let card = `${number}. __${tutor.name}__\n`;

        if (tutor.rating) {
            const stars = '⭐'.repeat(Math.round(tutor.rating));
            card += `Évaluation : ${stars} (${tutor.rating}/5)\n`;
        } else {
            card += `Nouveau tuteur\n`;
        }

        if (tutor.skills && tutor.skills.length > 0) {
            const skillsToShow = tutor.skills.slice(0, 5);
            card += `Compétences : ${skillsToShow.join(', ')}`;
            if (tutor.skills.length > 5) {
                card += ` et ${tutor.skills.length - 5} autres`;
            }
            card += `\n`;
        }

        card += `Matière : ${tutor.subject}\n`;
        if (tutor.level && tutor.level !== 'Non spécifié') {
            card += `Niveau : ${tutor.level}\n`;
        }
        // Remplacement strict de toute mention euro/€/EUR par 🪙
        let price = tutor.price || '';
        price = price.replace(/(\d+)\s*(€|euros|eur)/gi, '$1🪙');
        price = price.replace(/€/g, '🪙');
        price = price.replace(/euros?/gi, '🪙');
        price = price.replace(/eur/gi, '🪙');
        // Si le prix finit par /h, on garde, sinon on ajoute
        if (!/🪙\s*\/h/i.test(price) && /🪙/.test(price)) {
            price = price.replace(/🪙$/, '🪙/h');
        }
        card += `Tarif : ${price}\n`;

        if (tutor.location && tutor.location !== 'Non spécifié') {
            card += `📍 ${tutor.location}\n`;
        }

        if (tutor.teachingMode) {
            card += `Mode : ${tutor.teachingMode}\n`;
        }

        if (tutor.rating >= 4.5) {
            card += `🏆 Tuteur expert\n`;
        } else if (tutor.reviews && tutor.reviews > 10) {
            card += `🔥 Populaire (${tutor.reviews} avis)\n`;
        }

        // Lien unique, jamais de doublon, même si IDs vides ou dupliqués
        if (card.indexOf('|tuteur|') === -1 && (tutorId || annonceId)) {
            card += `\n👉 Voir le profil complet |tuteur|${tutorId}|${annonceId}|`;
        } else if (card.indexOf('|tuteur|') === -1) {
            card += `\n👉 Voir le profil complet`;
        }

        return card;
    }

    /**
     * Détecte l'intention du message
     */
    async detectIntent(message) {
        const lowerMsg = message.toLowerCase();
        
        const intents = {
            search_tutors: {
                keywords: ['tuteur', 'professeur', 'cherche un', 'trouver un', 'besoin d\'un', 'aide en', 'cours de', 'soutien', 'enseignant', 'apprendre', 'étudier'],
                shouldSearchRag: true
            },
            search_courses: {
                keywords: ['cours', 'leçon', 'séance', 'classe', 'formation', 'apprentissage'],
                shouldSearchRag: true
            },
            pricing_info: {
                keywords: ['prix', 'tarif', 'coût', 'combien', 'educoin', '€', 'euros', 'budget'],
                shouldSearchRag: false
            },
            how_it_works: {
                keywords: ['comment', 'fonctionn', 'étapes', 'processus', 'marche', 'utiliser', 'débuter'],
                shouldSearchRag: false
            },
            general_question: {
                keywords: [],
                shouldSearchRag: false
            }
        };
        
        for (const [intentType, config] of Object.entries(intents)) {
            if (config.keywords.some(keyword => lowerMsg.includes(keyword))) {
                return {
                    type: intentType,
                    keyword: message,
                    shouldSearchRag: config.shouldSearchRag
                };
            }
        }
        
        return {
            type: 'general_question',
            keyword: message,
            shouldSearchRag: false
        };
    }

    /**
     * Effectue une recherche RAG
     */
    async performRagSearch(message, intent, options = {}) {
        try {
            console.log(`🔍 Appel RAG Service: ${this.ragServiceUrl}`);


            const originalQuery = options.originalQuery || message;
            const { subject, level, priceRange, location } = this.extractSearchParams(originalQuery);

            // Recherche avec tous les critères
            const params = {
                q: options.useRawQuery ? message : (subject || message),
                limit: 5 // Augmente le nombre pour proposer plus de choix
            };
            if (level) params.level = level;
            if (priceRange?.max) params.maxPrice = priceRange.max;
            if (location) params.location = location;

            console.log(`🔍 Paramètres RAG:`, params);

            const ragCacheKey = `rag:${params.q}:${params.level || ''}:${params.maxPrice || ''}:${params.location || ''}`;
            const cachedRag = this.cache.get(ragCacheKey);
            if (cachedRag) {
                return cachedRag;
            }

            const response = await axios.get(
                `${this.ragServiceUrl}/search/semantic`,
                {
                    params: params,
                    timeout: 1500
                }
            );

            console.log(`📊 Réponse RAG reçue:`, {
                success: response.data?.success,
                total: response.data?.data?.total,
                resultsCount: response.data?.data?.results?.length
            });

            let tutors = [];
            if (response.data?.success && response.data?.data?.results?.length > 0) {
                const results = response.data.data.results;
                tutors = results.map(t => {
                    const skills = Array.isArray(t.subjects) ? t.subjects :
                        t.subjects ? [t.subjects] :
                        t.description ? this.extractSkillsFromText(t.description) : [];
                    // Nettoyage du champ price pour forcer 🪙/h
                    let price = '';
                    if (t.hourlyRate) {
                        price = String(t.hourlyRate);
                    } else if (t.price) {
                        price = String(t.price);
                    }
                    if (price) {
                        price = price.replace(/(\d+)\s*(€|euros|eur)/gi, '$1🪙');
                        price = price.replace(/€/g, '🪙');
                        price = price.replace(/euros?/gi, '🪙');
                        price = price.replace(/eur/gi, '🪙');
                        if (!/🪙\s*\/h/i.test(price) && /🪙/.test(price)) {
                            price = price.replace(/🪙$/, '🪙/h');
                        }
                        if (!/🪙/.test(price)) {
                            price = price + '🪙/h';
                        }
                    } else {
                        price = 'Sur devis';
                    }
                    return {
                        id: t.annonceId || t.tutorId,
                        name: t.tutorName || 'Tuteur EduMate',
                        subject: this.formatSubject(t.subjects || t.title || 'Cours'),
                        skills: skills,
                        rating: t.tutorRating || 0,
                        reviews: t.reviewsCount || Math.floor(Math.random() * 20) + 1,
                        price: price,
                        level: t.level || 'Tous niveaux',
                        location: this.formatLocation(t.location),
                        teachingMode: this.formatTeachingMode(t.teachingMode),
                        description: t.description || '',
                        tutorId: t.tutorId,
                        annonceId: t.annonceId
                    };
                });
            }

            // Si aucun tuteur exact, relancer une recherche élargie (sans niveau, sans ville, sans prix)
            if (tutors.length === 0 && (level || location || priceRange)) {
                console.log('🔄 Aucun tuteur exact, élargissement de la recherche...');
                const paramsWide = {
                    q: subject || message,
                    limit: 5
                };
                const responseWide = await axios.get(
                    `${this.ragServiceUrl}/search/semantic`,
                    {
                        params: paramsWide,
                        timeout: 1500
                    }
                );
                if (responseWide.data?.success && responseWide.data?.data?.results?.length > 0) {
                    tutors = responseWide.data.data.results.map(t => {
                        const skills = Array.isArray(t.subjects) ? t.subjects :
                            t.subjects ? [t.subjects] :
                            t.description ? this.extractSkillsFromText(t.description) : [];
                        // Nettoyage du champ price pour forcer 🪙/h
                        let price = '';
                        if (t.hourlyRate) {
                            price = String(t.hourlyRate);
                        } else if (t.price) {
                            price = String(t.price);
                        }
                        if (price) {
                            price = price.replace(/(\d+)\s*(€|euros|eur)/gi, '$1🪙');
                            price = price.replace(/€/g, '🪙');
                            price = price.replace(/euros?/gi, '🪙');
                            price = price.replace(/eur/gi, '🪙');
                            if (!/🪙\s*\/h/i.test(price) && /🪙/.test(price)) {
                                price = price.replace(/🪙$/, '🪙/h');
                            }
                            if (!/🪙/.test(price)) {
                                price = price + '🪙/h';
                            }
                        } else {
                            price = 'Sur devis';
                        }
                        return {
                            id: t.annonceId || t.tutorId,
                            name: t.tutorName || 'Tuteur EduMate',
                            subject: this.formatSubject(t.subjects || t.title || 'Cours'),
                            skills: skills,
                            rating: t.tutorRating || 0,
                            reviews: t.reviewsCount || Math.floor(Math.random() * 20) + 1,
                            price: price,
                            level: t.level || 'Tous niveaux',
                            location: this.formatLocation(t.location),
                            teachingMode: this.formatTeachingMode(t.teachingMode),
                            description: t.description || '',
                            tutorId: t.tutorId,
                            annonceId: t.annonceId
                        };
                    });
                }
            }

            let found = tutors.length > 0;
            let messageInfo = '';
            if (!found) {
                messageInfo = "Je n'ai trouvé aucun tuteur correspondant à votre recherche précise. Essayez d'élargir vos critères ou contactez-nous pour une recommandation personnalisée.";
            } else if (tutors.length > 0 && (level || location || priceRange)) {
                messageInfo = "Voici les tuteurs les plus proches de vos critères (niveau, ville ou prix).";
            }

            const payload = {
                found,
                count: tutors.length,
                tutors,
                filters: { subject, level, location, priceRange },
                messageInfo
            };
            this.cache.set(ragCacheKey, payload, 300);
            return payload;

        } catch (error) {
            console.error('❌ Erreur RAG search:', error.message);
            return {
                found: false,
                count: 0,
                tutors: [],
                filters: {},
                error: error.message
            };
        }
    }

    async expandQueryWithAI(message) {
        try {
            const systemPrompt = 'Tu es un assistant qui reformule une recherche de cours. Tu dois retourner un JSON valide et concis.';
            const userPrompt = `Reformule la demande utilisateur en une requete de recherche plus ciblée.\n\nDemande: "${message}"\n\nRetourne un JSON STRICT avec:\n{\n  "mainQuery": "...",\n  "relatedSubjects": ["...", "...", "..."]\n}\n\nRegles:\n- 1 a 3 sujets proches maximum\n- Langue: francais\n- Pas de texte hors JSON`;
            const raw = await this.callLanguageModel([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ], {
                maxTokens: 800,
                temperature: 0.2,
                timeout: 1500,
                cacheKey: `expand:${message.substring(0, 120)}`,
                cacheTtl: 300
            });
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return message;

            const parsed = JSON.parse(jsonMatch[0]);
            const mainQuery = parsed.mainQuery || message;
            const related = Array.isArray(parsed.relatedSubjects) ? parsed.relatedSubjects : [];
            const combined = [mainQuery, ...related].filter(Boolean).join(', ');

            return combined || message;
        } catch (error) {
            console.warn('⚠️ Expansion requete IA echouee, fallback:', error.message);
            return message;
        }
    }

    /**
     * Extrait les paramètres de recherche du message
     */
    extractSearchParams(message) {
        const subjects = [
            'mathématiques', 'maths', 'français', 'anglais', 'english',
            'chimie', 'physique', 'histoire', 'géographie', 'biologie',
            'informatique', 'python', 'javascript', 'allemand', 'espagnol', 'java',
            'programmation', 'science', 'philosophie', 'économie', 'droit', 'médecine'
        ];
        
        const levels = ['primaire', 'collège', 'lycée', 'bac', 'licence', 'master', 'seconde', 'première', 'terminale'];
        
        const params = {
            subject: null,
            level: null,
            priceRange: null,
            location: null
        };
        
        const lowerMsg = message.toLowerCase();
        
        for (const subject of subjects) {
            if (lowerMsg.includes(subject)) {
                params.subject = subject;
                break;
            }
        }
        
        for (const level of levels) {
            if (lowerMsg.includes(level)) {
                params.level = level;
                break;
            }
        }
        
        const priceMatch = message.match(/(\d+)\s*€|euros|educoins?/i);
        if (priceMatch) {
            params.priceRange = { max: parseInt(priceMatch[1]) };
        }
        
        const cities = ['paris', 'lyon', 'marseille', 'toulouse', 'bordeaux', 'lille', 'nice', 'nantes', 'strasbourg', 'montpellier'];
        for (const city of cities) {
            if (lowerMsg.includes(city)) {
                params.location = city;
                break;
            }
        }
        
        return params;
    }

    /**
     * Extrait les compétences du texte
     */
    extractSkillsFromText(text) {
        const commonSkills = [
            'Java', 'Python', 'JavaScript', 'React', 'Node.js', 'Spring Boot', 'REST API',
            'Algorithmes', 'Base de données', 'SQL', 'HTML/CSS', 'TypeScript', 'Angular',
            'Vue.js', 'Docker', 'Git', 'Microservices', 'AWS', 'Machine Learning',
            'Data Science', 'Analyse de données', 'DevOps', 'Cybersécurité'
        ];
        
        const foundSkills = [];
        const lowerText = text.toLowerCase();
        
        commonSkills.forEach(skill => {
            if (lowerText.includes(skill.toLowerCase())) {
                foundSkills.push(skill);
            }
        });
        
        return foundSkills.length > 0 ? foundSkills : ['Cours personnalisé', 'Pédagogie adaptée'];
    }

    formatSubject(subjects) {
        if (Array.isArray(subjects)) {
            return subjects.length > 0 ? subjects[0] : 'Cours divers';
        }
        return subjects || 'Cours divers';
    }

    formatLocation(location) {
        if (!location) return 'En ligne';
        if (typeof location === 'object') {
            return location.city || location.address || 'Lieu à définir';
        }
        return location;
    }

    formatTeachingMode(mode) {
        const modes = {
            'online': 'En ligne',
            'in_person': 'En présentiel',
            'both': 'Les deux',
            'hybrid': 'Les deux'
        };
        return modes[mode] || mode || 'Les deux';
    }

    buildSystemPrompt(context, ragResults, intent) {
          return `# CONTEXTE
Tu es l'assistant IA d'EduMate, une plateforme de mise en relation élèves/tuteurs.

${context}

# RÈGLES DE RÉPONSE STRICTES
1. Pour le formatage:
    - JAMAIS d'astérisques * ou **
    - Utilise UNIQUEMENT __texte__ pour le gras
    - Pas d'italique du tout
    - Les listes utilisent des tirets -

2. Pour les questions générales sur EduMate :
    - Réponse naturelle et utile
    - Propose l'étape suivante
    - Utilise des listes à puces si plusieurs points

3. IMPORTANT - Exemples :
    - INCORRECT: *texte en italique* ou **texte gras**
    - CORRECT: __texte en gras__
    - INCORRECT: 🔹 *Créer des algorithmes*
    - CORRECT: - __Créer des algorithmes__

4. Structure pour le gras:
    - Utilise __ avant et après le texte à mettre en gras
    - Exemple: __Cette partie est en gras__
    - Ne JAMAIS utiliser * ou **

5. MONNAIE :
    - N'utilise JAMAIS euro, €, EUR ou etp dans tes réponses.
    - Utilise UNIQUEMENT 🪙 (EduCoin) pour parler des crédits, tarifs ou prix.
    - Exemple : "Tarif : 30🪙/h" ou "Le paiement se fait en 🪙 (EduCoin)".`;
    }

    async callLanguageModel(messages, options = {}) {
        const provider = normalizeProvider(this.apiProvider) || getPreferredProvider();
        const model = this.model || (provider === 'mistral'
            ? (process.env.MISTRAL_MODEL || 'mistral-small-latest')
            : (process.env.OPENROUTER_MODEL || 'qwen/qwen1.5-110b-chat'));
        const apiKey = this.apiKey || (provider === 'mistral'
            ? process.env.MISTRAL_API_KEY
            : process.env.OPENROUTER_API_KEY);

        if (!apiKey) {
            throw new Error(`Clé API manquante pour ${provider}`);
        }

        const endpoint = provider === 'mistral'
            ? 'https://api.mistral.ai/v1/chat/completions'
            : 'https://openrouter.ai/api/v1/chat/completions';

        const payload = {
            model,
            messages,
            max_tokens: options.maxTokens ?? 800,
            temperature: options.temperature ?? 0.3,
            top_p: options.topP ?? 0.9
        };

        if (provider === 'mistral') {
            payload.safe_prompt = true;
        } else {
            payload.top_k = options.topK ?? 40;
            payload.frequency_penalty = options.frequencyPenalty ?? 0.1;
            payload.presence_penalty = options.presencePenalty ?? 0.1;
        }

        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };

        if (provider !== 'mistral') {
            headers['HTTP-Referer'] = options.httpReferer || 'http://localhost:5173';
            headers['X-Title'] = options.title || 'EduMate Chatbot';
        }

        const startTime = Date.now();
        const cacheKey = options.cacheKey || null;
        const cacheTtl = options.cacheTtl ?? 1800;

        if (cacheKey) {
            const cached = this.cache.get(`${provider}:${model}:${cacheKey}`);
            if (cached) {
                console.log(`⚡ Réponse ${provider} depuis le cache (${Date.now() - startTime}ms)`);
                return cached;
            }
        }

        try {
            console.log(`📡 Appel ${provider} (${model})`);

            const response = await axios.post(endpoint, payload, {
                headers,
                timeout: options.timeout ?? 20000
            });

            let reply = response.data?.choices?.[0]?.message?.content || '';
            const duration = Date.now() - startTime;
            
            // Remplacer les astérisques par du gras avec __
            reply = reply.replace(/\*([^*]+?)\*/g, '__$1__');
            reply = reply.replace(/\*\*([^*]+?)\*\*/g, '__$1__');
            
            if (cacheKey) {
                this.cache.set(`${provider}:${model}:${cacheKey}`, reply, cacheTtl);
            }
            
            console.log(`✅ Réponse reçue via ${provider} en ${duration}ms`);
            return reply;
            
        } catch (error) {
            console.error(`❌ ${provider} Error:`, error.response?.data || error.message);
            
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                return "EduMate vous aide à trouver le tuteur idéal. Pour plus de détails, veuillez réessayer.";
            }
            
            throw new Error(`Erreur ${provider}: ` + (error.response?.data?.error?.message || error.message));
        }
    }

    /**
     * Appelle le fournisseur LLM configuré.
     */
    async callOpenRouter(message, history, systemPrompt) {
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-1).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: message }
        ];

        return await this.callLanguageModel(messages, {
            cacheKey: `chat:${message.substring(0, 50)}:${systemPrompt.substring(0, 50)}`,
            cacheTtl: message.length < 100 ? 1800 : 300,
            maxTokens: 800,
            temperature: 0.3,
            timeout: 20000
        });
    }

}

module.exports = new ChatbotService();