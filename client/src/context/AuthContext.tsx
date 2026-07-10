import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { setAccessToken, refreshAccessToken } from '../services/api.js';

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
  register: (name: string, email: string, password: string) => Promise<{ requiresVerification: boolean; email: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
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

  // Bumped on every explicit auth action (login/register/logout). A silent
  // refresh that started before the bump must not overwrite the newer state —
  // otherwise a slow mount-time refresh failing AFTER a successful login
  // clears the fresh session and forces the user to log in a second time.
  const sessionEpochRef = useRef(0);

  // 1. Silent Refresh on App Mount
  const silentRefresh = useCallback(async () => {
    const epochAtStart = sessionEpochRef.current;
    const isStale = () => sessionEpochRef.current !== epochAtStart;
    try {
      // Single-flight: shares any in-flight refresh (e.g. StrictMode's
      // double-mount or an interceptor-triggered refresh) instead of firing
      // a second rotation that the server would flag as token reuse.
      const token = await refreshAccessToken();
      if (token && !isStale()) {
        const decoded = decodeJwt(token);
        if (decoded) {
          try {
            const profileRes = await api.get('/auth/profile');
            if (isStale()) return;
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
            if (!isStale()) {
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
      }
    } catch (error) {
      console.log('No active session found on app mount (silent refresh bypassed).');
      // Only clear state when no login/register beat this refresh to it
      if (!isStale()) {
        setUser(null);
        setAccessToken(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    silentRefresh();
  }, [silentRefresh]);

  // Apply a fresh session returned by login / verify-email / google
  const applySession = (data: { accessToken: string; user: any }) => {
    sessionEpochRef.current += 1; // invalidate any in-flight silent refresh
    setAccessToken(data.accessToken);
    setUser({
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      addresses: data.user.addresses || [],
    });
  };

  // 2. Login Flow
  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    applySession(response.data.data);
  };

  // 3. Register Flow — creates a PENDING account; the emailed code must be
  // confirmed via verifyEmail() before a session is opened.
  const register = async (name: string, email: string, password: string) => {
    const response = await api.post('/auth/register', { name, email, password });
    return {
      requiresVerification: !!response.data.data.requiresVerification,
      email: response.data.data.email || email,
    };
  };

  // 3b. Confirm the signup verification code → opens the session
  const verifyEmail = async (email: string, code: string) => {
    const response = await api.post('/auth/verify-email', { email, code });
    applySession(response.data.data);
  };

  // 3c. Request a fresh verification code
  const resendVerification = async (email: string) => {
    await api.post('/auth/resend-verification', { email });
  };

  // 3d. Google sign-in (GSI ID token) → opens the session
  const loginWithGoogle = async (credential: string) => {
    const response = await api.post('/auth/google', { credential });
    applySession(response.data.data);
  };

  // 4. Logout Flow
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('API logout call failed:', err);
    } finally {
      sessionEpochRef.current += 1;
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
        verifyEmail,
        resendVerification,
        loginWithGoogle,
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
