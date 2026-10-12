import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { isFirebaseReady, auth, provider, signInWithPopup, fbSignOut, onAuthStateChanged } from '../services/firebase';
import { authService } from '../services/authService';
import { logger } from '../utils/logger';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  isFirebase: boolean;
  isAdmin: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isFirebaseUser: boolean;
  loginWithGoogle: () => Promise<{ success: boolean; message: string; user?: AuthUser }>;
  loginOffline: (username: string, passwordPlain: string) => Promise<{ success: boolean; message: string }>;
  registerOffline: (username: string, displayName: string, passwordPlain: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize and listen to Firebase Auth
  useEffect(() => {
    let isMounted = true;

    if (!isFirebaseReady() || !auth) {
      // Offline/local only fallback
      const activeUser = localStorage.getItem('zigame_active_user');
      if (activeUser && isMounted) {
        setUser({
          uid: 'local_' + activeUser,
          email: null,
          displayName: activeUser.toUpperCase(),
          photoURL: null,
          isAnonymous: true,
          isFirebase: false,
          isAdmin: false
        });
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: any) => {
      if (!isMounted) return;

      if (fbUser) {
        try {
          // Inspect Custom Claims for authoritative admin verification
          const tokenResult = await fbUser.getIdTokenResult();
          const hasAdminClaim = Boolean(tokenResult?.claims?.admin === true || tokenResult?.claims?.role === 'admin');

          // Check server authority
          let serverIsAdmin = hasAdminClaim;
          try {
            const token = tokenResult.token;
            const res = await fetch('/api/admin/verify', {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              serverIsAdmin = Boolean(data.isAdmin);
            }
          } catch {
            // fallback to token claim
          }

          const authUser: AuthUser = {
            uid: fbUser.uid,
            email: fbUser.email || null,
            displayName: fbUser.displayName || 'Player',
            photoURL: fbUser.photoURL || null,
            isAnonymous: Boolean(fbUser.isAnonymous),
            isFirebase: true,
            isAdmin: serverIsAdmin
          };

          if (isMounted) {
            setUser(authUser);
            localStorage.setItem('zigame_active_user', fbUser.uid);
          }
        } catch (err) {
          logger.warn('Error reading auth state token claims', { error: err });
          if (isMounted) {
            setUser({
              uid: fbUser.uid,
              email: fbUser.email || null,
              displayName: fbUser.displayName || 'Player',
              photoURL: fbUser.photoURL || null,
              isAnonymous: Boolean(fbUser.isAnonymous),
              isFirebase: true,
              isAdmin: false
            });
          }
        }
      } else {
        // No Firebase user; check if local offline guest profile exists
        const activeLocal = localStorage.getItem('zigame_active_user');
        if (activeLocal && isMounted && !activeLocal.startsWith('fb_') && activeLocal.length < 32) {
          setUser({
            uid: 'local_' + activeLocal,
            email: null,
            displayName: activeLocal.toUpperCase(),
            photoURL: null,
            isAnonymous: true,
            isFirebase: false,
            isAdmin: false
          });
        } else if (isMounted) {
          setUser(null);
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (isFirebaseReady() && auth?.currentUser) {
      try {
        return await auth.currentUser.getIdToken();
      } catch (err) {
        logger.warn('Failed to retrieve Firebase ID token', { error: err });
      }
    }
    return null;
  }, []);

  const loginWithGoogle = useCallback(async (): Promise<{ success: boolean; message: string; user?: AuthUser }> => {
    if (!isFirebaseReady() || !auth || !provider) {
      return { success: false, message: 'Firebase Authentication tidak tersedia di lingkungan ini.' };
    }

    try {
      setLoading(true);
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;

      const tokenResult = await fbUser.getIdTokenResult();
      const hasAdminClaim = Boolean(tokenResult?.claims?.admin === true || tokenResult?.claims?.role === 'admin');

      const authUser: AuthUser = {
        uid: fbUser.uid,
        email: fbUser.email || null,
        displayName: fbUser.displayName || 'Player',
        photoURL: fbUser.photoURL || null,
        isAnonymous: false,
        isFirebase: true,
        isAdmin: hasAdminClaim
      };

      setUser(authUser);
      localStorage.setItem('zigame_active_user', fbUser.uid);

      return {
        success: true,
        message: `Selamat datang, ${authUser.displayName}!`,
        user: authUser
      };
    } catch (err: any) {
      logger.error('Google login failed', { error: err });
      return {
        success: false,
        message: err?.message || 'Gagal masuk dengan Google.'
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const loginOffline = useCallback(async (username: string, passwordPlain: string): Promise<{ success: boolean; message: string }> => {
    const res = await authService.loginLocal(username, passwordPlain, {
      profile: { name: username.toUpperCase(), avatar: '👾', colorTheme: '#ef4444', coins: 100 },
      games: [],
      achievements: [],
      recentlyPlayed: []
    });

    if (res.success && res.session) {
      const cleanUser = username.trim().toLowerCase();
      const offlineUser: AuthUser = {
        uid: 'local_' + cleanUser,
        email: null,
        displayName: res.session.displayName || cleanUser.toUpperCase(),
        photoURL: null,
        isAnonymous: true,
        isFirebase: false,
        isAdmin: false
      };
      setUser(offlineUser);
      localStorage.setItem('zigame_active_user', cleanUser);
    }

    return { success: res.success, message: res.message };
  }, []);

  const registerOffline = useCallback(async (username: string, displayName: string, passwordPlain: string): Promise<{ success: boolean; message: string }> => {
    const res = await authService.registerLocal(username, displayName, passwordPlain, {
      profile: { name: displayName.trim().toUpperCase() || username.toUpperCase(), avatar: '👾', colorTheme: '#ef4444', coins: 100 },
      games: [],
      achievements: [],
      recentlyPlayed: []
    });

    if (res.success && res.session) {
      const cleanUser = username.trim().toLowerCase();
      const offlineUser: AuthUser = {
        uid: 'local_' + cleanUser,
        email: null,
        displayName: res.session.displayName || cleanUser.toUpperCase(),
        photoURL: null,
        isAnonymous: true,
        isFirebase: false,
        isAdmin: false
      };
      setUser(offlineUser);
      localStorage.setItem('zigame_active_user', cleanUser);
    }

    return { success: res.success, message: res.message };
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    if (isFirebaseReady() && auth) {
      try {
        await fbSignOut(auth);
      } catch (err) {
        logger.warn('Firebase signout warning', { error: err });
      }
    }

    localStorage.removeItem('zigame_active_user');
    sessionStorage.clear();
    setUser(null);
    await authService.logout();
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    loading,
    isAdmin: Boolean(user?.isAdmin),
    isAuthenticated: Boolean(user && user.isFirebase),
    isFirebaseUser: Boolean(user?.isFirebase),
    loginWithGoogle,
    loginOffline,
    registerOffline,
    logout,
    getIdToken
  }), [user, loading, loginWithGoogle, loginOffline, registerOffline, logout, getIdToken]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
