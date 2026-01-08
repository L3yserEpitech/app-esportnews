import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Backend URL configuration
// HARDCODED for production reliability
const getBackendUrl = () => {
  // Development mode - platform-specific
  if (__DEV__) {
    if (Platform.OS === 'ios') {
      console.log('🔧 [apiClient] DEV MODE - iOS - Using localhost:4000');
      return 'http://localhost:4000';
    } else if (Platform.OS === 'android') {
      console.log('🔧 [apiClient] DEV MODE - Android - Using 10.0.2.2:4000');
      return 'http://10.0.2.2:4000';
    }
  }

  // Production mode - HARDCODED URL
  console.log('🚀 [apiClient] PRODUCTION MODE - Using https://esportnews.fr/api');
  return 'https://esportnews.fr/api';
};

export const BACKEND_URL = getBackendUrl();
console.log('🌐 [apiClient] Final BACKEND_URL set to:', BACKEND_URL);

// Storage keys
const TOKEN_KEY = 'authToken';

// Create Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: BACKEND_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT token to headers
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error reading token from AsyncStorage:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors and token expiration
apiClient.interceptors.response.use(
  (response: any) => {
    return response;
  },
  async (error: any) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.removeItem(TOKEN_KEY);
      // TODO: Redirect to login screen (will be handled in AuthContext)
    }
    return Promise.reject(error);
  }
);

// Token management helpers
export const tokenManager = {
  getToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  setToken: async (token: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting token:', error);
    }
  },

  removeToken: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  },
};

export default apiClient;
