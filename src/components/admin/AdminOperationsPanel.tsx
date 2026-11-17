import React, { useEffect, useState } from 'react';
import { BellRing, Check, CheckCircle2, ExternalLink, Mail, Send, Trash2, Upload, X } from 'lucide-react';
import { api } from '../../lib/api';
import { NOTIFICATION_EMAIL } from '../../lib/editorialRules';
import {
  clearCachedGmailToken,
  connectGmailForNotifications,
  getGmailAuthState,
  subscribeGmailAuthChange,
} from '../../lib/firebase';
import type {
  AdminNotification,
  Article,
  AuditLog,
  Author,
  Category,
  ContactMessage,
  MediaAsset,
  NewsletterSubscriber,
  SiteSettings,
} from '../../types/publication';
import { formatHistoricalArticleDate } from '../../lib/dateIst';

export function AdminCurationPanel({
  articles,
  settings,
  onRefresh,
  onNotice,
}: {
  articles: Article[];
  settings: SiteSettings;
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}) {
  const published = articles.filter((a) => a.status === 'published');
  const [launchEnabled, setLaunchEnabled] = useState(settings.launch_notice_enabled);
  const [launchText, setLaunchText] = useState(settings.launch_notice_text);
  const [tickerEnabled, setTickerEnabled] = useState(settings.breaking_ticker_enabled);

  const setSlot = async (articleId: string, featured_slot: 'lead' | 'top_story' | null) => {
    const res = await api.adminUpdateArticle(articleId, { featured_slot, is_featured: Boolean(featured_slot) });
    window.dispatchEvent(new CustomEvent('tc:news-updated', { detail: { editionUpdatedAt: res.editionUpdatedAt } }));
    onNotice('Homepage placement updated.');
    await onRefresh();
  };

  const toggleBreaking = async (art: Article) => {
    const res = await api.adminUpdateArticle(art.id, { is_breaking: !art.is_breaking });
    window.dispatchEvent(new CustomEvent('tc:news-updated', { detail: { editionUpdatedAt: res.editionUpdatedAt } }));
    onNotice('Breaking news ticker updated.');
    await onRefresh();
  };

  const saveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.adminUpdateSettings({
      launch_notice_enabled: launchEnabled,
      launch_notice_text: launchText,
      breaking_ticker_enabled: tickerEnabled,
    });
    onNotice('Homepage banner and ticker settings saved.');
    await onRefresh();
  };

  return (
    <div className="space-y-8 text-neutral-900 dark:text-neutral-100">
      <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-100">Homepage Curation & Breaking News</h2>

      <form onSubmit={saveBanner} className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C1D24] dark:text-[#eb7a80]">Masthead Banners & Ticker</h3>
        <div className="flex flex-wrap gap-6 text-xs">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={tickerEnabled} onChange={(e) => setTickerEnabled(e.target.checked)} className="accent-[#8C1D24]" />
            <span>Enable Breaking News Ticker</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={launchEnabled} onChange={(e) => setLaunchEnabled(e.target.checked)} className="accent-[#8C1D24]" />
            <span>Show Launch Announcement Bar</span>
          </label>
        </div>
        <div className="flex gap-3">
          <input value={launchText} onChange={(e) => setLaunchText(e.target.value)} className="flex-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-xs" />
          <button type="submit" className="px-4 py-2 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors">Save</button>
        </div>
      </form>

      <div className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 overflow-x-auto">
        <table className="w-full text-left text-xs text-neutral-800 dark:text-neutral-200">
          <thead className="bg-neutral-100 dark:bg-[#1f1f1f] border-b border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 uppercase">
            <tr>
              <th className="py-3 px-4">Published Story</th>
              <th className="py-3 px-3">Current Placement</th>
              <th className="py-3 px-3">Breaking Ticker</th>
              <th className="py-3 px-4 text-right">Assign Slot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {published.map((art) => (
              <tr key={art.id} className="hover:bg-neutral-50 dark:hover:bg-[#202020]">
                <td className="py-3 px-4 font-semibold text-neutral-950 dark:text-neutral-100">{art.title}</td>
                <td className="py-3 px-3 uppercase text-neutral-600 dark:text-neutral-400">{art.featured_slot || 'Standard'}</td>
                <td className="py-3 px-3">
                  <button
                    type="button"
                    onClick={() => toggleBreaking(art)}
                    className={`px-2.5 py-1 text-[11px] font-semibold border ${
                      art.is_breaking ? 'bg-[#8C1D24] text-white border-[#8C1D24]' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {art.is_breaking ? 'Breaking ON' : 'Set Breaking'}
                  </button>
                </td>
                <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                  <button type="button" onClick={() => setSlot(art.id, 'lead')} className="text-[#8C1D24] dark:text-[#eb7a80] font-semibold hover:underline">
                    Set Lead
                  </button>
                  <button type="button" onClick={() => setSlot(art.id, 'top_story')} className="text-neutral-800 dark:text-neutral-200 hover:underline">
                    Set Top Story
                  </button>
                  <button type="button" onClick={() => setSlot(art.id, null)} className="text-neutral-500 dark:text-neutral-400 hover:underline">
                    Reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminTaxonomyMediaPanel({
  categories,
  authors,
  media,
  onRefresh,
  onNotice,
}: {
  categories: Category[];
  authors: Author[];
  media: MediaAsset[];
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}) {
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState('Staff Correspondent');
  const [authBio, setAuthBio] = useState('');

  const addCat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.adminCreateCategory({ name: catName, description: catDesc });
      setCatName('');
      setCatDesc('');
      onNotice('Category added.');
      await onRefresh();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Error creating category.');
    }
  };

  const addAuthor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.adminCreateAuthor({ name: authName, role_title: authRole, bio: authBio });
      setAuthName('');
      setAuthBio('');
      onNotice('Author added.');
      await onRefresh();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Error adding author.');
    }
  };

  const uploadAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await api.adminUploadMedia(file, file.name, 'THE CONTINENTAL');
    onNotice('Media uploaded to library.');
    await onRefresh();
  };

  return (
    <div className="space-y-10 text-neutral-900 dark:text-neutral-100">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Categories */}
        <section className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5 space-y-4">
          <h3 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-100">Categories ({categories.length})</h3>
          <form onSubmit={addCat} className="flex flex-col gap-2">
            <input required placeholder="Category Name" value={catName} onChange={(e) => setCatName(e.target.value)} className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs" />
            <div className="flex gap-2">
              <input placeholder="Description" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} className="flex-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs" />
              <button type="submit" className="px-4 py-2 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors">Add</button>
            </div>
          </form>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs max-h-64 overflow-y-auto">
            {categories.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between">
                <span><strong>{c.name}</strong> <span className="text-neutral-500 dark:text-neutral-400 font-mono">/{c.slug}</span></span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.adminDeleteCategory(c.id);
                      await onRefresh();
                    } catch (err) {
                      onNotice(err instanceof Error ? err.message : 'Cannot delete category.');
                    }
                  }}
                  className="text-red-700 dark:text-red-400"
                  aria-label={`Delete ${c.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Authors */}
        <section className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5 space-y-4">
          <h3 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-100">Authors & Journalists ({authors.length})</h3>
          <form onSubmit={addAuthor} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input required placeholder="Full Name" value={authName} onChange={(e) => setAuthName(e.target.value)} className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs" />
              <input placeholder="Title / Desk" value={authRole} onChange={(e) => setAuthRole(e.target.value)} className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs" />
            </div>
            <div className="flex gap-2">
              <input placeholder="Short Biography" value={authBio} onChange={(e) => setAuthBio(e.target.value)} className="flex-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs" />
              <button type="submit" className="px-4 py-2 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors">Add</button>
            </div>
          </form>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs max-h-64 overflow-y-auto">
            {authors.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between">
                <span><strong>{a.name}</strong> · <span className="text-neutral-500 dark:text-neutral-400">{a.role_title}</span></span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.adminDeleteAuthor(a.id);
                      await onRefresh();
                    } catch (err) {
                      onNotice(err instanceof Error ? err.message : 'Cannot delete author.');
                    }
                  }}
                  className="text-red-700 dark:text-red-400"
                  aria-label={`Delete ${a.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Media Library */}
      <section className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-100">Media Library ({media.length})</h3>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold cursor-pointer hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image or PDF</span>
            <input type="file" accept="image/*,application/pdf" onChange={uploadAsset} className="sr-only" />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          {media.map((m) => (
            <div key={m.id} className="border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#141414] p-3 flex flex-col justify-between gap-2">
              <div>
                <p className="font-semibold text-neutral-950 dark:text-neutral-100 truncate">{m.original_name}</p>
                <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">{m.url}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(m.url);
                    onNotice(`Copied URL: ${m.url}`);
                  }}
                  className="text-[#8C1D24] dark:text-[#eb7a80] font-semibold hover:underline"
                >
                  Copy URL
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Delete media "${m.original_name}"?`)) return;
                    await api.adminDeleteMedia(m.id);
                    await onRefresh();
                  }}
                  className="text-red-700 dark:text-red-400"
                  aria-label={`Delete ${m.original_name}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AdminAudiencePanel({
  subscribers,
  messages,
  onRefresh,
  onNotice,
}: {
  subscribers: NewsletterSubscriber[];
  messages: ContactMessage[];
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}) {
  const exportCsv = () => {
    const csv = ['email,status,subscribed_at', ...subscribers.map((s) => `${s.email},${s.status},${s.subscribed_at}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'the-continental-subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 text-neutral-900 dark:text-neutral-100">
      <section className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-100">Newsletter Subscribers ({subscribers.length})</h3>
          <button type="button" onClick={exportCsv} className="px-4 py-1.5 border border-neutral-900 dark:border-neutral-400 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 text-xs font-semibold transition-colors">
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-800 dark:text-neutral-200">
            <thead className="bg-neutral-100 dark:bg-[#1f1f1f] border-b border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 uppercase">
              <tr>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Subscribed (IST)</th>
                <th className="py-2.5 px-3 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {subscribers.map((s) => (
                <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-[#202020]">
                  <td className="py-2.5 px-3 font-medium">{s.email}</td>
                  <td className="py-2.5 px-3 uppercase">{s.status}</td>
                  <td className="py-2.5 px-3">{formatHistoricalArticleDate(s.subscribed_at)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Remove subscriber ${s.email}?`)) return;
                        await api.adminDeleteNewsletter(s.id);
                        onNotice('Subscriber removed.');
                        await onRefresh();
                      }}
                      className="text-red-700 dark:text-red-400"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5 space-y-4">
        <h3 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-100">Contact Desk Messages ({messages.length})</h3>
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {messages.length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 py-4">No contact messages received yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="py-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-sm text-neutral-950 dark:text-neutral-100">{m.subject}</p>
                  <div className="flex items-center gap-2">
                    <span className="uppercase font-semibold text-[#8C1D24] dark:text-[#eb7a80]">{m.status}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.adminUpdateContact(m.id, m.status === 'resolved' ? 'read' : 'resolved', m.admin_notes);
                        onNotice('Contact message updated.');
                        await onRefresh();
                      }}
                      className="px-2.5 py-1 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 font-semibold"
                    >
                      {m.status === 'resolved' ? 'Reopen' : 'Mark Resolved'}
                    </button>
                  </div>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400">From: {m.name} ({m.email}) · {formatHistoricalArticleDate(m.created_at)}</p>
                <p className="text-neutral-800 dark:text-neutral-200 whitespace-pre-line">{m.message}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export function AdminSettingsSecurityPanel({
  settings,
  logs,
  onRefresh,
  onNotice,
}: {
  settings: SiteSettings;
  logs: AuditLog[];
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}) {
  const [form, setForm] = useState<SiteSettings>(settings);
  const [currPw, setCurrPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.adminUpdateSettings(form);
    onNotice('Publication settings & policies saved.');
    await onRefresh();
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.changePassword(currPw, newPw);
      setCurrPw('');
      setNewPw('');
      onNotice(res.message);
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Password update failed.');
    }
  };

  return (
    <div className="space-y-10 text-neutral-900 dark:text-neutral-100">
      <form onSubmit={saveSettings} className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-6 space-y-5">
        <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-100">Website, SEO, About Us & Policies</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold uppercase text-neutral-800 dark:text-neutral-200 mb-1">Location Label (Masthead)</label>
            <input value={form.location_label} onChange={(e) => setForm({ ...form, location_label: e.target.value })} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2" />
          </div>
          <div>
            <label className="block font-bold uppercase text-neutral-800 dark:text-neutral-200 mb-1">SEO Default Title</label>
            <input value={form.seo_default_title} onChange={(e) => setForm({ ...form, seo_default_title: e.target.value })} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block font-bold uppercase text-neutral-800 dark:text-neutral-200 mb-1">About Us — Our Story</label>
            <textarea rows={2} value={form.about_story} onChange={(e) => setForm({ ...form, about_story: e.target.value })} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block font-bold uppercase text-neutral-800 dark:text-neutral-200 mb-1">Editorial Policy</label>
            <textarea rows={4} value={form.editorial_policy} onChange={(e) => setForm({ ...form, editorial_policy: e.target.value })} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block font-bold uppercase text-neutral-800 dark:text-neutral-200 mb-1">Corrections Policy</label>
            <textarea rows={3} value={form.corrections_policy} onChange={(e) => setForm({ ...form, corrections_policy: e.target.value })} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2" />
          </div>
        </div>
        <button type="submit" className="px-6 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors">
          Save All Settings & Policies
        </button>
      </form>

      <form onSubmit={changePw} className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-6 space-y-4 max-w-xl">
        <h3 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-100">Administrator Security</h3>
        <input type="password" required placeholder="Current Password" value={currPw} onChange={(e) => setCurrPw(e.target.value)} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs" />
        <input type="password" required minLength={10} placeholder="New Password (min 10 characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs" />
        <button type="submit" className="px-5 py-2 bg-[#8C1D24] text-white text-xs font-semibold uppercase hover:bg-[#6e141a]">Update Password</button>
      </form>

      <section className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5 space-y-3">
        <h3 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-100">Administrator Audit Logs ({logs.length})</h3>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs text-neutral-800 dark:text-neutral-200">
            <thead className="bg-neutral-100 dark:bg-[#1f1f1f] border-b border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 uppercase">
              <tr>
                <th className="py-2 px-3">Timestamp (IST)</th>
                <th className="py-2 px-3">Actor</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-neutral-50 dark:hover:bg-[#202020]">
                  <td className="py-2 px-3 whitespace-nowrap">{formatHistoricalArticleDate(l.created_at)}</td>
                  <td className="py-2 px-3 font-mono">{l.actor_email}</td>
                  <td className="py-2 px-3 font-semibold">{l.action}</td>
                  <td className="py-2 px-3">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function AdminNotificationsPanel({
  notifications,
  onRefresh,
  onNotice,
}: {
  notifications: AdminNotification[];
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}) {
  const [filter, setFilter] = useState<
    | 'all'
    | 'unread'
    | 'submission_received'
    | 'user_registered'
    | 'user_login'
    | 'newsletter_subscribe'
    | 'contact_message'
  >('all');

  const [gmailState, setGmailState] = useState(() => getGmailAuthState());
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [sendingGmail, setSendingGmail] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [confirmPayload, setConfirmPayload] = useState<{
    mode: 'test' | 'pending';
    items: AdminNotification[];
  } | null>(null);

  useEffect(() => {
    return subscribeGmailAuthChange(() => {
      setGmailState(getGmailAuthState());
    });
  }, []);

  const pendingInboxDelivery = notifications.filter(
    (n) =>
      n.delivery_status !== 'emailed_to_inbox' &&
      n.delivery_status !== 'emailed_to_gmail_inbox' &&
      n.delivery_status !== 'emailed_to_admin'
  );

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'submission_received') return n.event_type === 'submission_received';
    if (filter === 'user_registered') return n.event_type === 'user_registered';
    if (filter === 'user_login') return n.event_type === 'user_login';
    if (filter === 'newsletter_subscribe') return n.event_type === 'newsletter_subscribe';
    if (filter === 'contact_message') return n.event_type === 'contact_message';
    return true;
  });

  const markRead = async (id: string) => {
    await api.adminMarkNotificationRead(id);
    onNotice('Notification marked as read.');
    await onRefresh();
  };

  const handleConnectGmail = async () => {
    setGmailError(null);
    setConnectingGmail(true);
    try {
      const connected = await connectGmailForNotifications();
      setGmailState(getGmailAuthState());
      onNotice(`Connected Gmail (${connected.email}) for inbox delivery to ${NOTIFICATION_EMAIL}.`);
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'Unable to connect Gmail account.');
    } finally {
      setConnectingGmail(false);
    }
  };

  const executeConfirmedGmailSend = async () => {
    if (!confirmPayload) return;
    const token = getGmailAuthState().accessToken;
    if (!token) {
      setConfirmPayload(null);
      setGmailError('Gmail authorization expired. Please click "Sign in with Google" to reconnect.');
      return;
    }

    setSendingGmail(true);
    setGmailError(null);
    try {
      const result = await api.adminDeliverNotificationsViaGmail(token, {
        mode: confirmPayload.mode,
        notificationIds: confirmPayload.mode === 'pending' ? confirmPayload.items.map((i) => i.id) : undefined,
      });
      setConfirmPayload(null);
      if (confirmPayload.mode === 'test') {
        onNotice(`Test notification email sent directly to ${result.recipientEmail} inbox.`);
      } else {
        onNotice(
          `Delivered ${result.sentCount} notification(s) to ${result.recipientEmail} Gmail inbox${
            result.failedCount > 0 ? ` (${result.failedCount} failed)` : ''
          }.`
        );
      }
      await onRefresh();
    } catch (err) {
      setGmailError(err instanceof Error ? err.message : 'Unable to send notification emails via Gmail.');
      setConfirmPayload(null);
    } finally {
      setSendingGmail(false);
    }
  };

  return (
    <div className="space-y-6 text-neutral-900 dark:text-neutral-100">
      <div className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[#8C1D24] dark:text-[#eb7a80]">
            <BellRing className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-widest" data-testid="notification-recipient-badge">
              Recipient Inbox: {NOTIFICATION_EMAIL}
            </span>
            <a
              href="https://mail.google.com/mail/u/0/#inbox"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2 text-neutral-700 dark:text-neutral-300 hover:text-[#8C1D24] dark:hover:text-[#eb7a80]"
            >
              <span>Open Gmail Inbox</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-100 mt-1">
            Editorial &amp; Reader Mail Alerts ({notifications.length})
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            Routed to {NOTIFICATION_EMAIL} whenever an article is submitted, a user registers or signs in, a contact message arrives, or a reader subscribes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { id: 'all', label: 'All Alerts' },
            { id: 'unread', label: 'Unread' },
            { id: 'submission_received', label: 'Submissions' },
            { id: 'user_registered', label: 'Registrations' },
            { id: 'user_login', label: 'Logins' },
            { id: 'newsletter_subscribe', label: 'Subscriptions' },
            { id: 'contact_message', label: 'Contact' },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilter(btn.id as typeof filter)}
              className={`px-3 py-1.5 border font-semibold transition-colors ${
                filter === btn.id
                  ? 'bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 border-[#111111] dark:border-neutral-100'
                  : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 dark:hover:border-neutral-400'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gmail Direct Inbox Delivery Control Bar */}
      <div className="bg-[#FAF9F6] dark:bg-[#1a1818] border border-neutral-300 dark:border-neutral-700 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-neutral-950 dark:text-neutral-100">
              Gmail Inbox Delivery ({NOTIFICATION_EMAIL})
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
              Connect{' '}
              <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">{NOTIFICATION_EMAIL}</span>{' '}
              with Google to deliver queued notifications or a verification email straight into your Gmail Inbox.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!gmailState.connected ? (
              <button
                type="button"
                data-testid="connect-gmail-btn"
                disabled={connectingGmail}
                onClick={handleConnectGmail}
                className="inline-flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-[#141414] border border-neutral-400 dark:border-neutral-600 text-xs font-semibold text-neutral-900 dark:text-neutral-100 hover:border-neutral-950 dark:hover:border-neutral-300 shadow-xs transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{connectingGmail ? 'Connecting Gmail...' : `Connect Gmail (${NOTIFICATION_EMAIL})`}</span>
              </button>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Gmail Connected: {gmailState.email}</span>
                </span>
                <button
                  type="button"
                  data-testid="send-test-gmail-btn"
                  disabled={sendingGmail}
                  onClick={() => setConfirmPayload({ mode: 'test', items: [] })}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-neutral-900 dark:border-neutral-400 text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 transition-colors disabled:opacity-50"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Test Email</span>
                </button>
                <button
                  type="button"
                  data-testid="deliver-pending-gmail-btn"
                  disabled={sendingGmail || pendingInboxDelivery.length === 0}
                  onClick={() =>
                    setConfirmPayload({ mode: 'pending', items: pendingInboxDelivery.slice(0, 25) })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#8C1D24] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#6e151a] transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Deliver Pending to Inbox ({pendingInboxDelivery.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => clearCachedGmailToken()}
                  className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] underline underline-offset-4"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>

        {gmailError && (
          <p role="alert" className="text-xs font-medium text-[#8C1D24] dark:text-[#eb7a80]">
            {gmailError}
          </p>
        )}
      </div>

      {/* Confirmation Dialog before sending emails via Gmail API */}
      {confirmPayload && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gmail-confirm-heading"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#181818] border-2 border-neutral-950 dark:border-neutral-600 p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">
                  Confirm Gmail Dispatch
                </p>
                <h3 id="gmail-confirm-heading" className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-100 mt-1">
                  {confirmPayload.mode === 'test'
                    ? `Send 1 test email to ${NOTIFICATION_EMAIL}?`
                    : `Send ${confirmPayload.items.length} notification email(s) to ${NOTIFICATION_EMAIL}?`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmPayload(null)}
                aria-label="Cancel Gmail dispatch"
                className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
              {confirmPayload.mode === 'test'
                ? `This will send one verification email via your connected Gmail account (${gmailState.email}) directly to ${NOTIFICATION_EMAIL} Inbox.`
                : `This will send ${confirmPayload.items.length} queued notification email(s) via your connected Gmail account (${gmailState.email}) directly to ${NOTIFICATION_EMAIL} Inbox.`}
            </p>

            {confirmPayload.items.length > 0 && (
              <ul className="max-h-40 overflow-y-auto border border-neutral-200 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#141414] p-3 space-y-1.5 text-[11px] text-neutral-700 dark:text-neutral-300">
                {confirmPayload.items.map((item) => (
                  <li key={item.id} className="truncate">
                    • {item.subject}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={sendingGmail}
                onClick={() => setConfirmPayload(null)}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 dark:hover:border-neutral-400"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-gmail-send-btn"
                disabled={sendingGmail}
                onClick={executeConfirmedGmailSend}
                className="px-5 py-2 bg-[#8C1D24] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#6e151a] disabled:opacity-50"
              >
                {sendingGmail ? 'Sending to Inbox...' : 'Confirm & Send to Inbox'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 divide-y divide-neutral-200 dark:divide-neutral-800">
        {filtered.length === 0 ? (
          <p className="p-6 text-xs text-neutral-500 dark:text-neutral-400">No notifications match the selected filter.</p>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs ${
                n.is_read ? 'bg-white dark:bg-[#181818]' : 'bg-[#FAF9F6] dark:bg-[#1f1c1c]'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="uppercase font-bold tracking-wider text-[10px] px-2 py-0.5 border border-[#8C1D24] dark:border-[#eb7a80] text-[#8C1D24] dark:text-[#eb7a80]">
                    {n.event_type === 'newsletter_subscribe'
                      ? 'Newsletter Subscribe'
                      : n.event_type === 'submission_received'
                        ? 'New Article Submission'
                        : n.event_type === 'user_registered'
                          ? 'New User Registration'
                          : n.event_type === 'contact_message'
                            ? 'Contact Message'
                            : 'User Login'}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400 font-mono text-[11px]">To: {n.recipient_email}</span>
                  <span className="text-neutral-400 dark:text-neutral-500">·</span>
                  <span className="text-neutral-500 dark:text-neutral-400">{formatHistoricalArticleDate(n.created_at)}</span>
                </div>
                <p className="font-bold text-sm text-neutral-950 dark:text-neutral-100">{n.subject}</p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">{n.message}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Actor: <strong className="text-neutral-800 dark:text-neutral-200">{n.actor_name}</strong> ({n.actor_email}) · Status:{' '}
                  <span
                    className={`uppercase font-medium ${
                      n.delivery_status === 'emailed_to_gmail_inbox' || n.delivery_status === 'emailed_to_inbox'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {n.delivery_status}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`mailto:${NOTIFICATION_EMAIL}?subject=${encodeURIComponent(n.subject)}&body=${encodeURIComponent(n.message)}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-neutral-300 dark:border-neutral-700 font-semibold text-neutral-700 dark:text-neutral-200 hover:border-neutral-900 dark:hover:border-neutral-400"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Forward Mail</span>
                </a>
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 font-semibold hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Read</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

