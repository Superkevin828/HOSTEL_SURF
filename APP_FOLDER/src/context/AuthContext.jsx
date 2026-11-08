import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  api,
  homeFor,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  session as sessionStore,
  subscribeSession,
} from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => sessionStore.get());

  useEffect(() => subscribeSession(() => setSession(sessionStore.get())), []);

  const login = useCallback(async (email, password) => {
    const profile = await apiLogin(email, password);
    setSession(sessionStore.get());
    return profile;
  }, []);

  const register = useCallback(async (fields) => {
    const profile = await apiRegister(fields);
    setSession(sessionStore.get());
    return profile;
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setSession(null);
  }, []);

  const setProfile = useCallback((profile) => {
    const current = sessionStore.get();
    if (!current) return;
    sessionStore.set({ ...current, profile });
    setSession(sessionStore.get());
  }, []);

  const refreshProfile = useCallback(async () => {
    const result = await api('/auth/me');
    setProfile(result.profile);
    return result.profile;
  }, [setProfile]);

  const value = useMemo(
    () => ({
      session,
      profile: session && session.profile ? session.profile : null,
      isAuthenticated: Boolean(session && session.access_token),
      login,
      register,
      logout,
      setProfile,
      refreshProfile,
    }),
    [session, login, register, logout, setProfile, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function useRequireRole(role) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!profile) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
      return;
    }
    if (profile.role !== role) navigate(homeFor(profile.role), { replace: true });
  }, [profile, role, navigate, location.pathname]);

  return profile && profile.role === role ? profile : null;
}
