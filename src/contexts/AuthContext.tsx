import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import apiClient, { User, TokenStorage, wsClient } from '../lib/api-client';
import type { AuthUser } from '../types/database';

interface AuthContextType {
  user: User | null;
  profile: User | null; // Backward compatibility alias for user
  authUser: AuthUser | null; // Stricter auth user type with permissions
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  register: (email: string, password: string, name: string, organizationName?: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, organizationName?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auto-login for single-user mode (no authentication required)
    const mockUser: User = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'demo@example.com',
      organizationId: '00000000-0000-0000-0000-000000000001',
      role: 'admin',
      permissions: ['*'],
      name: 'Demo User',
      teamId: '00000000-0000-0000-0000-000000000001',
    };

    const mockAuthUser: AuthUser = {
      id: mockUser.id,
      email: mockUser.email,
      organizationId: mockUser.organizationId,
      role: mockUser.role,
      permissions: mockUser.permissions,
      isAdmin: true,
    };

    setUser(mockUser);
    setAuthUser(mockAuthUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    // WebSocket connection disabled for single-user mode
    // Uncomment when API server is running:
    // if (user) {
    //   wsClient.connect();
    // }
    // return () => {
    //   wsClient.disconnect();
    // };
  }, [user]);

  async function loadCurrentUser() {
    try {
      const currentUser = await apiClient.getCurrentUser();
      setUser(currentUser);

      // Create AuthUser from the User data for stricter typing
      const authUserData: AuthUser = {
        id: currentUser.id,
        email: currentUser.email,
        organizationId: currentUser.organizationId,
        role: currentUser.role as 'admin' | 'user' | 'viewer',
        permissions: currentUser.permissions || [],
        isAdmin: currentUser.role === 'admin',
      };
      setAuthUser(authUserData);
    } catch (error) {
      console.error('Failed to load current user:', error);
      // If loading user fails, clear tokens (they might be invalid)
      TokenStorage.clearTokens();
      setUser(null);
      setAuthUser(null);
    } finally {
      setLoading(false);
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const response = await apiClient.login({ email, password });
      setUser(response.user);

      // Create AuthUser from the User data for stricter typing
      const authUserData: AuthUser = {
        id: response.user.id,
        email: response.user.email,
        organizationId: response.user.organizationId,
        role: response.user.role as 'admin' | 'user' | 'viewer',
        permissions: response.user.permissions || [],
        isAdmin: response.user.role === 'admin',
      };
      setAuthUser(authUserData);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const login = signIn; // Alias for backward compatibility

  const signUp = async (email: string, password: string, name: string, organizationName?: string) => {
    try {
      const response = await apiClient.register({
        email,
        password,
        name,
        organizationName,
      });
      setUser(response.user);

      // Create AuthUser from the User data for stricter typing
      const authUserData: AuthUser = {
        id: response.user.id,
        email: response.user.email,
        organizationId: response.user.organizationId,
        role: response.user.role as 'admin' | 'user' | 'viewer',
        permissions: response.user.permissions || [],
        isAdmin: response.user.role === 'admin',
      };
      setAuthUser(authUserData);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const register = signUp; // Alias for alternative naming

  const signOut = async () => {
    try {
      await apiClient.logout();
      setUser(null);
      setAuthUser(null);
      wsClient.disconnect();
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if API call fails, clear local state
      setUser(null);
      setAuthUser(null);
      TokenStorage.clearTokens();
    }
  };

  const logout = signOut; // Alias for backward compatibility

  const refreshUser = async () => {
    await loadCurrentUser();
  };

  const value: AuthContextType = {
    user,
    profile: user, // Backward compatibility alias
    authUser,
    loading,
    isAuthenticated: !!user,
    login,
    signIn,
    logout,
    signOut,
    register,
    signUp,
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
