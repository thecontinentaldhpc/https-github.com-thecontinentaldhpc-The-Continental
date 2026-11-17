import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { api } from '../lib/api';
import type { AuthUser, Category, SavedArticleItem, SiteSettings } from '../types/publication';
import { useIstClock, type LiveIstClock } from '../hooks/useIstClock';
import type { IstDateParts } from '../lib/dateIst';
import { isAdminEmail, isNotificationRecipientEmail } from '../lib/editorialRules';
import {
  auth,
  clearCachedGmailToken,
  createAdminNotificationInFirestore,
  googleAuthProvider,
  removeSavedArticleFromFirestore,
  saveArticleForLaterInFirestore,
  subscribeSavedArticlesFromFirestore,
  syncUserProfileToFirestore,
} from '../lib/firebase';
import {
  hasSavedArticle,
  removeSavedArticleFromList,
  type SavedArticleInput,
  upsertSavedArticleInList,
} from '../lib/readingList';
import {
  type ThemeMode,
  applyThemeToRoot,
  getNextTheme,
  persistTheme,
  readStoredTheme,
} from '../lib/theme';
import { notifyViaWeb3FormsInBackground } from '../lib/web3forms';

const DEFAULT_SETTINGS: SiteSettings = {
  publication_name: 'THE CONTINENTAL',
  tagline: 'Independent Journalism. Informed World.',
  motto: 'Truth Without Fear. Facts Without Favour.',
  location_label: 'INTERNATIONAL EDITION',
  launch_notice_enabled: true,
  launch_notice_text: 'Inaugural Daily E-Paper launches 1 January 2027 · Monthly Magazine Issue No. 1 arrives January 2027.',
  breaking_ticker_enabled: true,
  seo_default_title: 'THE CONTINENTAL — Independent Journalism. Informed World.',
  seo_default_description: 'Independent digital newspaper and monthly magazine. Truth Without Fear. Facts Without Favour.',
  about_story: 'THE CONTINENTAL is an independent digital newspaper and magazine committed to delivering credible, informative and accessible journalism.',
  about_mission: 'To inform readers through accurate reporting, thoughtful analysis and responsible journalism.',
  about_vision: 'To build a trusted independent publication connecting readers with important developments across the world.',
  editorial_policy: '',
  corrections_policy: '',
  privacy_policy: '',
  terms_conditions: '',
};

