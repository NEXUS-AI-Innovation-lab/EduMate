// blockchainService.ts - SERVICE FUSIONNÉ (booking + blockchain)
// Ce fichier sert de RÉFÉRENCE CONTRACTUELLE pour le backend Python
// NE PAS MODIFIER - Routes, payloads et réponses doivent correspondre exactement

import axios from 'axios';

const BLOCKCHAIN_BASE_URL = '/api/blockchain';
const AUTH_BASE_URL = '/api';

const blockchainApi = axios.create({
  baseURL: BLOCKCHAIN_BASE_URL,
  timeout: 30000, // ⚡ 30 secondes - Backend Python très lent
});

const authApi = axios.create({
  baseURL: AUTH_BASE_URL,
  timeout: 5000, // 5 secondes max
});

// Intercepteur pour ajouter le token
const addAuthToken = (config: any) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

blockchainApi.interceptors.request.use(addAuthToken);
authApi.interceptors.request.use(addAuthToken);

// Fonction pour obtenir l'utilisateur connecté
const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('❌ Erreur parsing utilisateur:', error);
    return null;
  }
};

// ============ INTERFACES COMMUNES ============

export interface WalletBalance {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  wallet: {
    availableCredits?: number;
    available: number;
    balance?: number;
    balanceCredits?: number;
    locked: number;
    total: number;
    walletAddress: string;
    kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
  };
}

