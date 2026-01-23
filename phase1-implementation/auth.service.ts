// Auth Service
// Handles authentication API calls and session management
// apps/web/src/services/auth.service.ts

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

interface LoginResponse {
  success: boolean;
  accessToken?: string;
  sessionToken?: string;
  user?: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
  sessionTimeout?: number;
  forcePasswordChange?: boolean;
  message?: string;
  accountLocked?: boolean;
  lockedUntil?: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

interface PasswordValidationResponse {
  success: boolean;
  strength: {
    score: number;
    label: string;
    color: string;
    feedback: string[];
    isValid: boolean;
  };
}

interface SessionStatusResponse {
  success: boolean;
  session: {
    expiresAt: string;
    lastActivity: string;
    expiringSoon: boolean;
  };
}

interface PasswordPolicy {
  success: boolean;
  policy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    sessionTimeout: number;
  };
}

class AuthService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/api/v1/auth`,
      withCredentials: true, // Important for cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add interceptor to include auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add interceptor to handle 401 (unauthorized)
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Session expired, clear storage and redirect to login
          this.handleSessionExpired();
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Login user
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await this.api.post<LoginResponse>('/login', {
        username,
        password,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await this.api.post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearSession();
    }
  }

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordRequest): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.post('/change-password', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Password change failed');
    }
  }

  /**
   * Validate password strength (real-time)
   */
  async validatePassword(password: string): Promise<PasswordValidationResponse> {
    try {
      const response = await this.api.post<PasswordValidationResponse>('/validate-password', {
        password,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Password validation failed');
    }
  }

  /**
   * Refresh session
   */
  async refreshSession(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.post('/refresh-session');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Session refresh failed');
    }
  }

  /**
   * Get session status
   */
  async getSessionStatus(): Promise<SessionStatusResponse> {
    try {
      const response = await this.api.get<SessionStatusResponse>('/session-status');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get session status');
    }
  }

  /**
   * Get password policy
   */
  async getPasswordPolicy(): Promise<PasswordPolicy> {
    try {
      const response = await this.api.get<PasswordPolicy>('/password-policy');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get password policy');
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');
    return !!(token && user);
  }

  /**
   * Get current user
   */
  getCurrentUser(): any | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Get user role
   */
  getUserRole(): string | null {
    const user = this.getCurrentUser();
    return user?.role || null;
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.getUserRole() === 'admin';
  }

  /**
   * Clear session data
   */
  clearSession(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    sessionStorage.clear();
  }

  /**
   * Handle session expired
   */
  private handleSessionExpired(): void {
    this.clearSession();
    
    // Show notification
    if (typeof window !== 'undefined') {
      alert('Your session has expired. Please login again.');
      window.location.href = '/login';
    }
  }

  /**
   * Update last activity (for session tracking)
   */
  updateLastActivity(): void {
    sessionStorage.setItem('lastActivity', new Date().toISOString());
  }

  /**
   * Get last activity
   */
  getLastActivity(): Date | null {
    const lastActivity = sessionStorage.getItem('lastActivity');
    return lastActivity ? new Date(lastActivity) : null;
  }

  /**
   * Calculate minutes since last activity
   */
  getMinutesSinceLastActivity(): number {
    const lastActivity = this.getLastActivity();
    if (!lastActivity) return 0;
    
    const now = new Date();
    const diffMs = now.getTime() - lastActivity.getTime();
    return Math.floor(diffMs / 60000);
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
