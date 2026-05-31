const axios = require('axios');

class AITextProcessor {
    constructor() {
        this.apiKey = null;
        this.model = null;
        this.configCache = null;
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.lastFetch = 0;
    }

    /**
     * Récupère la configuration OpenRouter depuis les variables d'environnement
     * @returns {Promise<Object>} Configuration avec apiKey et model
     */
    async getOpenRouterConfig() {
        const apiKey = process.env.OPENROUTER_API_KEY;
        const model = process.env.OPENROUTER_MODEL || 'qwen/qwen3-14';
        
        if (!apiKey) {
            throw new Error('OPENROUTER_API_KEY manquante dans .env');
        }
        
        console.log(`🔧 [AITextProcessor] Config .env chargée: ${model} | ${apiKey.slice(0, 10)}...`);
        
        return { apiKey, model };
    }



    /**
     * Génère une offre complète (titre + description) à partir de compétences
     */
    async generateOfferFromSkills(skills, rawText = '') {    
        try {
            const skillsList = Array.isArray(skills) ? skills : [skills];
            
            console.log('🤖 Appel IA pour générer offre avec skills:', skillsList);
            
            const prompt = `Tu es un expert en rédaction d'annonces de cours. 

COMPÉTENCES À ENSEIGNER : ${skillsList.join(', ')}

INSTRUCTIONS TRÈS IMPORTANTES :

1. **TITRE** (max 60 caractères) :
   - Professionnel et accrocheur
   - Commencer par "Cours de...", "Formation en...", "Atelier de..."
   - JAMAIS utiliser "Professeur de...", "Enseignant de...", "Tuteur de..."

2. **DESCRIPTION DÉTAILLÉE** (OBLIGATOIRE - 6-8 phrases minimum) :
   - DÉBUT par expliquer CE QUE l'étudiant apprendra
   - DÉTAILLE chaque compétence mentionnée
   - DÉCRIS la méthode d'enseignement (pratique, projets, exercices)
   - MENTIONNE les bénéfices concrets
   - SOIS SPÉCIFIQUE - pas de phrases vagues
   - FINIS par les avantages pour l'étudiant

${rawText ? `CONTEXTE SUPPLÉMENTAIRE (à intégrer si pertinent) : "${rawText}"` : ''}

RÉPONSE EN JSON :
{
  "title": "Le titre ici (DOIT commencer par Cours/Formation/Atelier)",
  "description": "La description détaillée ici (minimum 6 phrases)"
}`;

            const { apiKey, model } = await this.getOpenRouterConfig();

            if (!apiKey) {
                throw new Error('Clé API manquante dans la configuration');
            }

            const response = await axios.post(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                model: 'qwen/qwen3-vl-8b-instruct',
          messages: [
            {
              role: 'system',
              content: 'TU DOIS TOUJOURS FOURNIR UNE DESCRIPTION DÉTAILLÉE DE 6-8 PHRASES. IMPORTANT : Titre = "Cours de...", JAMAIS "Professeur de...".'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
          max_tokens: 50
        },
        {
          headers: {
                  'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

            console.log('✅ Réponse IA reçue');
            console.log('Structure réponse:', JSON.stringify(response.data, null, 2).substring(0, 500));
            
            if (!response.data.choices || !response.data.choices[0]) {
                console.error('❌ Pas de choices dans la réponse:', response.data);
                throw new Error('Réponse API invalide: pas de choices');
            }
            
            const aiText = this.getMessageText(response.data.choices[0].message);
            
            if (!aiText) {
                console.error('❌ Contenu vide. Réponse complète:', JSON.stringify(response.data));
                throw new Error('Réponse API vide');
            }
            
            console.log('Texte IA reçu (200 premiers chars):', aiText.substring(0, 200));
            
            const result = this.parseOfferResponse(aiText, skillsList);
            
            // Vérification que la description est assez longue
            if (!result.description || result.description.length < 200) {
                console.warn('⚠️ Description trop courte, nouvel appel IA...');
                return await this.regenerateDescription(skillsList, result.title);
            }
            
            return result;

        } catch (error) {
            console.error('❌ Erreur API:', error.message);
            throw new Error(`Échec génération IA: ${error.message}`);
        }
    }

    /**
     * Analyse un texte pour en extraire les compétences
     */
    async analyzeTextWithAI(text) {
        try {      
            const escapedText = text.replace(/"/g, '\\"').replace(/\n/g, '\\n');
            
            const prompt = `Analyse ce texte et extrais les compétences mentionnées :

TEXTE : "${escapedText}"

Tu dois :
1. Identifier les compétences/cours/programmes mentionnés
2. Générer un titre professionnel pour une annonce de cours
3. Créer une description détaillée de l'offre
4. RETOURNER UNIQUEMENT UN OBJET JSON VALIDE

IMPORTANT POUR LE TITRE :

FORMAT DE RÉPONSE OBLIGATOIRE :
{
  "title": "Titre de cours professionnel basé sur les compétences",
  "description": "Description détaillée de l'offre",
  "skills": ["compétence1", "compétence2", "etc"]
}`;

            const { apiKey, model } = await this.getOpenRouterConfig();

            if (!apiKey) {
                throw new Error('Clé API manquante dans la configuration');
            }

            const response = await axios.post(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                model: 'qwen/qwen3-vl-8b-instruct',
          messages: [
            {
              role: 'system',
              content: `Tu es un expert en analyse de textes. Tu DOIS retourner un JSON VALIDE avec :
1. Un "title" : titre professionnel pour une annonce de cours
2. Une "description" : description détaillée (4-6 phrases)
3. Un tableau "skills" : liste des compétences identifiées, les compétences doivent être des mots-clés précis
TRÈS IMPORTANT : Le titre DOIT commencer par "Cours de...", "Formation en...". JAMAIS "Professeur de...".`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
          max_tokens: 50
        },
        {
          headers: {
                  'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        }
      );

            const aiText = this.getMessageText(response.data.choices[0].message).trim();
            const cleanedText = this.cleanJSONResponse(aiText);
            
            try {
                const result = JSON.parse(cleanedText);
                
                if (!result.title || !result.description || !Array.isArray(result.skills)) {
                    throw new Error('Format JSON invalide - champs manquants');
                }
                
                return result;
                
            } catch (parseError) {
                console.error('❌ Erreur parsing JSON:', parseError.message);
                const repairedJSON = this.repairJSON(cleanedText);
                return JSON.parse(repairedJSON);
            }
            
        } catch (error) {
            console.error('❌ Erreur analyse IA:', error.message);
            throw new Error(`Échec analyse IA: ${error.message}`);
        }
    }

    /**
     * Génère uniquement un titre
     */
    async generateTitleOnly(skills) {
        try {
            const skillsList = Array.isArray(skills) ? skills : [skills];
            
            const prompt = `Crée un titre professionnel pour un cours enseignant ces compétences : ${skillsList.join(', ')}

Le titre doit être :

Réponds uniquement avec le titre.`;

            const { apiKey, model } = await this.getOpenRouterConfig();

            if (!apiKey) {
                throw new Error('Clé API manquante dans la configuration');
            }

            const response = await axios.post(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                model: 'qwen/qwen3-vl-8b-instruct',
          messages: [
            {
              role: 'system',
              content: 'Tu crées des titres professionnels pour des cours. Règles : "Cours de...", "Formation...", JAMAIS "Professeur...".'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 50
        },
        {
          headers: {
                  'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

            const rawText = this.getMessageText(response.data.choices[0].message).trim();
            const title = this.extractTitleFromText(rawText);
            
            return {
                title: title || `Cours de ${skillsList[0]}`,
                description: '',
                skills: skillsList
            };

        } catch (error) {
            console.error('❌ Erreur génération titre:', error.message);
            throw error;
        }
    }

    /**
     * Régénère une description si trop courte
     */
    async regenerateDescription(skills, title) {
        try {
            const prompt = `Génère une description DÉTAILLÉE pour ce cours :

Titre : "${title}"
Compétences : ${Array.isArray(skills) ? skills.join(', ') : skills}

Crée une description de 6-8 phrases qui :
1. Explique ce que l'étudiant apprendra
2. Détaille les compétences enseignées
3. Décrit la méthode pédagogique
4. Mentionne les bénéfices
5. Sois concret et spécifique

Réponds uniquement avec la description.`;

            const { apiKey, model } = await this.getOpenRouterConfig();

            if (!apiKey) {
                throw new Error('Clé API manquante dans la configuration');
            }

            const response = await axios.post(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                model: 'qwen/qwen3-vl-8b-instruct',
          messages: [
            {
              role: 'system',
              content: 'Tu génères DES DESCRIPTIONS DÉTAILLÉES pour des cours. Minimum 6 phrases.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 50
        },
        {
          headers: {
                  'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

            const rawText = this.getMessageText(response.data.choices[0].message).trim();
            const description = this.extractDescriptionFromText(rawText);
            
            return {
                title: title,
                description: description,
                skills: Array.isArray(skills) ? skills : [skills]
            };
            
        } catch (error) {
            console.error('❌ Erreur régénération description:', error.message);
            throw error;
        }
    }

    // Méthodes utilitaires
    getMessageText(message) {
        if (!message) return '';
        if (message.content && message.content.trim().length > 0) {
            return message.content;
        }
        if (message.reasoning && message.reasoning.trim().length > 0) {
            return message.reasoning;
        }
        return '';
    }

    extractTitleFromText(text) {
        if (!text) return '';
        const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
        const titleLine = lines.find(line => /^(Cours|Formation|Atelier)\b/i.test(line));
        return (titleLine || lines[lines.length - 1] || '').replace(/^"|"$/g, '');
    }

    extractDescriptionFromText(text) {
        if (!text) return '';
        const cleaned = text.replace(/\*\*.*?\*\*/g, '').trim();
        const parts = cleaned.split('\n').map(line => line.trim()).filter(Boolean);
        return parts[parts.length - 1] || cleaned;
    }

    cleanJSONResponse(text) {
        let cleaned = text.trim();
        
        // Supprimer les balises <think>...</think> du modèle deepseek-r1
        cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
        
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
            cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        } else {
            return '{"title": "Cours personnalisé", "description": "Cours adapté à vos besoins.", "skills": []}';
        }
        
        return cleaned;
    }

    repairJSON(brokenJSON) {
        try {
            return JSON.parse(brokenJSON);
        } catch (e) {
            console.log('🛠️ Tentative de réparation JSON...');
            
            let repaired = brokenJSON;
            
            const quoteCount = (repaired.match(/"/g) || []).length;
            if (quoteCount % 2 !== 0) {
                repaired += '"';
            }
            
            const openBraces = (repaired.match(/\{/g) || []).length;
            const closeBraces = (repaired.match(/\}/g) || []).length;
            for (let i = 0; i < openBraces - closeBraces; i++) {
                repaired += '}';
            }
            
            try {
                return JSON.parse(repaired);
            } catch (finalError) {
                return {
                    title: "Cours personnalisé",
                    description: "Cours adapté à vos besoins spécifiques.",
                    skills: []
                };
            }
        }
    }

    parseOfferResponse(aiText, skills) {
        try {
            // Nettoyer les balises <think> du modèle deepseek-r1
            let cleanedText = aiText.trim();
            
            // Supprimer les balises <think>...</think>
            cleanedText = cleanedText.replace(/<think>[\s\S]*?<\/think>/gi, '');
            
            // Extraire le JSON entre accolades
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanedText = jsonMatch[0];
            }
            
            const parsed = JSON.parse(cleanedText);
            
            return {
                title: parsed.title || `Cours de ${skills[0]}`,
                description: parsed.description || '',
                skills: skills
            };
        } catch (error) {
            console.error('❌ Parse JSON échoué:', error.message);
            console.error('Texte brut IA:', aiText.substring(0, 200));
            throw new Error('Format de réponse IA invalide');
        }
    }

    isCompleteJSON(text) {
        try {
            JSON.parse(text);
            return true;
        } catch {
            return false;
        }
    }

    fixIncompleteJSON(incompleteJson) {
        let fixed = incompleteJson.trim();
        
        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        
        for (let i = 0; i < openBraces - closeBraces; i++) {
            fixed += '}';
        }
        
        return fixed;
    }
}

module.exports = new AITextProcessor();