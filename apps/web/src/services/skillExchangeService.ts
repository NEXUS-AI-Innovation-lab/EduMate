import axios from 'axios';

const API_BASE_URL = '/api/blockchain';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 secondes - Blockchain peut être lent
});

// Intercepteur pour ajouter le token
const addAuthToken = (config: any) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

api.interceptors.request.use(addAuthToken);

// ============ INTERFACES ============

export interface Skill {
  id: string;
  name: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface SkillExchangeRequest {
  id?: string;
  studentId: string;
  tutorId: string;
  skillOffered?: Skill; // Compétence que l'étudiant offre d'enseigner
  skillRequested?: Skill; // Compétence que l'étudiant veut apprendre
  skillsOffered?: Skill[]; // Pour les échanges multi-compétences
  skillsRequested?: Skill[]; // Pour les échanges multi-compétences
  description?: string;
  studentNotes?: string;
  tutorDescription?: string; // Description/notes du tuteur
  amount?: number;
  status?: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt?: string;
  updatedAt?: string;
  bookings?: Array<{
    date: string;
    time: string;
    duration: number;
  }>;
}

export interface SkillExchangeResponse {
  success: boolean;
  data?: SkillExchangeRequest;
  message?: string;
}

// ============ SKILL EXCHANGE ENDPOINTS ============

/**
 * Créer une demande d'échange de compétence
 */
export const createSkillExchange = async (
  tutorId: string,
  skillOffered: Skill,
  skillRequested: Skill
): Promise<SkillExchangeResponse> => {
  try {
    const response = await api.post('/skill-exchange', {
      tutorId,
      skillOffered,
      skillRequested,
    });
    return response.data;
  } catch (error: any) {
    console.error('Erreur création échange compétence:', error);
    throw error;
  }
};

/**
 * Récupérer toutes les demandes d'échange pour l'utilisateur courant
 */
export const getSkillExchanges = async (
  filters?: { status?: string }
): Promise<{ data: SkillExchangeRequest[] }> => {
  try {
    const response = await api.get('/skill-exchange', { params: filters });
    return response.data;
  } catch (error: any) {
    console.error('Erreur récupération échanges:', error);
    throw error;
  }
};

/**
 * Accepter une demande d'échange
 */
export const acceptSkillExchange = async (
  exchangeId: string
): Promise<SkillExchangeResponse> => {
  try {
    const response = await api.patch(`/skill-exchange/${exchangeId}/accept`);
    return response.data;
  } catch (error: any) {
    console.error('Erreur acceptation échange:', error);
    throw error;
  }
};

/**
 * Rejeter une demande d'échange
 */
export const rejectSkillExchange = async (
  exchangeId: string
): Promise<SkillExchangeResponse> => {
  try {
    const response = await api.patch(`/skill-exchange/${exchangeId}/reject`);
    return response.data;
  } catch (error: any) {
    console.error('Erreur rejet échange:', error);
    throw error;
  }
};

/**
 * Compléter un échange de compétence
 */
export const completeSkillExchange = async (
  exchangeId: string
): Promise<SkillExchangeResponse> => {
  try {
    const response = await api.patch(`/skill-exchange/${exchangeId}/complete`);
    return response.data;
  } catch (error: any) {
    console.error('Erreur complétion échange:', error);
    throw error;
  }
};

/**
 * Soumettre un avis pour un échange de compétences
 */
export const submitSkillExchangeReview = async (
  exchangeId: string,
  reviewData: { targetUserId: string; comment: string; rating?: number }
): Promise<SkillExchangeResponse> => {
  try {
    const response = await api.post(`/skill-exchange/${exchangeId}/submit-review`, reviewData);
    return response.data;
  } catch (error: any) {
    console.error('Erreur soumission avis échange:', error);
    throw error;
  }
};

/**
 * Confirmer un avis pour un échange de compétences
 */
export const confirmSkillExchangeReview = async (
  exchangeId: string
): Promise<SkillExchangeResponse> => {
  try {
    const response = await api.post(`/skill-exchange/${exchangeId}/confirm-review`);
    return response.data;
  } catch (error: any) {
    console.error('Erreur confirmation avis échange:', error);
    throw error;
  }
};

/**
 * Récupérer les échanges acceptés avec données complètes pour l'historique
 */
export const getAcceptedSkillExchangesForHistory = async (): Promise<{ data: SkillExchangeRequest[] }> => {
  try {
    const response = await api.get('/skill-exchange/history/accepted');
    return response.data;
  } catch (error: any) {
    console.error('Erreur récupération échanges pour historique:', error);
    throw error;
  }
};

/**
 * Récupérer les échanges acceptés avec leurs bookings associés
 * Utilisé pour afficher les cours d'échange dans l'historique
 */
export const getAcceptedSkillExchangeBookings = async (): Promise<{ data: SkillExchangeRequest[] }> => {
  try {
    // Récupérer les échanges acceptés
    const exchangesResponse = await api.get('/skill-exchange', { params: { status: 'accepted' } });
    const exchanges = exchangesResponse.data?.data || [];
    
    // Les exchanges retournés n'ont pas forcément les bookings - c'est ok, le frontend gérera
    return { data: exchanges };
  } catch (error: any) {
    console.error('Erreur récupération échanges acceptés:', error);
    throw error;
  }
};
