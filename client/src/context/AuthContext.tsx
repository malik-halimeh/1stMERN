import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken } from '../services/api.js';

export interface IUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'inventory_manager' | 'super_admin';
  addresses?: any[];
}

interface AuthContextType {
  user: IUser | null;
  setUser: React.Dispatch<React.SetStateAction<IUser | null>>;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to decode JWT access token payload safely
const decodeJwt = (token: string): { userId: string; role: string } | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      userId: payload.userId,
      role: payload.role,
    };
  } catch (err) {
    console.error('Error decoding JWT payload:', err);
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Silent Refresh on App Mount
  const silentRefresh = useCallback(async () => {
    try {
      const response = await api.post('/auth/refresh');
      const token = response.data?.data?.accessToken;
      if (token) {
        setAccessToken(token);
        const decoded = decodeJwt(token);
        if (decoded) {
          try {
            const profileRes = await api.get('/auth/profile');
            if (profileRes.data?.success) {
              const fullUser = profileRes.data.data;
              setUser({
                id: fullUser.id || decoded.userId,
                role: fullUser.role || (decoded.role as IUser['role']),
                name: fullUser.name || '',
                email: fullUser.email || '',
                addresses: fullUser.addresses || [],
              });
            } else {
              setUser({
                id: decoded.userId,
                role: decoded.role as IUser['role'],
                name: '',
                email: '',
                addresses: [],
              });
            }
          } catch {
            setUser({
              id: decoded.userId,
              role: decoded.role as IUser['role'],
              name: '',
              email: '',
              addresses: [],
            });
          }
        }
      }
    } catch (error) {
      console.log('No active session found on app mount (silent refresh bypassed).');
      setUser(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    silentRefresh();
  }, [silentRefresh]);

  // 2. Login Flow
  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken, user: userData } = response.data.data;
    setAccessToken(accessToken);
    setUser({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      addresses: userData.addresses || [],
    });
  };

  // 3. Register Flow
  const register = async (name: string, email: string, password: string) => {
    const response = await api.post('/auth/register', { name, email, password });
    const { accessToken, user: userData } = response.data.data;
    setAccessToken(accessToken);
    setUser({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      addresses: userData.addresses || [],
    });
  };

  // 4. Logout Flow
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('API logout call failed:', err);
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  // 5. Forgot Password Flow
  const forgotPassword = async (email: string) => {
    await api.post('/auth/forgot-password', { email });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        forgotPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
