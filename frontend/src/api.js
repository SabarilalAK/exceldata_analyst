// Centralized API Base URL configuration for local and cloud deployment
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
