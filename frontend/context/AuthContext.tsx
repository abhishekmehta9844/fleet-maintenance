import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, getToken, setToken, clearToken } from '../lib/api';

interface AuthUser {
  id: string;
  email: string;
  role: 'manager' | 'technician';
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    apiFetch('/auth/me')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => setUser(data))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error('Incorrect email or password');
    }
    const data = await response.json();
    setToken(data.access_token);
    const meResponse = await apiFetch('/auth/me');
    const me = await meResponse.json();
    setUser(me);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
