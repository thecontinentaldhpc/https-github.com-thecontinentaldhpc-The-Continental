import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  Bookmark,
  BookOpen,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Newspaper,
  Settings,
  Shield,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { useSite } from '../context/SiteContext';
import { ReadingListSection } from '../components/ReadingListSection';
import { ADMIN_EMAIL, NOTIFICATION_EMAIL, isNotificationRecipientEmail } from '../lib/editorialRules';
import { notifyViaWeb3FormsInBackground } from '../lib/web3forms';
import type {
  AdminNotification,
  Article,
  AuditLog,
  Author,
  Category,
  ContactMessage,
  EpaperEdition,
  MagazineIssue,
  MediaAsset,
  NewsletterSubscriber,
  PublicSubmission,
  SiteSettings,
} from '../types/publication';
import { formatHistoricalArticleDate } from '../lib/dateIst';
import { AdminArticlesPanel } from '../components/admin/AdminArticlesPanel';
import { AdminSubmissionsPanel } from '../components/admin/AdminSubmissionsPanel';
import { AdminEpaperPanel, AdminMagazinesPanel } from '../components/admin/AdminEditionsPanel';
import {
  AdminAudiencePanel,
  AdminCurationPanel,
  AdminNotificationsPanel,
  AdminSettingsSecurityPanel,
  AdminTaxonomyMediaPanel,
} from '../components/admin/AdminOperationsPanel';
import { BrandLogo } from '../components/BrandLogo';

type AdminTab =
  | 'overview'
  | 'reading-list'
  | 'notifications'
  | 'articles'
  | 'submissions'
  | 'magazine'
  | 'epaper'
  | 'curation'
  | 'taxonomy'
  | 'audience'
  | 'settings';

