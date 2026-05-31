// services/userService.js - VERSION CORRIGÉE
const axios = require('axios');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

class UserService {
  async getUserById(userId) {
    try {
      console.log(`[userService] getUserById appelé avec userId: ${userId}`);
      
      // Récupérer directement depuis auth-service (endpoint simple pour un utilisateur par son ID)
      try {
        const userResponse = await axios.get(`${AUTH_SERVICE_URL}/api/users/${userId}`);
        
        if (userResponse.data.success && userResponse.data.data) {
          const user = userResponse.data.data;
          console.log(`[userService] ✅ Utilisateur trouvé: ${user.firstName} ${user.lastName}`);
          
          return {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profilePicture: null,
            userType: user.role
          };
        }
      } catch (userError) {
        console.error(`[userService] ❌ Erreur récupération utilisateur: ${userError.message}`);
      }

      console.warn(`[userService] ⚠️ Aucune information trouvée pour l'utilisateur ${userId}`);
      return null;

    } catch (error) {
      console.error(`[userService] Erreur critique getUserById:`, error.message);
      return null;
    }
  }

  async searchUsers(query, currentUserId) {
    try {
      const response = await axios.get(`${AUTH_SERVICE_URL}/api/users/search`, {
        params: { query, excludeId: currentUserId }
      });
      
      if (response.data.success) {
        return response.data.data.map(user => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture || null
        }));
      }
      
      throw new Error('Erreur lors de la recherche d\'utilisateurs');
    } catch (error) {
      console.error('[userService] Erreur searchUsers:', error.message);
      
      // Fallback avec des utilisateurs mock
      return this.getMockUsers(currentUserId);
    }
  }

  async getMockUsers(currentUserId) {
    return [
      { 
        id: 'user1', 
        firstName: 'Jean', 
        lastName: 'Dupont', 
        email: 'jean.dupont@example.com', 
        role: 'tutor', 
        profilePicture: null 
      },
      { 
        id: 'user2', 
        firstName: 'Marie', 
        lastName: 'Martin', 
        email: 'marie.martin@example.com', 
        role: 'student', 
        profilePicture: null 
      }
    ].filter(user => user.id !== currentUserId);
  }
}

module.exports = new UserService();