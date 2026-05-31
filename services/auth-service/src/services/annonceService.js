const { Annonce, ProfileTutor, User } = require('../models/associations');
const { Op } = require('sequelize');

class AnnonceService {
  async createAnnonce(tutorId, annonceData) {
    try {
      const tutor = await ProfileTutor.findByPk(tutorId);
      if (!tutor) {
        throw new Error('Tuteur non trouvé');
      }

      const annoncePayload = {
        tutorId,
        title: annonceData.title,
        description: annonceData.description,
        subject: annonceData.subject,
        subjects: Array.isArray(annonceData.subjects) ? annonceData.subjects : [annonceData.subject],
        level: annonceData.level,
        hourlyRate: annonceData.hourlyRate,
        teachingMode: annonceData.teachingMode,
        location: annonceData.location,
        availability: annonceData.availability
      };

      console.log('📥 Données reçues pour création annonce:', annoncePayload);

      const annonce = await Annonce.create(annoncePayload);
      
      return await this.getAnnonceById(annonce.id);
    } catch (error) {
      console.error('Erreur détaillée création annonce:', error);
      throw new Error(`Erreur lors de la création de l'annonce: ${error.message}`);
    }
  }

  async getAnnonceById(annonceId) {
    try {
      console.log(`🔍 Recherche annonce ID: ${annonceId}`);
      
      const annonce = await Annonce.findOne({
        where: { id: annonceId },
        include: [
          {
            model: ProfileTutor,
            as: 'tutor',
            include: [{
              model: User,
              as: 'user',
              attributes: ['id', 'firstName', 'lastName', 'email']
            }]
          }
        ]
      });
      
      if (!annonce) {
        throw new Error('Annonce non trouvée');
      }
      
      console.log(`✅ Annonce trouvée: ${annonce.title}`);
      return annonce;
    } catch (error) {
      console.error(`❌ Erreur récupération annonce ${annonceId}:`, error);
      throw error;
    }
  }

