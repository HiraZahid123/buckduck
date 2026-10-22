'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'merchant' | 'driver' | 'admin';
  phone?: string;
  driver_online?: boolean;
  vehicle?: string;
  store?: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<User>;
  demoLogin: (role: 'customer' | 'merchant' | 'driver' | 'admin') => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('bd_token');
      const savedUser = localStorage.getItem('bd_user');
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        // Verify token in background
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
        })
          .then((res) => {
            if (res.ok) return res.json();
            if (res.status === 401) {
              logout();
            }
          })
          .then((freshUser) => {
            if (freshUser) {
              setUser(freshUser);
              localStorage.setItem('bd_user', JSON.stringify(freshUser));
            }
          })
          .catch(() => {});
      }
    } catch {
      // storage unavailable
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pass }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Login failed');
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('bd_token', data.token);
    localStorage.setItem('bd_user', JSON.stringify(data.user));
    return data.user as User;
  };

  const demoLogin = async (role: 'customer' | 'merchant' | 'driver' | 'admin') => {
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        console.warn(`Demo login for ${role} not available`);
        return;
      }
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('bd_token', data.token);
      localStorage.setItem('bd_user', JSON.stringify(data.user));
    } catch (err) {
      console.warn('Demo login failed', err);
    }
  };

  const register = async (data: any) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Registration failed');
    }
    const resData = await res.json();
    setToken(resData.token);
    setUser(resData.user);
    localStorage.setItem('bd_token', resData.token);
    localStorage.setItem('bd_user', JSON.stringify(resData.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('bd_token');
    localStorage.removeItem('bd_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, demoLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
