import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import apiClient, { User, TokenStorage, wsClient } from '../lib/api-client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, organizationName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    if (TokenStorage.hasTokens()) {
      loadCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Connect to WebSocket when user is authenticated
    if (user) {
      wsClient.connect();
    }

    return () => {
      wsClient.disconnect();
    };
  }, [user]);

  async function loadCurrentUser() {
    try {
      const currentUser = await apiClient.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to load current user:', error);
      // If loading user fails, clear tokens (they might be invalid)
      TokenStorage.clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const response = await apiClient.login({ email, password });
      setUser(response.user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string, organizationName?: string) => {
    try {
      const response = await apiClient.register({
        email,
        password,
        name,
        organizationName,
      });
      setUser(response.user);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await apiClient.logout();
      setUser(null);
      wsClient.disconnect();
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if API call fails, clear local state
      setUser(null);
      TokenStorage.clearTokens();
    }
  };

  const refreshUser = async () => {
    await loadCurrentUser();
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
