const axios = require('axios');

class PostgresService {
  constructor() {
    this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
  }

  async getUserById(userId) {
    try {
      console.log(`[getUserById] Recherche utilisateur: ${userId}`);
      
      // Essayer d'abord le profil tuteur
      try {
        const tutorResponse = await axios.get(`${this.authServiceUrl}/api/profile/tutor/byUser/${userId}`);
        console.log(`[getUserById] Réponse tuteur:`, tutorResponse.data);
        
        if (tutorResponse.data.success) {
          return tutorResponse.data.data;
        }
      } catch (tutorError) {
        console.log(`[getUserById] Tuteur non trouvé: ${tutorError.message}`);
      }

      // Essayer le profil étudiant
      try {
        const studentResponse = await axios.get(`${this.authServiceUrl}/api/profile/student/byUser/${userId}`);
        console.log(`[getUserById] Réponse étudiant:`, studentResponse.data);
        
        if (studentResponse.data.success) {
          return studentResponse.data.data;
        }
      } catch (studentError) {
        console.log(`[getUserById] Étudiant non trouvé: ${studentError.message}`);
      }

      throw new Error(`Aucun profil trouvé pour l'utilisateur ${userId}`);

    } catch (error) {
      console.error('[getUserById] Erreur finale:', error.message);
      throw new Error(`Impossible de récupérer l'utilisateur: ${error.message}`);
    }
  }



  async searchUsers(query, currentUserId) {
    try {
      console.log(`[searchUsers] Recherche utilisateurs avec query="${query}"`);
      const response = await axios.get(
        `${this.authServiceUrl}/api/users/search?query=${encodeURIComponent(query)}`
      );
      console.log('[searchUsers] Réponse:', response.data);

      if (response.data.success) {
        return response.data.data.filter(user => user.id !== currentUserId);
      }

      throw new Error('Erreur lors de la recherche d\'utilisateurs');
    } catch (error) {
      if (error.response) {
        console.error('[searchUsers] AxiosError response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else if (error.request) {
        console.error('[searchUsers] AxiosError request:', error.request);
      } else {
        console.error('[searchUsers] Error message:', error.message);
      }
      throw new Error(`Impossible de rechercher des utilisateurs: ${error.message}`);
    }
  }

  async getAllUsers(currentUserId) {
    try {
      const response = await axios.get(`${this.authServiceUrl}/api/auth/all`);

      if (response.data.success) {
        return response.data.data.filter(user => user.id !== currentUserId);
      }

      throw new Error('Erreur lors de la récupération des utilisateurs');
    } catch (error) {
      if (error.response) {
        console.error('[getAllUsers] AxiosError response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else if (error.request) {
        console.error('[getAllUsers] AxiosError request:', error.request);
      } else {
        console.error('[getAllUsers] Error message:', error.message);
      }

      console.log('[getAllUsers] Fallback: récupération mock users');
      return this.getMockUsers(currentUserId);
    }
  }

  async getMockUsers(currentUserId) {
    return [
      { id: 'user1', firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@example.com', role: 'tutor', profilePicture: null },
      { id: 'user2', firstName: 'Marie', lastName: 'Martin', email: 'marie.martin@example.com', role: 'student', profilePicture: null },
      { id: 'user3', firstName: 'Pierre', lastName: 'Durand', email: 'pierre.durand@example.com', role: 'tutor', profilePicture: null },
    ].filter(user => user.id !== currentUserId);
  }

  async validateUser(userId) {
    try {
      console.log(`[validateUser] Validation userId=${userId}`);
      const response = await axios.get(`${this.authServiceUrl}/api/users/${userId}/exists`);
      console.log('[validateUser] Réponse:', response.data);
      return response.data.success;
    } catch (error) {
      if (error.response) {
        console.error('[validateUser] AxiosError response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else if (error.request) {
        console.error('[validateUser] AxiosError request:', error.request);
      } else {
        console.error('[validateUser] Error message:', error.message);
      }
      return false;
    }
  }
}

module.exports = new PostgresService();
 