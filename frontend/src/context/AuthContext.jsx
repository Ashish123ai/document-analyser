import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authService } from '../services/index.js';
import { tokenStore } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, confirm any stored token is still valid with the server (token/session validation).
  useEffect(() => {
    if (!tokenStore.getAccess() && !tokenStore.getRefresh()) {
      setLoading(false);
      return;
    }
    authService
      .validate()
      .then((res) => setUser(res.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  // The axios interceptor fires this when a refresh fails (session expired or revoked).
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const completeSignIn = useCallback((res) => {
    tokenStore.set(res);
    setUser(res.user);
    return res.user;
  }, []);

  const login = useCallback(async (email, password) => completeSignIn(await authService.login({ email, password })), [completeSignIn]);
  const register = useCallback(async (body) => completeSignIn(await authService.register(body)), [completeSignIn]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* local sign-out proceeds even if the server call fails */
    }
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
