import api from './api';

export interface SemanticSearchResult {
  annonceId: string;
  tutorId: string;
  title: string;
  description: string;
  subjects: string[];
  level: string;
  hourlyRate: number;
  teachingMode: string;
  location: any;
  tutorName: string;
  tutorRating: number;
  tutorSkillsToLearn: string[];
  relevanceScore: number;
  matchType: 'semantic' | 'hybrid';
}

export interface SemanticSearchResponse {
  success: boolean;
  message: string;
  data: {
    results: SemanticSearchResult[];
    query: string;
    filters: Record<string, any>;
    total: number;
    limit: number;
  };
  metadata: {
    searchType: 'semantic';
    timestamp: string;
  };
}

class RagService {
  private ragApiUrl = import.meta.env.VITE_RAG_SERVICE_URL || '/api/rag';
  private isRagAvailable = true;
  private lastHealthCheck = 0;
  private healthCheckInterval = 60000; // 60 secondes
  /**
   * Vérifier si le service RAG est disponible
   */
  async checkHealth(): Promise<boolean> {
    const now = Date.now();
    
    // Cache le résultat pendant 30 secondes
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isRagAvailable;
    }

    try {
      const response = await fetch(`${this.ragApiUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)      
  });
      
      this.isRagAvailable = response.ok;
      this.lastHealthCheck = now;
      
      if (this.isRagAvailable) {
        console.log('✅ Service RAG disponible');
      } else {
        console.warn('⚠️ Service RAG indisponible (status:', response.status, ')');
      }
      
      return this.isRagAvailable;
    } catch (error) {
      console.warn('⚠️ Service RAG indisponible:', error instanceof Error ? error.message : 'Erreur inconnue');
      this.isRagAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Recherche sémantique avec Qdrant + Ollama
   */
  async semanticSearch(query: string, filters: Record<string, any> = {}, limit: number = 10): Promise<SemanticSearchResponse> {
    try {
      // Vérifier la disponibilité du service
      const isAvailable = await this.checkHealth();
      
      if (!isAvailable) {
        throw new Error('Service RAG indisponible');
      }

      const safeQuery = (query || '').trim();
      const params = new URLSearchParams();
      params.append('q', safeQuery);
      params.append('limit', limit.toString());

      // Ajouter les filtres optionnels
      if (filters.level) params.append('level', filters.level);
      if (filters.minPrice !== undefined) params.append('minPrice', filters.minPrice.toString());
      if (filters.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice.toString());
      if (filters.teachingMode) params.append('teachingMode', filters.teachingMode);
      if (filters.location) params.append('location', filters.location);

      const url = `${this.ragApiUrl}/search/semantic?${params.toString()}`;
      console.log('🔍 Requête RAG URL:', url);
      
      const response = await api.get(url);
      
      if (!response.data || !response.data.success) {
        throw new Error(`RAG retourna une erreur: ${response.data?.message || 'Réponse invalide'}`);
      }

      console.log('✅ Réponse RAG OK:', { 
        total: response.data.data?.total, 
        results: response.data.data?.results?.length 
      });
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur RAG détaillée:', { 
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      throw error;
    }
  }

  /**
   * Synchroniser les annonces (admin seulement)
   */
  async syncAnnonces(): Promise<any> {
    try {
      const response = await api.post(`${this.ragApiUrl}/sync`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur sync:', error);
      throw error;
    }
  }

  /**
   * Recherche d'échange de compétences
   */
  async findSkillExchange(skillsToTeach: string[], skillsToLearn: string[]): Promise<any> {
    try {
      const response = await api.post(`${this.ragApiUrl}/search/exchange`, {
        skillsToTeach,
        skillsToLearn
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur skill exchange:', error);
      throw error;
    }
  }
}

export default new RagService();