interface SiteContextValue {
  categories: Category[];
  settings: SiteSettings;
  istDate: LiveIstClock;
  editionUpdatedAt: string | null;
  setEditionUpdatedAt: (iso: string | null) => void;
  loading: boolean;
  refreshSiteData: () => Promise<void>;
  user: AuthUser | null;
  authLoading: boolean;
  needsSetup: boolean;
  isAdmin: boolean;
  isNotificationRecipient: boolean;
  refreshAuth: () => Promise<void>;
  registerUser: (payload: { fullName: string; email: string; password: string }) => Promise<AuthUser>;
  loginWithPassword: (payload: { email: string; password: string }) => Promise<AuthUser>;
  signInWithGoogle: () => Promise<AuthUser>;
  completeFirebaseUserLogin: (fbUser: FirebaseUser, displayName?: string) => Promise<AuthUser>;
  signOutUser: () => Promise<void>;
  loginModalOpen: boolean;
  loginModalRedirect: string | null;
  openLoginModal: (redirectTo?: string | null) => void;
  closeLoginModal: () => void;
  readingList: SavedArticleItem[];
  readingListLoading: boolean;
  isArticleSaved: (articleId: string | null | undefined) => boolean;
  toggleSaveArticle: (article: SavedArticleInput) => Promise<boolean>;
  removeSavedArticle: (articleId: string) => Promise<void>;
  refreshReadingList: () => Promise<void>;
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [serverIst, setServerIst] = useState<IstDateParts | undefined>(undefined);
  const [editionUpdatedAt, setEditionUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalRedirect, setLoginModalRedirect] = useState<string | null>(null);
  const [readingList, setReadingList] = useState<SavedArticleItem[]>([]);
  const [readingListLoading, setReadingListLoading] = useState(false);
  const [firebaseAuthUid, setFirebaseAuthUid] = useState<string | null>(() => auth.currentUser?.uid || null);
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme());
  const istDate = useIstClock(serverIst);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseAuthUid(fbUser?.uid || null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    applyThemeToRoot(document.documentElement, theme);
    persistTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => getNextTheme(prev));
  }, []);

  const openLoginModal = useCallback((redirectTo?: string | null) => {
    setLoginModalRedirect(redirectTo || null);
    setLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setLoginModalOpen(false);
    setLoginModalRedirect(null);
  }, []);

  const refreshSiteData = useCallback(async () => {
    try {
      const data = await api.getSiteData();
      setCategories(data.categories);
      setSettings((prev) => ({ ...prev, ...data.settings }));
      setServerIst(data.istDate);
      if (data.editionUpdatedAt) {
        setEditionUpdatedAt(data.editionUpdatedAt);
      }
    } catch (err) {
      console.error('Failed to load site metadata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const status = await api.getAuthStatus();
      setNeedsSetup(status.needsSetup);
      setUser(status.user);
    } catch (err) {
      console.error('Failed to check auth status:', err);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSiteData();
    refreshAuth();
  }, [refreshSiteData, refreshAuth]);

  useEffect(() => {
    const handleNewsUpdated = (evt: Event) => {
      const custom = evt as CustomEvent<{ editionUpdatedAt?: string }>;
      if (custom.detail?.editionUpdatedAt) {
        setEditionUpdatedAt(custom.detail.editionUpdatedAt);
      } else {
        void refreshSiteData();
      }
    };
    window.addEventListener('tc:news-updated', handleNewsUpdated);
    return () => window.removeEventListener('tc:news-updated', handleNewsUpdated);
  }, [refreshSiteData]);

  const refreshReadingList = useCallback(async () => {
    if (!user) {
      setReadingList([]);
      setReadingListLoading(false);
      return;
    }
    setReadingListLoading(true);
    try {
      const res = await api.getReadingList();
      setReadingList(res.items);
    } catch (err) {
      console.error('Failed to load reading list:', err);
    } finally {
      setReadingListLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setReadingList([]);
      setReadingListLoading(false);
      return;
    }

    if (firebaseAuthUid && user.uid && firebaseAuthUid === user.uid) {
      setReadingListLoading(true);
      let cancelled = false;
      const unsub = subscribeSavedArticlesFromFirestore(
        user.uid,
        (items) => {
          if (!cancelled) {
            setReadingList(items);
            setReadingListLoading(false);
          }
        },
        () => {
          if (!cancelled) {
            void refreshReadingList();
          }
        }
      );
      return () => {
        cancelled = true;
        unsub();
      };
    }

    void refreshReadingList();
  }, [user, firebaseAuthUid, refreshReadingList]);

  const registerUser = useCallback(
    async (payload: { fullName: string; email: string; password: string }): Promise<AuthUser> => {
      const res = await api.registerUser(payload);
      setUser(res.user);
      setAuthLoading(false);
      notifyViaWeb3FormsInBackground({
        eventType: 'New Registration',
        userName: res.user.fullName,
        userEmail: res.user.email,
        subject: `[THE CONTINENTAL] New Registration — ${res.user.fullName} (${res.user.email})`,
        message: `${res.user.fullName} (${res.user.email}) registered a new contributor account on THE CONTINENTAL.`,
        metadata: {
          'Auth Method': 'Email Registration',
          Role: res.user.role,
        },
      });
      return res.user;
    },
    []
  );

  const loginWithPassword = useCallback(
    async (payload: { email: string; password: string }): Promise<AuthUser> => {
      const res = await api.loginAdmin(payload);
      setUser(res.user);
      setNeedsSetup(false);
      setAuthLoading(false);
      notifyViaWeb3FormsInBackground({
        eventType: 'New Login',
        userName: res.user.fullName,
        userEmail: res.user.email,
        subject: `[THE CONTINENTAL] New Login — ${res.user.fullName} (${res.user.email})`,
        message: `${res.user.fullName} (${res.user.email}) signed into THE CONTINENTAL via Email & Password.`,
        metadata: {
          'Auth Method': 'Email & Password',
          Role: res.user.role,
        },
      });
      return res.user;
    },
    []
  );

  const completeFirebaseUserLogin = useCallback(
    async (fbUser: FirebaseUser, displayName?: string): Promise<AuthUser> => {
      const idToken = await fbUser.getIdToken();
      const res = await api.loginWithFirebaseToken(idToken, displayName);
      setUser(res.user);
      setNeedsSetup(false);
      setAuthLoading(false);

      const resolvedName = displayName || fbUser.displayName || res.user.fullName;
      const authMethod = fbUser.phoneNumber && !fbUser.email ? 'Phone OTP' : 'Google Sign-In';
      notifyViaWeb3FormsInBackground({
        eventType: 'New Login',
        userName: resolvedName,
        userEmail: res.user.email || fbUser.email,
        userPhone: res.user.phoneNumber || fbUser.phoneNumber,
        subject: `[THE CONTINENTAL] New Login — ${resolvedName} (${res.user.email || res.user.phoneNumber || 'User'})`,
        message: `${resolvedName} (${res.user.email || res.user.phoneNumber || 'User'}) signed into THE CONTINENTAL via ${authMethod}.`,
        metadata: {
          'Auth Method': authMethod,
          Role: res.user.role,
        },
      });

      const contact = fbUser.email || fbUser.phoneNumber || '';
      if (contact) {
        void syncUserProfileToFirestore({
          uid: fbUser.uid,
          email: fbUser.email,
          phoneNumber: fbUser.phoneNumber,
          displayName: resolvedName,
          emailVerified: Boolean(fbUser.emailVerified || fbUser.phoneNumber),
        }).catch((err) => console.error('Firestore profile sync skipped:', err));

        void createAdminNotificationInFirestore({
          id: crypto.randomUUID(),
          eventType: 'user_login',
          actorUid: fbUser.uid,
          actorEmail: contact,
          actorName: resolvedName,
          subject: `Reader Login Alert: ${resolvedName} (${contact})`,
          message: `${resolvedName} (${contact}) signed into THE CONTINENTAL.`,
        }).catch((err) => console.error('Firestore notification write skipped:', err));
      }

      return res.user;
    },
    []
  );

  const signInWithGoogle = useCallback(async (): Promise<AuthUser> => {
    const credential = await signInWithPopup(auth, googleAuthProvider);
    return completeFirebaseUserLogin(credential.user);
  }, [completeFirebaseUserLogin]);

  const signOutUser = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Firebase sign out warning:', err);
    }
    clearCachedGmailToken();
    await api.logoutAdmin();
    setUser(null);
    setReadingList([]);
  }, []);

  const isArticleSaved = useCallback(
    (articleId: string | null | undefined) => hasSavedArticle(readingList, articleId),
    [readingList]
  );

  const saveArticleForUser = useCallback(
    async (article: SavedArticleInput): Promise<SavedArticleItem> => {
      if (!user) {
        throw new Error('Sign in to save articles to your reading list.');
      }
      if (firebaseAuthUid && user.uid && firebaseAuthUid === user.uid) {
        try {
          return await saveArticleForLaterInFirestore(user.uid, article);
        } catch (err) {
          console.warn('Client Firestore save fallback to API:', err);
        }
      }
      const res = await api.saveToReadingList(article.id);
      return res.item;
    },
    [user, firebaseAuthUid]
  );

  const removeSavedArticle = useCallback(
    async (articleId: string): Promise<void> => {
      if (!user) {
        throw new Error('Sign in to manage your reading list.');
      }
      setReadingList((prev) => removeSavedArticleFromList(prev, articleId));
      try {
        if (firebaseAuthUid && user.uid && firebaseAuthUid === user.uid) {
          try {
            await removeSavedArticleFromFirestore(user.uid, articleId);
            return;
          } catch (err) {
            console.warn('Client Firestore remove fallback to API:', err);
          }
        }
        await api.removeFromReadingList(articleId);
      } catch (err) {
        await refreshReadingList();
        throw err;
      }
    },
    [user, firebaseAuthUid, refreshReadingList]
  );

  const toggleSaveArticle = useCallback(
    async (article: SavedArticleInput): Promise<boolean> => {
      if (!user) {
        throw new Error('Sign in to save articles to your reading list.');
      }
      const currentlySaved = hasSavedArticle(readingList, article.id);
      if (currentlySaved) {
        await removeSavedArticle(article.id);
        return false;
      }
      const savedItem = await saveArticleForUser(article);
      setReadingList((prev) => upsertSavedArticleInList(prev, savedItem));
      return true;
    },
    [user, readingList, removeSavedArticle, saveArticleForUser]
  );

  const isAdmin = Boolean(user && user.role === 'super_admin' && isAdminEmail(user.email));
  const isNotificationRecipient = Boolean(user && user.email && isNotificationRecipientEmail(user.email));

  return (
    <SiteContext.Provider
      value={{
        categories,
        settings,
        istDate,
        editionUpdatedAt,
        setEditionUpdatedAt,
        loading,
        refreshSiteData,
        user,
        authLoading,
        needsSetup,
        isAdmin,
        isNotificationRecipient,
        refreshAuth,
        registerUser,
        loginWithPassword,
        signInWithGoogle,
        completeFirebaseUserLogin,
        signOutUser,
        loginModalOpen,
        loginModalRedirect,
        openLoginModal,
        closeLoginModal,
        readingList,
        readingListLoading,
        isArticleSaved,
        toggleSaveArticle,
        removeSavedArticle,
        refreshReadingList,
        theme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error('useSite must be used inside SiteProvider');
  }
  return ctx;
}