  async searchAnnonces(filters = {}) {
    try {
      const {
        page = 1,
        limit = 9,
        subject,
        level,
        minRating,
        maxPrice,
        teachingMode,
        location,
        minPrice
      } = filters;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const whereClause = {
        isActive: true
      };

      if (subject) {
        whereClause[Op.or] = [
          { subject: { [Op.iLike]: `%${subject}%` } },
          { subjects: { [Op.contains]: [subject] } }
        ];
      }

      if (level) {
        whereClause.level = {
          [Op.iLike]: `%${level}%`
        };
      }

      if (teachingMode) {
        whereClause.teachingMode = teachingMode;
      }

      if (maxPrice) {
        whereClause.hourlyRate = {
          [Op.lte]: parseFloat(maxPrice)
        };
      }

      if (minPrice) {
        whereClause.hourlyRate = {
          ...whereClause.hourlyRate,
          [Op.gte]: parseFloat(minPrice)
        };
      }

      // Solution simple : retirer le filtre location pour l'instant
      // (on peut l'implémenter plus tard)

      const count = await Annonce.count({
        where: whereClause,
        include: [{
          model: ProfileTutor,
          as: 'tutor',
          where: {
            isVerified: true,
            isCompleted: true
          },
          ...(minRating && {
            rating: {
              [Op.gte]: parseFloat(minRating)
            }
          })
        }]
      });

      const annonces = await Annonce.findAll({
        where: whereClause,
        include: [{
          model: ProfileTutor,
          as: 'tutor',
          where: {
            isVerified: true,
            isCompleted: true
          },
          ...(minRating && {
            rating: {
              [Op.gte]: parseFloat(minRating)
            }
          }),
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'skillsToLearn'] // Ajouter skillsToLearn
          }]
        }],
        limit: limitNum,
        offset: offset,
        order: [['createdAt', 'DESC']]
      });

      const totalPages = Math.ceil(count / limitNum);

      return {
        annonces,
        totalAnnonces: count,
        currentPage: pageNum,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      };
    } catch (error) {
      console.error('❌ Erreur détaillée dans searchAnnonces:', error);
      throw new Error(`Erreur lors de la recherche des annonces: ${error.message}`);
    }
  }

  async getAnnoncesByTutor(tutorId) {
    try {
      const annonces = await Annonce.findAll({
        where: { tutorId },
        include: [{
          model: ProfileTutor,
          as: 'tutor',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }]
        }],
        order: [['createdAt', 'DESC']]
      });

      return annonces;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des annonces du tuteur: ${error.message}`);
    }
  }

  async updateAnnonce(annonceId, updateData) {
    try {
      const annonce = await Annonce.findByPk(annonceId);
      if (!annonce) {
        throw new Error('Annonce non trouvée');
      }

      await annonce.update(updateData);
      return await this.getAnnonceById(annonceId);
    } catch (error) {
      throw new Error(`Erreur lors de la mise à jour de l'annonce: ${error.message}`);
    }
  }

  async deleteAnnonce(annonceId) {
    try {
      const annonce = await Annonce.findByPk(annonceId);
      if (!annonce) {
        throw new Error('Annonce non trouvée');
      }

      await annonce.destroy();
      return true;
    } catch (error) {
      throw new Error(`Erreur lors de la suppression de l'annonce: ${error.message}`);
    }
  }

  async toggleAnnonce(annonceId, isActive) {
    try {
      const annonce = await Annonce.findByPk(annonceId);
      if (!annonce) {
        throw new Error('Annonce non trouvée');
      }

      await annonce.update({ isActive });
      return annonce;
    } catch (error) {
      throw new Error(`Erreur lors de la modification du statut de l'annonce: ${error.message}`);
    }
  }

  async createAnnonceFromText(tutorId, rawText, additionalData = {}) {
    try {
      console.log('📝 Création annonce depuis texte pour tuteur:', tutorId);
      
      const AITextProcessor = require('./aiTextProcessor');
      const analysis = await AITextProcessor.analyzeTextWithAI(rawText);
      
      const validTeachingModes = ['En ligne', 'En présentiel', 'Les deux'];
      let teachingMode = analysis.teachingMode || additionalData.teachingMode || 'Les deux';
      
      if (!validTeachingModes.includes(teachingMode)) {
        if (teachingMode.toLowerCase().includes('ligne')) {
          teachingMode = 'En ligne';
        } else if (teachingMode.toLowerCase().includes('présentiel')) {
          teachingMode = 'En présentiel';
        } else {
          teachingMode = 'Les deux';
        }
      }
      
      const annonceData = {
        tutorId,
        title: analysis.title,
        description: rawText,
        subject: analysis.skills.length > 0 ? analysis.skills[0] : 'Compétences diverses',
        subjects: analysis.skills,
        detectedSkills: analysis.skills,
        level: analysis.levels.join(', '),
        hourlyRate: additionalData.hourlyRate || 20,
        teachingMode: teachingMode,
        location: additionalData.location,
        availability: additionalData.availability,
        rawText: rawText,
        metadata: {
          aiGenerated: true,
          extractionConfidence: analysis.extractionMetadata.confidence,
          originalTextLength: rawText.length
        }
      };
      
      
      const annonce = await Annonce.create(annonceData);
      return await this.getAnnonceById(annonce.id);
    } catch (error) {
      console.error('❌ Erreur création annonce depuis texte:', error);
      throw new Error(`Erreur lors de la création de l'annonce depuis texte: ${error.message}`);
    }
  }

  /**
   * Recherche hybride (sémantique + textuelle)
   */
  async hybridSearchAnnonces(query, filters = {}) {
    try {
      const axios = require('axios');
      
      // Appeler RAG pour recherche sémantique
      const ragResponse = await axios.get(`${process.env.RAG_SERVICE_URL || 'http://rag-service:3005'}/search/semantic`, {
        params: {
          q: query,
          level: filters.level,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          teachingMode: filters.teachingMode,
          limit: 12
        },
        timeout: 5000
      });
      
      if (ragResponse.data.success && ragResponse.data.data?.results?.length > 0) {
        return {
          annonces: ragResponse.data.data.results,
          totalAnnonces: ragResponse.data.data.results.length,
          totalPages: 1,
          currentPage: 1,
          searchType: 'semantic'
        };
      }
      
      // Fallback à recherche textuelle
      return this.searchAnnonces({ ...filters, subject: query });
    } catch (error) {
      console.error('❌ Erreur recherche hybride:', error.message);
      // Fallback final
      return this.searchAnnonces({ ...filters, subject: query });
    }
  }
}

module.exports = new AnnonceService();