export function AdminPage() {
  const {
    refreshSiteData,
    user,
    authLoading,
    needsSetup,
    isAdmin,
    isNotificationRecipient,
    readingList,
    refreshAuth,
    signInWithGoogle,
    signOutUser,
  } = useSite();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [notice, setNotice] = useState<string | null>(null);

  const [overview, setOverview] = useState<Awaited<ReturnType<typeof api.adminOverview>> | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [submissions, setSubmissions] = useState<PublicSubmission[]>([]);
  const [magazines, setMagazines] = useState<MagazineIssue[]>([]);
  const [epapers, setEpapers] = useState<EpaperEdition[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [adminSettings, setAdminSettings] = useState<SiteSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const loadAllAdminData = useCallback(async () => {
    const [ov, notif, art, sub, mag, ep, cat, authRes, med, news, msg, setRes, logsRes] = await Promise.all([
      api.adminOverview(),
      api.adminGetNotifications(),
      api.adminGetArticles(),
      api.adminGetSubmissions(),
      api.adminGetMagazines(),
      api.adminGetEpaper(),
      api.adminGetCategories(),
      api.adminGetAuthors(),
      api.adminGetMedia(),
      api.adminGetNewsletter(),
      api.adminGetContact(),
      api.adminGetSettings(),
      api.adminGetAuditLogs(),
    ]);
    setOverview(ov);
    setNotifications(notif.notifications);
    setArticles(art.articles);
    setSubmissions(sub.submissions);
    setMagazines(mag.magazines);
    setEpapers(ep.editions);
    setCategories(cat.categories);
    setAuthors(authRes.authors);
    setMedia(med.assets);
    setSubscribers(news.subscribers);
    setMessages(msg.messages);
    setAdminSettings(setRes.settings);
    setAuditLogs(logsRes.logs);
    await refreshSiteData();
  }, [refreshSiteData]);

  useEffect(() => {
    document.title = 'Administrator Console | THE CONTINENTAL';
  }, []);

  const loadNotificationAlertsOnly = useCallback(async () => {
    const notif = await api.adminGetNotifications();
    setNotifications(notif.notifications);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadAllAdminData();
    } else if (isNotificationRecipient) {
      void loadNotificationAlertsOnly();
    }
  }, [isAdmin, isNotificationRecipient, loadAllAdminData, loadNotificationAlertsOnly]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const handleGoogleAdminSignIn = async () => {
    setAuthError(null);
    setGoogleLoading(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn.role !== 'super_admin' && !isNotificationRecipientEmail(signedIn.email)) {
        setAuthError(
          `Signed in as ${signedIn.email}. Administrator privileges require ${ADMIN_EMAIL}, or sign in as ${NOTIFICATION_EMAIL} for Mail Alerts.`
        );
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await api.setupAdmin({ fullName, email, password });
      notifyViaWeb3FormsInBackground({
        eventType: 'New Login',
        userName: res.user.fullName,
        userEmail: res.user.email,
        subject: `[THE CONTINENTAL] New Admin Setup & Login — ${res.user.email}`,
        message: `${res.user.fullName} (${res.user.email}) configured the Administrator account and signed in.`,
        metadata: { 'Auth Method': 'Admin Console Setup', Role: res.user.role },
      });
      await refreshAuth();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Setup failed.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await api.loginAdmin({ email, password });
      notifyViaWeb3FormsInBackground({
        eventType: 'New Login',
        userName: res.user.fullName,
        userEmail: res.user.email,
        subject: `[THE CONTINENTAL] New Login — ${res.user.fullName} (${res.user.email})`,
        message: `${res.user.fullName} (${res.user.email}) signed into THE CONTINENTAL Admin Console.`,
        metadata: { 'Auth Method': 'Admin Password Login', Role: res.user.role },
      });
      await refreshAuth();
      if (res.user.role !== 'super_admin') {
        setAuthError(`Administrator access is restricted exclusively to ${ADMIN_EMAIL}.`);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid login credentials.');
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-md mx-auto py-20 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Checking administrator session...
      </div>
    );
  }

  if (user && !isAdmin && isNotificationRecipient) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-neutral-950 dark:border-neutral-700 pb-4 mb-6">
          <div>
            <BrandLogo className="h-9 w-auto mb-2" />
            <p className="text-xs font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">
              Notification Inbox Owner ({NOTIFICATION_EMAIL})
            </p>
            <h1 className="font-serif text-3xl font-bold text-neutral-950 dark:text-neutral-100">
              Mail Alerts &amp; Gmail Inbox Delivery
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
              All registration, login, newsletter, contact, and submission notifications are routed here. Full CMS editing remains restricted to {ADMIN_EMAIL}.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-neutral-600 dark:text-neutral-400">
              Signed in as <strong className="text-neutral-950 dark:text-neutral-100">{user.email}</strong>
            </span>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold hover:border-neutral-900 dark:hover:border-neutral-400"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {notice && (
          <div role="status" className="mb-5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-300 px-4 py-2.5 text-xs font-semibold">
            {notice}
          </div>
        )}

        <AdminNotificationsPanel
          notifications={notifications}
          onRefresh={loadNotificationAlertsOnly}
          onNotice={showNotice}
        />
      </main>
    );
  }

  if (user && !isAdmin) {
    return (
      <main className="max-w-lg mx-auto px-4 py-14">
        <div className="border-2 border-neutral-950 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] p-8 space-y-4">
          <BrandLogo className="h-9 w-auto" />
          <div className="flex items-center gap-2 text-[#8C1D24] dark:text-[#eb7a80]">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Access Restricted</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-100">
            Administrator Privileges Required
          </h1>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            You are currently signed in as <strong>{user.email}</strong> with Contributor &amp; Reader permissions. Only{' '}
            <span className="font-mono font-semibold text-neutral-950 dark:text-neutral-100">{ADMIN_EMAIL}</span> has Administrator access to the editorial console and Mail Alerts.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/reading-list"
              className="px-4 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white"
            >
              My Reading List ({readingList.length})
            </Link>
            <Link
              to="/publish-your-writing"
              className="px-4 py-2.5 bg-[#8C1D24] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#6e151a]"
            >
              Publish Your Writing
            </Link>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="px-4 py-2.5 border border-neutral-900 dark:border-neutral-400 text-neutral-900 dark:text-neutral-100 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="max-w-md mx-auto px-4 py-14">
        <div className="border-2 border-neutral-950 dark:border-neutral-700 bg-white dark:bg-[#181818] p-8">
          <BrandLogo className="h-10 w-auto mb-4" />
          <div className="flex items-center gap-2 text-[#8C1D24] dark:text-[#eb7a80] mb-2">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">
              {needsSetup ? 'Initial Security Configuration' : 'Restricted Administrator Console'}
            </span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-100">
            {needsSetup ? 'Configure Administrator Access' : 'Administrator Sign In'}
          </h1>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed">
            Administrator access and Gmail Inbox notifications are connected to{' '}
            <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">{ADMIN_EMAIL}</span>. Sign in with Google or your configured password.
          </p>

          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleAdminSignIn}
            className="mt-5 w-full py-2.5 bg-[#8C1D24] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#6e151a] transition-colors disabled:opacity-50"
          >
            {googleLoading ? 'Connecting to Google...' : `Continue with Google (${ADMIN_EMAIL})`}
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            <span className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
            <span>Or Password</span>
            <span className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
          </div>

          <form onSubmit={needsSetup ? handleSetupSubmit : handleLoginSubmit} className="space-y-4">
            {needsSetup && (
              <div>
                <label htmlFor="adm-name" className="block text-xs font-bold uppercase text-neutral-800 dark:text-neutral-200 mb-1">Full Name</label>
                <input
                  id="adm-name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
                />
              </div>
            )}
            <div>
              <label htmlFor="adm-email" className="block text-xs font-bold uppercase text-neutral-800 dark:text-neutral-200 mb-1">Administrator Email</label>
              <input
                id="adm-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>
            <div>
              <label htmlFor="adm-pw" className="block text-xs font-bold uppercase text-neutral-800 dark:text-neutral-200 mb-1">Password</label>
              <input
                id="adm-pw"
                type="password"
                required
                minLength={needsSetup ? 10 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={needsSetup ? 'Minimum 10 characters' : ''}
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>
            {authError && <p role="alert" className="text-xs font-medium text-[#8C1D24] dark:text-[#eb7a80]">{authError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors"
            >
              {needsSetup ? 'Initialize Administrator Password' : 'Sign In to Dashboard'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'reading-list', label: `Reading List (${readingList.length})`, icon: Bookmark },
    { id: 'notifications', label: `Mail Alerts (${overview?.counts.unreadNotifications ?? 0})`, icon: BellRing },
    { id: 'articles', label: 'News & Articles', icon: Newspaper },
    { id: 'submissions', label: `Submissions (${overview?.counts.pendingSubmissions ?? 0})`, icon: Inbox },
    { id: 'magazine', label: 'Monthly Magazine', icon: BookOpen },
    { id: 'epaper', label: 'Digital E-Paper', icon: FileText },
    { id: 'curation', label: 'Homepage & Breaking', icon: Sparkles },
    { id: 'taxonomy', label: 'Categories, Authors & Media', icon: FolderOpen },
    { id: 'audience', label: 'Newsletter & Contact', icon: Mail },
    { id: 'settings', label: 'Settings, Policies & Logs', icon: Settings },
  ];

  return (
    <main className="max-w-[1380px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-neutral-950 dark:border-neutral-700 pb-4 mb-6">
        <div>
          <BrandLogo className="h-9 sm:h-10 w-auto mb-2" />
          <p className="text-xs font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">Administrator Editorial Console</p>
          <h1 className="font-serif text-3xl font-bold text-neutral-950 dark:text-neutral-100">THE CONTINENTAL CMS</h1>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-neutral-600 dark:text-neutral-400">
            Signed in as <strong className="text-neutral-950 dark:text-neutral-100">{user?.fullName}</strong> ({user?.email})
          </span>
          <button
            type="button"
            onClick={() => signOutUser()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold hover:border-neutral-900 dark:hover:border-neutral-400"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" className="mb-5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-300 px-4 py-2.5 text-xs font-semibold">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-3 border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#161616] divide-y divide-neutral-200 dark:divide-neutral-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-semibold transition-colors ${
                  activeTab === item.id
                    ? 'bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950'
                    : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-[#222222]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        <section className="lg:col-span-9 min-w-0">
          {activeTab === 'overview' && overview && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Articles', val: overview.counts.totalArticles },
                  { label: 'Published Articles', val: overview.counts.publishedArticles },
                  { label: 'Unread Mail Alerts', val: overview.counts.unreadNotifications },
                  { label: 'Pending Submissions', val: overview.counts.pendingSubmissions },
                  { label: 'Approved Submissions', val: overview.counts.approvedSubmissions },
                  { label: 'Magazine Issues', val: overview.counts.magazineIssues },
                  { label: 'E-Paper Editions', val: overview.counts.epaperEditions },
                  { label: 'Active Subscribers', val: overview.counts.subscribers },
                ].map((stat) => (
                  <div key={stat.label} className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181818] p-4">
                    <p className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{stat.label}</p>
                    <p className="font-mono text-2xl font-bold text-neutral-950 dark:text-neutral-100 mt-1 tabular-nums">{stat.val}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5">
                <h2 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-100 mb-3">Recent Editorial & System Activity</h2>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                  {overview.recentActivity.map((act) => (
                    <div key={act.id} className="py-2.5 flex flex-wrap justify-between gap-2 text-neutral-800 dark:text-neutral-200">
                      <span>
                        <strong className="text-[#8C1D24] dark:text-[#eb7a80]">{act.action}</strong> — {act.details}
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400">{formatHistoricalArticleDate(act.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reading-list' && (
            <ReadingListSection />
          )}

          {activeTab === 'notifications' && (
            <AdminNotificationsPanel
              notifications={notifications}
              onRefresh={loadAllAdminData}
              onNotice={showNotice}
            />
          )}

          {activeTab === 'articles' && (
            <AdminArticlesPanel
              articles={articles}
              categories={categories}
              authors={authors}
              onRefresh={loadAllAdminData}
              onNotice={showNotice}
            />
          )}

          {activeTab === 'submissions' && (
            <AdminSubmissionsPanel submissions={submissions} onRefresh={loadAllAdminData} onNotice={showNotice} />
          )}

          {activeTab === 'magazine' && (
            <AdminMagazinesPanel magazines={magazines} onRefresh={loadAllAdminData} onNotice={showNotice} />
          )}

          {activeTab === 'epaper' && (
            <AdminEpaperPanel editions={epapers} onRefresh={loadAllAdminData} onNotice={showNotice} />
          )}

          {activeTab === 'curation' && adminSettings && (
            <AdminCurationPanel
              articles={articles}
              settings={adminSettings}
              onRefresh={loadAllAdminData}
              onNotice={showNotice}
            />
          )}

          {activeTab === 'taxonomy' && (
            <AdminTaxonomyMediaPanel
              categories={categories}
              authors={authors}
              media={media}
              onRefresh={loadAllAdminData}
              onNotice={showNotice}
            />
          )}

          {activeTab === 'audience' && (
            <AdminAudiencePanel
              subscribers={subscribers}
              messages={messages}
              onRefresh={loadAllAdminData}
              onNotice={showNotice}
            />
          )}

          {activeTab === 'settings' && adminSettings && (
            <AdminSettingsSecurityPanel
              settings={adminSettings}
              logs={auditLogs}
              onRefresh={loadAllAdminData}
              onNotice={showNotice}
            />
          )}
        </section>
      </div>
    </main>
  );
}
