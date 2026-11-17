import type {
  AdminNotification,
  Article,
  AuditLog,
  Author,
  AuthUser,
  Category,
  ContactMessage,
  EpaperEdition,
  MagazineIssue,
  MediaAsset,
  NewsletterSubscriber,
  PublicSubmission,
  SavedArticleItem,
  SiteSettings,
} from '../types/publication';
import type { IstDateParts } from './dateIst';
import { getWeb3FormsAccessKey } from './web3forms';

const SESSION_TOKEN_KEY = 'tc_session_token';

export function getSessionToken(): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(SESSION_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (token) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Storage may be restricted in sandboxed frames; cookie auth still applies.
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getSessionToken();
  const hasClientWeb3FormsKey = Boolean(getWeb3FormsAccessKey());
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(hasClientWeb3FormsKey ? { 'X-Web3Forms-Client-Dispatched': '1' } : {}),
      ...(options?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && url !== '/api/auth/login') {
      setSessionToken(null);
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getSiteData: () =>
    request<{
      categories: Category[];
      settings: SiteSettings;
      istDate: IstDateParts;
      editionUpdatedAt: string;
      serverTimeIso: string;
    }>('/api/site-data'),

  getHomepage: () =>
    request<{
      breaking: Article[];
      lead: Article | null;
      topStories: Article[];
      sections: {
        world: Article[];
        india: Article[];
        regional: Article[];
        politics: Article[];
        business: Article[];
        economy: Article[];
        education: Article[];
        scienceTechnology: Article[];
        environment: Article[];
        sports: Article[];
        opinion: Article[];
        editorial: Article[];
      };
      latestNews: Article[];
      latestMagazine: MagazineIssue | null;
      latestEpaper: EpaperEdition | null;
      editionUpdatedAt: string;
      serverTimeIso: string;
    }>('/api/homepage'),

  getArticles: (params: { category?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params.category) sp.set('category', params.category);
    if (params.page) sp.set('page', String(params.page));
    if (params.limit) sp.set('limit', String(params.limit));
    return request<{
      articles: Article[];
      editionUpdatedAt?: string;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/articles?${sp.toString()}`);
  },

  getArticleBySlug: (slug: string) =>
    request<{ article: Article; related: Article[] }>(`/api/articles/${encodeURIComponent(slug)}`),

  getReadingList: () => request<{ items: SavedArticleItem[] }>('/api/reading-list'),
  saveToReadingList: (articleId: string) =>
    request<{ item: SavedArticleItem }>('/api/reading-list', {
      method: 'POST',
      body: JSON.stringify({ articleId }),
    }),
  removeFromReadingList: (articleId: string) =>
    request<{ ok: boolean }>(`/api/reading-list/${encodeURIComponent(articleId)}`, {
      method: 'DELETE',
    }),

  uploadPublicImage: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ url: string; originalName: string; sizeBytes: number }>('/api/upload/public-image', {
      method: 'POST',
      body: fd,
    });
  },

  submitWriting: (payload: {
    full_name: string;
    email: string;
    title: string;
    category_id: string;
    short_description: string;
    content: string;
    featured_image_url?: string | null;
    author_bio: string;
    originality_confirmed: boolean;
    terms_accepted: boolean;
    website_honeypot?: string;
  }) =>
    request<{ submissionId: string; status: string; message: string }>('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMagazines: () => request<{ magazines: MagazineIssue[] }>('/api/magazines'),

  getEpaper: () => request<{ editions: EpaperEdition[] }>('/api/epaper'),

  search: (params: {
    q?: string;
    category?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.category) sp.set('category', params.category);
    if (params.type) sp.set('type', params.type);
    if (params.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params.dateTo) sp.set('dateTo', params.dateTo);
    if (params.page) sp.set('page', String(params.page));
    return request<{
      results: Array<{
        resultType: 'article' | 'magazine' | 'epaper';
        id: string;
        title: string;
        subtitle: string;
        summary: string;
        url: string;
        category: string;
        date: string;
        imageUrl: string | null;
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/search?${sp.toString()}`);
  },

  subscribeNewsletter: (email: string, consent: boolean) =>
    request<{ message: string }>('/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email, consent }),
    }),

  unsubscribeNewsletter: (email: string) =>
    request<{ message: string }>('/api/newsletter/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  sendContact: (payload: { name: string; email: string; subject: string; message: string }) =>
    request<{ id: string; message: string }>('/api/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Auth
  getAuthStatus: () =>
    request<{
      needsSetup: boolean;
      authenticated: boolean;
      user: AuthUser | null;
      admin: AuthUser | null;
    }>('/api/auth/status'),

  registerUser: async (payload: { fullName: string; email: string; password: string }) => {
    const res = await request<{ user: AuthUser; admin: AuthUser | null; sessionToken?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.sessionToken) setSessionToken(res.sessionToken);
    return res;
  },

  loginWithFirebaseToken: async (idToken: string, displayName?: string) => {
    const res = await request<{ user: AuthUser; admin: AuthUser | null; sessionToken?: string }>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken, displayName }),
    });
    if (res.sessionToken) setSessionToken(res.sessionToken);
    return res;
  },

  setupAdmin: async (payload: { fullName: string; email: string; password: string }) => {
    const res = await request<{ user: AuthUser; admin: AuthUser; sessionToken?: string }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.sessionToken) setSessionToken(res.sessionToken);
    return res;
  },

  loginAdmin: async (payload: { email: string; password: string }) => {
    const res = await request<{ user: AuthUser; admin: AuthUser | null; sessionToken?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.sessionToken) setSessionToken(res.sessionToken);
    return res;
  },

  logoutAdmin: async () => {
    try {
      return await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    } finally {
      setSessionToken(null);
    }
  },

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Admin
  adminOverview: () =>
    request<{
      counts: {
        totalArticles: number;
        publishedArticles: number;
        draftArticles: number;
        scheduledArticles: number;
        pendingSubmissions: number;
        approvedSubmissions: number;
        magazineIssues: number;
        epaperEditions: number;
        subscribers: number;
        unreadMessages: number;
        unreadNotifications: number;
      };
      recentActivity: AuditLog[];
    }>('/api/admin/overview'),

  adminGetArticles: () => request<{ articles: Article[] }>('/api/admin/articles'),
  adminCreateArticle: (payload: Record<string, unknown>) =>
    request<{ article: Article; editionUpdatedAt?: string }>('/api/admin/articles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminUpdateArticle: (id: string, payload: Record<string, unknown>) =>
    request<{ article: Article; editionUpdatedAt?: string }>(`/api/admin/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  adminDeleteArticle: (id: string) =>
    request<{ ok: boolean; editionUpdatedAt?: string }>(`/api/admin/articles/${id}`, { method: 'DELETE' }),
  adminSyncLiveNews: () =>
    request<{
      inserted: number;
      updated: number;
      feedsChecked: number;
      feedsSucceeded: number;
      editionUpdatedAt: string;
    }>('/api/admin/sync-live-news', { method: 'POST' }),

  adminGetSubmissions: () => request<{ submissions: PublicSubmission[] }>('/api/admin/submissions'),
  adminUpdateSubmission: (id: string, payload: Record<string, unknown>) =>
    request<{ submission: PublicSubmission }>(`/api/admin/submissions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  adminPublishSubmission: (id: string) =>
    request<{ articleId: string; slug: string; editionUpdatedAt?: string }>(
      `/api/admin/submissions/${id}/publish`,
      { method: 'POST' }
    ),

  adminGetMagazines: () => request<{ magazines: MagazineIssue[] }>('/api/admin/magazines'),
  adminCreateMagazine: (payload: Record<string, unknown>) =>
    request<{ id: string; issue_code: string }>('/api/admin/magazines', { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateMagazine: (id: string, payload: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/api/admin/magazines/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adminDeleteMagazine: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/magazines/${id}`, { method: 'DELETE' }),
  adminAddMagazineArticle: (magazineId: string, payload: Record<string, unknown>) =>
    request<{ id: string }>(`/api/admin/magazines/${magazineId}/articles`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminDeleteMagazineArticle: (magazineId: string, articleId: string) =>
    request<{ ok: boolean }>(`/api/admin/magazines/${magazineId}/articles/${articleId}`, { method: 'DELETE' }),

  adminGetEpaper: () => request<{ editions: EpaperEdition[] }>('/api/admin/epaper'),
  adminCreateEpaper: (payload: Record<string, unknown>) =>
    request<{ id: string }>('/api/admin/epaper', { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateEpaper: (id: string, payload: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/api/admin/epaper/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adminDeleteEpaper: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/epaper/${id}`, { method: 'DELETE' }),

  adminGetCategories: () => request<{ categories: Category[] }>('/api/admin/categories'),
  adminCreateCategory: (payload: { name: string; slug?: string; description?: string; sort_order?: number }) =>
    request<{ id: string; name: string; slug: string }>('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminDeleteCategory: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/categories/${id}`, { method: 'DELETE' }),

  adminGetAuthors: () => request<{ authors: Author[] }>('/api/admin/authors'),
  adminCreateAuthor: (payload: { name: string; role_title?: string; bio?: string; email?: string }) =>
    request<{ id: string; name: string; slug: string }>('/api/admin/authors', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminDeleteAuthor: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/authors/${id}`, { method: 'DELETE' }),

  adminGetMedia: () => request<{ assets: MediaAsset[] }>('/api/admin/media'),
  adminUploadMedia: (file: File, altText = '', credit = 'THE CONTINENTAL') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('alt_text', altText);
    fd.append('credit', credit);
    return request<{ id: string; url: string; originalName: string; mimeType: string }>('/api/admin/media/upload', {
      method: 'POST',
      body: fd,
    });
  },
  adminDeleteMedia: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/media/${id}`, { method: 'DELETE' }),

  adminGetNewsletter: () => request<{ subscribers: NewsletterSubscriber[] }>('/api/admin/newsletter'),
  adminDeleteNewsletter: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/newsletter/${id}`, { method: 'DELETE' }),

  adminGetContact: () => request<{ messages: ContactMessage[] }>('/api/admin/contact'),
  adminUpdateContact: (id: string, status: string, admin_notes: string) =>
    request<{ ok: boolean }>(`/api/admin/contact/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_notes }),
    }),

  adminGetSettings: () => request<{ settings: SiteSettings }>('/api/admin/settings'),
  adminUpdateSettings: (payload: Partial<SiteSettings>) =>
    request<{ settings: SiteSettings }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  adminGetAuditLogs: () => request<{ logs: AuditLog[] }>('/api/admin/audit-logs'),

  adminGetNotifications: () =>
    request<{ recipientEmail?: string; notifications: AdminNotification[] }>('/api/admin/notifications'),
  adminMarkNotificationRead: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/notifications/${id}/read`, { method: 'PATCH' }),
  adminDeliverNotificationsViaGmail: async (
    gmailAccessToken: string,
    payload: { mode: 'test' | 'pending'; notificationIds?: string[] }
  ) => {
    const sessionToken = getSessionToken();
    const res = await fetch('/api/admin/notifications/deliver-gmail', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gmailAccessToken}`,
        ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Gmail dispatch failed (${res.status})`);
    }
    return data as {
      sentCount: number;
      failedCount: number;
      recipientEmail: string;
      senderEmail?: string;
      messageId?: string;
      errors?: string[];
    };
  },
};
