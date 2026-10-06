import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi';
import { meApi } from '../api/meApi';
import { clearAccessToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app startup via silent refresh
  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const refreshRes = await authApi.refresh();
        if (refreshRes?.user && mounted) {
          setUser(refreshRes.user);
        } else if (mounted) {
          // If user object wasn't in refresh, fetch from /me
          const meData = await meApi.getProfile();
          if (mounted) setUser(meData.user);
        }
      } catch (err) {
        // No valid session, stay logged out
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    restoreSession();

    const handleSessionExpired = () => {
      setUser(null);
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      mounted = false;
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      setUser(null);
    }
  }, []);

  const updateProfileName = useCallback(async (newName) => {
    const res = await meApi.updateProfile(newName);
    if (res?.user) {
      setUser(res.user);
    } else {
      setUser((prev) => (prev ? { ...prev, name: newName } : null));
    }
    return res;
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const res = await authApi.changePassword(currentPassword, newPassword);
    setUser((prev) => (prev ? { ...prev, must_change_password: false } : null));
    return res;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        logoutAll,
        updateProfileName,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
