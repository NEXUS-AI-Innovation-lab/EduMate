// api.ts
import axios, { AxiosError } from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "/api";

// Instance Axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ======================
// INTERCEPTEUR REQUEST
// ======================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    // Ajouter le token UNIQUEMENT s'il existe
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ======================
// INTERCEPTEUR RESPONSE
// ======================
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Session invalide → nettoyage et redirection
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      // Émettre un événement global pour notifier l'app
      window.dispatchEvent(new Event('auth:logout'));
      
      // Rediriger vers la page de connexion si on n'y est pas déjà
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/connexion')) {
        window.location.href = '/connexion';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
