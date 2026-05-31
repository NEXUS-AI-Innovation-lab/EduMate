import api from './api';

export interface CVParseResponse {
  success: boolean;
  text?: string; // Texte brut du CV
  data?: CVData; // Résultat JSON de l'IA
  metadata?: CVMetadata;
  message?: string;
}

export interface CVData {
  personal: {
    firstName: string;
    lastName: string;
    email: string[];
    phone: string[];
    address?: string;
    birthDate?: string;
    gender?: string;
    nationality?: string;
    linkedin?: string;
    github?: string;
  };
  education: Education[];
  experience: Experience[];
  skills: SkillCategory;
  summary?: string;
  certifications?: string[];
  projects?: string[];
  languages?: string[];
  validation?: {
    quality: string;
    confidence: number;
    extractionDate: string;
  };
}

export interface Education {
  educationLevel: string;
  diplomaName?: string;
  field: string;
  school: string;
  country?: string;
  city?: string;
  startYear?: number;
  endYear?: number;
  isCurrent?: boolean;
  description?: string;
  gpa?: number;
}

export interface Experience {
  jobTitle: string;
  employmentType?: string;
  company: string;
  location?: string;
  startMonth?: string;
  startYear?: number;
  endMonth?: string;
  endYear?: number;
  isCurrent?: boolean;
  description?: string;
  achievements?: string[];
  technologies?: string[];
}

export interface SkillCategory {
  technical: string[];
  languages?: string[];
  soft?: string[];
  tools?: string[];
  frameworks?: string[];
}

export interface CVMetadata {
  filename?: string;
  originalFilename?: string;
  userId?: string;
  processingMode?: 'MEMORY_ONLY';
  textLength?: number;
  quality?: string;
  confidence?: number;
  extractionDate?: string;
}

class CVService {
  private baseURL = import.meta.env.VITE_CV_SERVICE_URL || '/api/cv';

  private getAuthHeader(): Record<string, string> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Token manquant. Connectez-vous.');
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Analyse un fichier CV
   * Étapes :
   * 1️⃣ Extraire le texte brut
   * 2️⃣ Loguer le texte
   * 3️⃣ Envoyer à l'IA pour extraction JSON
   */
  async parseCV(file: File, language = 'fr'): Promise<CVParseResponse> {
    console.log(`📤 Envoi du CV: ${file.name} (${file.size} bytes)`);

    const formData = new FormData();
    formData.append('cv', file);
    formData.append('language', language);

    try {
      const response = await fetch(`${this.baseURL}/parse`, {
        method: 'POST',
        body: formData,
        headers: this.getAuthHeader(),
      });

      console.log('📥 Réponse reçue, status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
      }

      const data: CVParseResponse = await response.json();

      // Log du texte brut
      if (data.text) {
        console.log(`📝 Contenu brut du CV (${file.name}):\n${data.text.slice(0, 5000)}${data.text.length > 5000 ? '...' : ''}`);
      }

      // Log du JSON extrait par l'IA
      if (data.data) {
        console.log('📊 JSON extrait par l’IA:', JSON.stringify(data.data, null, 2));
      }

      return data;
    } catch (err: any) {
      console.error('❌ Erreur parseCV:', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Analyse directement du texte CV
   */
  async parseCVText(text: string, language = 'fr'): Promise<CVParseResponse> {
    console.log('📤 Envoi du texte CV à l’IA pour analyse...');
    console.log('📝 Contenu texte (500 premiers caractères):', text.slice(0, 500));

    try {
      const response = await fetch(`${this.baseURL}/parse-text`, {
        method: 'POST',
        headers: { ...this.getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
      }

      const data: CVParseResponse = await response.json();

      if (data.data) console.log('📊 JSON extrait par l’IA:', JSON.stringify(data.data, null, 2));
      return data;
    } catch (err: any) {
      console.error('❌ Erreur parseCVText:', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Analyse plusieurs CV en batch
   */
  async batchParseCVs(files: File[], language = 'fr'): Promise<CVParseResponse> {
    console.log(`📤 Analyse batch de ${files.length} CV(s)`);

    const formData = new FormData();
    files.forEach(f => formData.append('cvs', f));
    formData.append('language', language);

    try {
      const response = await fetch(`${this.baseURL}/batch-parse`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: formData,
      });

      if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);

      const data = await response.json();
      console.log('📊 Résultats batch:', data);
      return data;
    } catch (err: any) {
      console.error('❌ Erreur batchParseCVs:', err);
      return { success: false, message: err.message };
    }
  }
}

export default new CVService();