export interface Transaction {
  id: string;
  fromWalletId?: string;
  toWalletId: string;
  amount: number;
  fee: number;
  transactionType: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description?: string;
  metadata: any;
  createdAt: string;
  fromWallet?: {
    id: string;
    userId: string;
    walletAddress: string;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  toWallet?: {
    id: string;
    userId: string;
    walletAddress: string;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  ledgerBlock?: {
    id: string;
    hash: string;
    timestamp: string;
  };
}

export interface TransferRequest {
  toWalletAddress: string;
  amount: number;
  description?: string;
  metadata?: any;
}

export interface TransferResponse {
  success: boolean;
  transaction: Transaction;
  ledgerBlock: any;
  fromUser: {
    name: string;
    newBalance: number;
  };
  toUser: {
    name: string;
  };
}

export interface WithdrawalRequest {
  amount: number;
  bankDetails: {
    accountHolder: string;
    iban: string;
    bankName: string;
  };
}

export interface WithdrawalResponse {
  id: string;
  walletId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  createdAt: string;
}

export interface WalletStats {
  wallet: {
    available: number;
    locked: number;
    total: number;
    address: string;
    kycStatus: string;
  };
  today: {
    sent: number;
    received: number;
  };
  monthly: {
    sent: number;
    received: number;
  };
  allTime: {
    transactions: number;
    sent: number;
    received: number;
    fees: number;
  };
}

export interface TransactionHistory {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuditReport {
  summary: {
    totalTransactions: number;
    totalCreditsSent: number;
    totalCreditsReceived: number;
    totalFees: number;
    period: {
      startDate: string;
      endDate: string;
    };
  };
  transactions: any[];
}

// ============ INTERFACES BOOKING (FUSIONNÉES) ============

export interface CreateBookingData {
  tutorId: string;
  annonceId: string;
  date: string;
  time: string;
  amount: number;
  duration?: number;
  description?: string;
  studentNotes?: string;
}

export interface Booking {
  id: string;
  tutorId: string;
  studentId: string;
  annonceId: string;
  date: string;
  time: string;
  duration: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  amount: number;
  transactionHash?: string;
  blockchainStatus: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  blockchainTransactionId?: string;
  description?: string;
  studentNotes?: string;
  tutorNotes?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  cancelled: number;
  completed: number;
  totalAmount: number;
  pendingAmount: number;
}

// ============ CLASSE PRINCIPALE FUSIONNÉE ============

class BlockchainService {
  
  // ============ MÉTHODES WALLET/BLOCKCHAIN ============
  
  async getBalance(): Promise<WalletBalance> {
    const startTime = performance.now();
    const user = getCurrentUser();
    
    if (!user?.id) {
      throw new Error('Utilisateur non connecté');
    }
    
    console.log('⚡ [Service] Appel getBalance...');
    const response = await blockchainApi.get(`/balance?userId=${user.id}`);
    console.log(`✅ [Service] getBalance terminé en ${(performance.now() - startTime).toFixed(0)}ms`);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Erreur lors de la récupération du solde');
    }
    
    const balanceData = response.data.data;
    
    // Utiliser les infos du localStorage au lieu d'un appel API supplémentaire
    if (balanceData.user && user) {
      balanceData.user = {
        ...balanceData.user,
        firstName: user.firstName || balanceData.user.firstName || 'Utilisateur',
        lastName: user.lastName || balanceData.user.lastName || '',
        role: user.role || balanceData.user.role || 'user'
      };
    }
    
    return balanceData;
  }

  async transfer(transferData: TransferRequest): Promise<TransferResponse> {
    const user = getCurrentUser();
    if (!user?.id) {
      throw new Error('Utilisateur non connecté');
    }

    const response = await blockchainApi.post(
      `/transfer?fromUserId=${user.id}`,
      {
        toWalletAddress: transferData.toWalletAddress,
        amount: transferData.amount,
        description: transferData.description || "",
        metadata: transferData.metadata || {}
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || 'Erreur lors du transfert');
    }
    

    return response.data;
  }


  async getHistory(options?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    transactionType?: string;
  }): Promise<TransactionHistory> {
    const startTime = performance.now();
    const user = getCurrentUser();
    if (!user?.id) {
      throw new Error('Utilisateur non connecté');
    }

    const params = new URLSearchParams();
    params.append('userId', user.id);
    
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    else params.append('limit', '20'); // ⚡ LIMITE PAR DÉFAUT RÉDUITE À 20
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.transactionType) params.append('transactionType', options.transactionType);

    console.log('⚡ [Service] Appel getHistory...');
    const response = await blockchainApi.get(`/history?${params.toString()}`);
    console.log(`✅ [Service] getHistory terminé en ${(performance.now() - startTime).toFixed(0)}ms`);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Erreur lors de la récupération de l\'historique');
    }
    
    return response.data.data;
  }

  async requestWithdrawal(withdrawalData: WithdrawalRequest): Promise<WithdrawalResponse> {
    const user = getCurrentUser();
    if (!user?.id) {
      throw new Error('Utilisateur non connecté');
    }

    const balance = await this.getBalance();
    const walletId = balance.wallet.walletAddress;

    const payload = {
      ...withdrawalData,
      walletId: walletId
    };

    const response = await blockchainApi.post('/withdrawal/request', payload);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Erreur lors de la demande de retrait');
    }
    
    return response.data.data;
  }

  async getStats(): Promise<WalletStats> {
    const startTime = performance.now();
    const user = getCurrentUser();
    if (!user?.id) {
      throw new Error('Utilisateur non connecté');
    }

    console.log('⚡ [Service] Appel getStats...');
    const response = await blockchainApi.get(`/stats?userId=${user.id}`);
    console.log(`✅ [Service] getStats terminé en ${(performance.now() - startTime).toFixed(0)}ms`);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Erreur lors de la récupération des statistiques');
    }
    
    return response.data.data;
  }

  async generateAuditReport(startDate: string, endDate: string): Promise<AuditReport> {
    const user = getCurrentUser();
    if (!user?.id) {
      throw new Error('Utilisateur non connecté');
    }

    const response = await blockchainApi.get(`/audit?userId=${user.id}&startDate=${startDate}&endDate=${endDate}`);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Erreur lors de la génération du rapport d\'audit');
    }
    
    return response.data.data;
  }

  async createWallet(): Promise<any> {
    const user = getCurrentUser();
    if (!user?.id) {
      throw new Error('Utilisateur non connecté');
    }

    const response = await blockchainApi.post('/wallet/create', { userId: user.id });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Erreur lors de la création du wallet');
    }
    
    return response.data.data;
  }

  async testConnection(): Promise<boolean> {
    try {
      await blockchainApi.get('/test');
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkHealth(): Promise<any> {
    const response = await axios.get('/api/blockchain/health');
    return response.data;
  }

  // ============ MÉTHODES BOOKING (FUSIONNÉES) ============
  
  async createBooking(data: CreateBookingData) {
    try {
      const response = await blockchainApi.post('/booking', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la création de la réservation');
    }
  }

  async createBatchBookings(data: {
    tutorId: string;
    annonceId: string;
    bookings: Array<{
      date: string;
      time: string;
      duration: number;
      amount: number;
    }>;
    description?: string;
    studentNotes?: string;
  }) {
    try {
      const response = await blockchainApi.post('/booking/batch', data);
      return response.data;
    } catch (error: any) {
      console.error('Erreur batch bookings:', error.response?.data);
      throw new Error(error.response?.data?.message || 'Erreur lors de la création des réservations');
    }
  }

  async createBatchSkillExchangeBookings(data: {
    tutorId: string;
    annonceId: string;
    bookings: Array<{
      date: string;
      time: string;
      duration: number;
    }>;
    skillsOffered: Array<{
      name: string;
      level: string;
    }>;
    skillsRequested: Array<{
      name: string;
    }>;
    description?: string;
    studentNotes?: string;
    tutorSkillsToLearn?: Array<{
      name: string;
    }>;
  }) {
    try {
      // Create a booking for each time slot
      const results = [];
      let successCount = 0;
      let failureCount = 0;
      const errors: any[] = [];

      for (const booking of data.bookings) {
        try {
          const skillExchangePayload = {
            tutorId: data.tutorId,
            annonceId: data.annonceId,
            date: booking.date,
            time: booking.time,
            duration: booking.duration,
            skillsOffered: data.skillsOffered,
            skillsRequested: data.skillsRequested,
            description: data.description,
            studentNotes: data.studentNotes
          };

          const response = await blockchainApi.post('/booking/skill-exchange', skillExchangePayload);
          
          if (response.data.success) {
            successCount++;
            results.push({
              success: true,
              data: response.data.data
            });
          } else {
            failureCount++;
            errors.push({
              date: booking.date,
              time: booking.time,
              error: response.data.message
            });
          }
        } catch (error: any) {
          failureCount++;
          errors.push({
            date: booking.date,
            time: booking.time,
            error: error.response?.data?.message || error.message
          });
        }
      }

      return {
        success: successCount > 0,
        data: {
          successCount,
          failureCount,
          totalRequested: data.bookings.length,
          results
        },
        message: `${successCount} réservation(s) créée(s) avec succès (${failureCount} échouée(s))`,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error: any) {
      console.error('Erreur batch skill exchanges:', error.response?.data);
      throw new Error(error.response?.data?.message || 'Erreur lors de la création des échanges de compétences');
    }
  }

  async confirmBooking(bookingId: string, tutorNotes?: string) {
    try {
      const response = await blockchainApi.patch(`/booking/${bookingId}/confirm`, { tutorNotes });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la confirmation de la réservation');
    }
  }

  async cancelBooking(bookingId: string, reason?: string) {
    try {
      const response = await blockchainApi.patch(`/booking/${bookingId}/cancel`, { reason });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de l\'annulation de la réservation');
    }
  }

  async completeBooking(bookingId: string) {
    try {
      const response = await blockchainApi.patch(`/booking/${bookingId}/complete`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la complétion de la réservation');
    }
  }

  async getBookingsByUser(userId: string, filters?: { status?: string }) {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      
      const response = await blockchainApi.get(`/booking/user/${userId}?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la récupération des réservations');
    }
  }

  async getBookingsByTutor(tutorId: string, filters?: { status?: string }) {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      
      const response = await blockchainApi.get(`/booking/tutor/${tutorId}?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la récupération des réservations du tuteur');
    }
  }

  async getBookingsByStudent(studentId: string, filters?: { status?: string }) {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      
      const response = await blockchainApi.get(`/booking/student/${studentId}?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la récupération des réservations de l\'étudiant');
    }
  }

  async getAllBookings(userId: string, filters?: { status?: string }) {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      
      const response = await blockchainApi.get(`/booking/all/${userId}?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la récupération de toutes les réservations');
    }
  }

  async getStudentCourses(studentId: string) {
    try {
      const response = await blockchainApi.get(`/booking/student-courses/${studentId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la récupération des cours de l\'étudiant');
    }
  }

  async getBookingDetails(bookingId: string) {
    try {
      const response = await blockchainApi.get(`/booking/${bookingId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la récupération des détails de la réservation');
    }
  }

  async getBookingStats(userId: string) {
    try {
      const response = await blockchainApi.get(`/booking/${userId}/stats`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la récupération des statistiques');
    }
  }

  async checkBalanceBeforeBooking(amount: number): Promise<boolean> {
    try {
      const balance = await this.getBalance();
      const requiredAmount = amount * 1.01 + 5;
      
      if (balance.wallet.available < requiredAmount) {
        throw new Error(`Solde insuffisant. Disponible: ${balance.wallet.available}, Requis: ${requiredAmount}`);
      }
      
      return true;
    } catch (error: any) {
      throw error;
    }
  }

  async createBookingWithPending(data: CreateBookingData) {
    try {
      const response = await blockchainApi.post('/booking', data);
      
      if (response.data.warning || response.data.blockchainFailed) {
        console.warn('⚠️ Réservation créée mais blockchain échouée:', response.data.warning);
      }
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 402 || error.message.includes('solde')) {
        throw new Error('Solde insuffisant. Veuillez recharger votre wallet.');
      }
      
      throw new Error(error.response?.data?.message || 'Erreur lors de la création de la réservation');
    }
  }

  async confirmCourseOutcome(bookingId: string, courseHeld: boolean) {
    try {
      const response = await blockchainApi.post(`/booking/${bookingId}/confirm-outcome`, {}, {
        params: { course_held: courseHeld }
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la confirmation');
    }
  }

  // ============ REVIEW METHODS ============
  
  async submitReview(bookingId: string, reviewData: {
    targetUserId: string;
    comment: string;
    rating?: number;
  }) {
    try {
      const response = await blockchainApi.post(`/booking/${bookingId}/submit-review`, reviewData);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || error.response?.data?.message || 'Erreur lors de la soumission de l\'avis');
    }
  }

  async confirmReview(bookingId: string) {
    try {
      const response = await blockchainApi.post(`/booking/${bookingId}/confirm-review`, {});
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || error.response?.data?.message || 'Erreur lors de la confirmation de l\'avis');
    }
  }

  async getBookingReviews(bookingId: string) {
    try {
      const response = await blockchainApi.get(`/booking/${bookingId}/reviews`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la récupération des avis');
    }
  }

  // ============ SKILL EXCHANGE BOOKING METHODS ============
  
  /**
   * Créer une réservation d'échange de compétences (gratuit - 0 EDU Coins)
   */
  async createSkillExchangeBooking(data: {
    tutorId: string;
    annonceId: string;
    date: string;
    time: string;
    duration: number;
    amount?: number;
    description?: string;
    studentNotes?: string;
    isSkillExchange?: boolean;
    skillOffered?: { name: string; level: string };
    skillRequested?: { name: string; level?: string };
  }) {
    try {
      const user = getCurrentUser();
      if (!user?.id) {
        throw new Error('Utilisateur non connecté');
      }

      const response = await blockchainApi.post('/booking/skill-exchange', {
        studentId: user.id,
        tutorId: data.tutorId,
        annonceId: data.annonceId,
        date: data.date,
        time: data.time,
        duration: data.duration,
        amount: 0, // Toujours gratuit pour les échanges de compétences
        description: data.description,
        studentNotes: data.studentNotes,
        isSkillExchange: true,
        skillOffered: data.skillOffered,
        skillRequested: data.skillRequested,
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Erreur lors de la création de l\'échange');
      }

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la création de l\'échange de compétences');
    }
  }

  /**
   * Accepter un échange de compétences (par le tuteur)
   */
  async acceptSkillExchange(bookingId: string) {
    try {
      const response = await blockchainApi.patch(
        `/booking/${bookingId}/accept-exchange`
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Erreur lors de l\'acceptation');
      }

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de l\'acceptation de l\'échange');
    }
  }

  /**
   * Récupérer les échanges de compétences pour l'utilisateur courant
   */
  async getSkillExchangeBookings(filters?: { status?: string }) {
    try {
      const user = getCurrentUser();
      if (!user?.id) {
        throw new Error('Utilisateur non connecté');
      }

      const params = new URLSearchParams();
      params.append('userId', user.id);
      params.append('isSkillExchange', 'true');
      
      if (filters?.status) {
        params.append('status', filters.status);
      }

      const response = await blockchainApi.get(`/bookings?${params.toString()}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Erreur récupération échanges');
      }

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Erreur lors de la récupération des échanges');
    }
  }
}

export default new BlockchainService();