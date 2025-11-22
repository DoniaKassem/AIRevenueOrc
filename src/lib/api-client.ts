/**
 * API Client
 *
 * Production-ready API client with:
 * - Automatic token refresh
 * - Request/response interceptors
 * - Error handling
 * - TypeScript types
 * - Token management
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// =============================================
// TYPES
// =============================================

export interface APIErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp?: string;
  path?: string;
  method?: string;
  requestId?: string;
  errors?: Record<string, string[]>;
  stack?: string;
}

export interface APISuccessResponse<T = any> {
  success: true;
  data: T;
}

export type APIResponse<T = any> = APISuccessResponse<T> | APIErrorResponse;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  id: string;
  email: string;
  organizationId: string;
  role: 'admin' | 'user' | 'viewer';
  permissions?: string[];
  name?: string | null;
  team_id?: string | null;
  teamId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// =============================================
// TOKEN STORAGE
// =============================================

class TokenStorage {
  private static ACCESS_TOKEN_KEY = 'access_token';
  private static REFRESH_TOKEN_KEY = 'refresh_token';

  static getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  static setAccessToken(token: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static setRefreshToken(token: string): void {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  static setTokens(tokens: AuthTokens): void {
    this.setAccessToken(tokens.accessToken);
    this.setRefreshToken(tokens.refreshToken);
  }

  static clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  static hasTokens(): boolean {
    return !!this.getAccessToken() && !!this.getRefreshToken();
  }
}

// =============================================
// API CLIENT
// =============================================

class APIClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = TokenStorage.getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors and refresh token
    this.client.interceptors.response.use(
      (response) => response.data,
      async (error: AxiosError<APIErrorResponse>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized - try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newAccessToken = await this.refreshAccessToken();

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            }

            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed - logout user
            TokenStorage.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        // Handle other errors
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private async refreshAccessToken(): Promise<string> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = TokenStorage.getRefreshToken();

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post<APIResponse<AuthTokens>>(
          `${this.client.defaults.baseURL}/auth/refresh`,
          { refreshToken }
        );

        if (!response.data.success) {
          throw new Error('Token refresh failed');
        }

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        TokenStorage.setTokens({
          accessToken,
          refreshToken: newRefreshToken,
        });

        return accessToken;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private handleError(error: AxiosError<APIErrorResponse>): Error {
    if (error.response?.data) {
      const apiError = error.response.data;
      const message = apiError.message || 'An error occurred';
      const customError = new Error(message) as Error & {
        statusCode?: number;
        error?: string;
        errors?: Record<string, string[]>;
      };
      customError.statusCode = apiError.statusCode;
      customError.error = apiError.error;
      customError.errors = apiError.errors;
      return customError;
    }

    if (error.request) {
      return new Error('No response from server. Please check your connection.');
    }

    return new Error(error.message || 'An unexpected error occurred');
  }

  // =============================================
  // AUTH METHODS
  // =============================================

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.client.post<APIResponse<AuthResponse>>('/auth/login', credentials);

    if (!response.success) {
      throw new Error('Login failed');
    }

    const { accessToken, refreshToken, user } = response.data;
    TokenStorage.setTokens({ accessToken, refreshToken });

    return response.data;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.client.post<APIResponse<AuthResponse>>('/auth/register', data);

    if (!response.success) {
      throw new Error('Registration failed');
    }

    const { accessToken, refreshToken, user } = response.data;
    TokenStorage.setTokens({ accessToken, refreshToken });

    return response.data;
  }

  async logout(): Promise<void> {
    TokenStorage.clearTokens();
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<APIResponse<{ user: User }>>('/me');

    if (!response.success) {
      throw new Error('Failed to get current user');
    }

    return response.data.user;
  }

  async forgotPassword(email: string): Promise<void> {
    await this.client.post('/auth/forgot-password', { email });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await this.client.post('/auth/reset-password', { token, password });
  }

  // =============================================
  // SEARCH METHODS
  // =============================================

  async search(query: {
    q: string;
    types?: string[];
    filters?: Record<string, any>;
    facets?: string[];
    page?: number;
    limit?: number;
  }): Promise<any> {
    const response = await this.client.post<APIResponse<any>>('/search', query);

    if (!response.success) {
      throw new Error('Search failed');
    }

    return response.data;
  }

  async getSavedSearches(): Promise<any[]> {
    const response = await this.client.get<APIResponse<any[]>>('/search/saved');

    if (!response.success) {
      throw new Error('Failed to get saved searches');
    }

    return response.data;
  }

  async saveSearch(name: string, query: any): Promise<void> {
    await this.client.post('/search/saved', { name, query });
  }

  // =============================================
  // NOTIFICATION METHODS
  // =============================================

  async getNotifications(params?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const response = await this.client.get<APIResponse<any[]>>('/notifications', { params });

    if (!response.success) {
      throw new Error('Failed to get notifications');
    }

    return response.data;
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await this.client.patch(`/notifications/${notificationId}/read`);
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.client.post('/notifications/mark-all-read');
  }

  async getNotificationPreferences(): Promise<any> {
    const response = await this.client.get<APIResponse<any>>('/notifications/preferences');

    if (!response.success) {
      throw new Error('Failed to get notification preferences');
    }

    return response.data;
  }

  async updateNotificationPreferences(preferences: any): Promise<void> {
    await this.client.put('/notifications/preferences', preferences);
  }

  // =============================================
  // EMAIL METHODS
  // =============================================

  async sendEmail(params: {
    to: { email: string; name?: string }[];
    subject: string;
    html: string;
    templateId?: string;
    variables?: Record<string, any>;
  }): Promise<any> {
    const response = await this.client.post<APIResponse<any>>('/email/send', params);

    if (!response.success) {
      throw new Error('Failed to send email');
    }

    return response.data;
  }

  async getEmailTemplates(): Promise<any[]> {
    const response = await this.client.get<APIResponse<any[]>>('/email/templates');

    if (!response.success) {
      throw new Error('Failed to get email templates');
    }

    return response.data;
  }

  async validateEmail(email: string): Promise<any> {
    const response = await this.client.post<APIResponse<any>>('/email/validate', { email });

    if (!response.success) {
      throw new Error('Failed to validate email');
    }

    return response.data;
  }

  async createBulkEmailCampaign(params: {
    name: string;
    templateId: string;
    recipients: Array<{ email: string; variables?: Record<string, any> }>;
    sendImmediately?: boolean;
  }): Promise<any> {
    const response = await this.client.post<APIResponse<any>>('/email/bulk', params);

    if (!response.success) {
      throw new Error('Failed to create bulk email campaign');
    }

    return response.data;
  }

  // =============================================
  // GENERIC CRUD METHODS
  // =============================================

  async get<T>(path: string, params?: any): Promise<T> {
    const response = await this.client.get<APIResponse<T>>(path, { params });

    if (!response.success) {
      throw new Error('Request failed');
    }

    return response.data;
  }

  async post<T>(path: string, data?: any): Promise<T> {
    const response = await this.client.post<APIResponse<T>>(path, data);

    if (!response.success) {
      throw new Error('Request failed');
    }

    return response.data;
  }

  async put<T>(path: string, data?: any): Promise<T> {
    const response = await this.client.put<APIResponse<T>>(path, data);

    if (!response.success) {
      throw new Error('Request failed');
    }

    return response.data;
  }

  async patch<T>(path: string, data?: any): Promise<T> {
    const response = await this.client.patch<APIResponse<T>>(path, data);

    if (!response.success) {
      throw new Error('Request failed');
    }

    return response.data;
  }

  async delete<T>(path: string): Promise<T> {
    const response = await this.client.delete<APIResponse<T>>(path);

    if (!response.success) {
      throw new Error('Request failed');
    }

    return response.data;
  }
}

// =============================================
// WEBSOCKET CLIENT (for real-time notifications)
// =============================================

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect(): void {
    const wsURL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/notifications';
    const token = TokenStorage.getAccessToken();

    if (!token) {
      console.warn('No access token available for WebSocket connection');
      return;
    }

    this.ws = new WebSocket(`${wsURL}?token=${token}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit(message.type, message.data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect();
    };
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max WebSocket reconnect attempts reached');
      return;
    }

    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Reconnecting WebSocket (attempt ${this.reconnectAttempts})...`);
      this.connect();
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

// =============================================
// EXPORTS
// =============================================

export const apiClient = new APIClient();
export const wsClient = new WebSocketClient();
export { TokenStorage };

export default apiClient;
