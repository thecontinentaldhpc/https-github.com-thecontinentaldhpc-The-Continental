import React, { useState } from 'react';
import { Edit3, ExternalLink, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import type { Article, Author, Category, FeaturedSlot } from '../../types/publication';
import { formatHistoricalArticleDate, istDateTimeToUtcIso } from '../../lib/dateIst';
import { RichTextEditor } from '../RichTextEditor';

interface Props {
  articles: Article[];
  categories: Category[];
  authors: Author[];
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}

export function AdminArticlesPanel({ articles, categories, authors, onRefresh, onNotice }: Props) {
  const [editing, setEditing] = useState<Article | null>(null);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('<p>Write article prose here...</p>');
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [imageCredit, setImageCredit] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published' | 'archived'>('draft');
  const [isFeatured, setIsFeatured] = useState(false);
  const [featuredSlot, setFeaturedSlot] = useState<FeaturedSlot>(null);
  const [isBreaking, setIsBreaking] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('07:00');
  const [saving, setSaving] = useState(false);
  const [syncingLive, setSyncingLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setTitle('');
    setSubheadline('');
    setSlug('');
    setSummary('');
    setContentHtml('<p>Enter full report...</p>');
    setFeaturedImageUrl('');
    setImageCaption('');
    setImageCredit('');
    setAuthorId(authors[0]?.id || '');
    setCategoryId(categories[0]?.id || '');
    setTagsText('');
    setSeoTitle('');
    setSeoDescription('');
    setStatus('draft');
    setIsFeatured(false);
    setFeaturedSlot(null);
    setIsBreaking(false);
    setScheduleDate('');
    setScheduleTime('07:00');
    setError(null);
  };

  const openEdit = (art: Article) => {
    setCreating(false);
    setEditing(art);
    setTitle(art.title);
    setSubheadline(art.subheadline || '');
    setSlug(art.slug);
    setSummary(art.summary || '');
    setContentHtml(art.content_html);
    setFeaturedImageUrl(art.featured_image_url || '');
    setImageCaption(art.image_caption || '');
    setImageCredit(art.image_credit || '');
    setAuthorId(art.author_id);
    setCategoryId(art.category_id);
    setTagsText((art.tags || []).join(', '));
    setSeoTitle(art.seo_title || '');
    setSeoDescription(art.seo_description || '');
    setStatus(art.status);
    setIsFeatured(art.is_featured);
    setFeaturedSlot(art.featured_slot);
    setIsBreaking(art.is_breaking);
    setScheduleDate('');
    setScheduleTime('07:00');
    setError(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await api.adminUploadMedia(file, title || file.name, imageCredit || 'THE CONTINENTAL');
      setFeaturedImageUrl(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let scheduledAtIso: string | null = editing?.scheduled_at || null;
      if (status === 'scheduled') {
        if (!scheduleDate && !scheduledAtIso) {
          throw new Error('Select a scheduled publication date and time (IST).');
        }
        if (scheduleDate) {
          scheduledAtIso = istDateTimeToUtcIso(scheduleDate, scheduleTime || '07:00');
        }
      }

      const payload = {
        title,
        subheadline,
        slug: slug || undefined,
        summary,
        content_html: contentHtml,
        featured_image_url: featuredImageUrl || null,
        image_caption: imageCaption,
        image_credit: imageCredit,
        author_id: authorId,
        category_id: categoryId,
        tags: tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        seo_title: seoTitle,
        seo_description: seoDescription,
        status,
        approval_status: 'approved',
        is_featured: isFeatured,
        featured_slot: featuredSlot,
        is_breaking: isBreaking,
        scheduled_at: scheduledAtIso,
      };

      let editionUpdatedAt: string | undefined;
      if (editing) {
        const res = await api.adminUpdateArticle(editing.id, payload);
        editionUpdatedAt = res.editionUpdatedAt;
        onNotice('Article updated.');
      } else {
        const res = await api.adminCreateArticle(payload);
        editionUpdatedAt = res.editionUpdatedAt;
        onNotice('Article created.');
      }
      window.dispatchEvent(new CustomEvent('tc:news-updated', { detail: { editionUpdatedAt } }));
      setEditing(null);
      setCreating(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (art: Article, nextStatus: 'published' | 'draft' | 'archived') => {
    const res = await api.adminUpdateArticle(art.id, { status: nextStatus, approval_status: 'approved' });
    window.dispatchEvent(new CustomEvent('tc:news-updated', { detail: { editionUpdatedAt: res.editionUpdatedAt } }));
    onNotice(`Article set to ${nextStatus}.`);
    await onRefresh();
  };

  const handleDelete = async (art: Article) => {
    if (!window.confirm(`Permanently delete article "${art.title}"? This action cannot be undone.`)) return;
    const res = await api.adminDeleteArticle(art.id);
    window.dispatchEvent(new CustomEvent('tc:news-updated', { detail: { editionUpdatedAt: res.editionUpdatedAt } }));
    onNotice('Article deleted.');
    await onRefresh();
  };

  const handleSyncLiveNews = async () => {
    setSyncingLive(true);
    try {
      const res = await api.adminSyncLiveNews();
      window.dispatchEvent(new CustomEvent('tc:news-updated', { detail: { editionUpdatedAt: res.editionUpdatedAt } }));
      onNotice(
        `Live News Synced (Google News & The Hindu): ${res.inserted} new articles added, ${res.updated} developing stories updated.`
      );
      await onRefresh();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Unable to sync live news feeds right now.');
    } finally {
      setSyncingLive(false);
    }
  };

  if (creating || editing) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-6 space-y-5 text-neutral-900 dark:text-neutral-100">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-4">
          <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-100">
            {editing ? 'Edit Article' : 'Compose New Article'}
          </h2>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setEditing(null);
            }}
            className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-100 underline"
          >
            Back to Articles List
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="art-title" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                Headline *
              </label>
              <input
                id="art-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="art-sub" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                Subheadline
              </label>
              <input
                id="art-sub"
                value={subheadline}
                onChange={(e) => setSubheadline(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>

            <div>
              <label htmlFor="art-cat" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                Category *
              </label>
              <select
                id="art-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="art-author" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                Author *
              </label>
              <select
                id="art-author"
                value={authorId}
                onChange={(e) => setAuthorId(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              >
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="art-slug" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                URL Slug (auto-generated if empty)
              </label>
              <input
                id="art-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>

            <div>
              <label htmlFor="art-tags" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                Tags (comma-separated)
              </label>
              <input
                id="art-tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="Policy, Economy, Analysis"
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>
          </div>

          <div>
            <label htmlFor="art-summary" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
              Summary
            </label>
            <textarea
              id="art-summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
            />
          </div>

          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1.5">Full Article Body *</span>
            <RichTextEditor value={contentHtml} onChange={setContentHtml} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
            <div>
              <label htmlFor="art-img" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                Featured Image URL
              </label>
              <div className="flex gap-2">
                <input
                  id="art-img"
                  value={featuredImageUrl}
                  onChange={(e) => setFeaturedImageUrl(e.target.value)}
                  placeholder="/uploads/... or /src/assets/..."
                  className="flex-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
                />
                <label className="px-2.5 py-2 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-[#222222] text-neutral-800 dark:text-neutral-200 text-xs cursor-pointer inline-flex items-center">
                  <Upload className="w-3.5 h-3.5" />
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="sr-only" />
                </label>
              </div>
            </div>
            <div>
              <label htmlFor="art-cap" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">Image Caption</label>
              <input
                id="art-cap"
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-xs focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>
            <div>
              <label htmlFor="art-cred" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">Image Credit</label>
              <input
                id="art-cred"
                value={imageCredit}
                onChange={(e) => setImageCredit(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-xs focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
            <div>
              <label htmlFor="art-seo-title" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">SEO Title</label>
              <input
                id="art-seo-title"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-xs focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>
            <div>
              <label htmlFor="art-seo-desc" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">SEO Description</label>
              <input
                id="art-seo-desc"
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-xs focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>
          </div>

          <div className="border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#1e1e1e] p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="art-status" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">Publication Status</label>
              <select
                id="art-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'scheduled' | 'published' | 'archived')}
                className="w-full border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100"
              >
                <option value="draft">Draft</option>
                <option value="published">Published Immediately</option>
                <option value="scheduled">Scheduled (Asia/Kolkata IST)</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {status === 'scheduled' && (
              <>
                <div>
                  <label htmlFor="art-sch-date" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">Schedule Date (IST)</label>
                  <input
                    id="art-sch-date"
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label htmlFor="art-sch-time" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">Schedule Time (IST)</label>
                  <input
                    id="art-sch-time"
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="art-slot" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">Homepage Placement</label>
              <select
                id="art-slot"
                value={featuredSlot || ''}
                onChange={(e) => setFeaturedSlot((e.target.value || null) as FeaturedSlot)}
                className="w-full border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100"
              >
                <option value="">Standard Section</option>
                <option value="lead">Front Page Lead Story</option>
                <option value="top_story">Top Stories Column</option>
                <option value="section_feature">Section Feature</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 text-xs text-neutral-800 dark:text-neutral-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="accent-[#8C1D24]" />
                <span>Featured Flag</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isBreaking} onChange={(e) => setIsBreaking(e.target.checked)} className="accent-[#8C1D24]" />
                <span>Breaking News Ticker</span>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-[#8C1D24] dark:text-[#eb7a80] font-medium">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#8C1D24] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#6e141a]"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Article'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              className="px-5 py-2.5 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 dark:hover:border-neutral-400 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-100">News & Articles ({articles.length})</h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={syncingLive}
            onClick={handleSyncLiveNews}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-900 dark:border-neutral-400 bg-white dark:bg-transparent text-neutral-900 dark:text-neutral-100 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingLive ? 'animate-spin' : ''}`} />
            <span>{syncingLive ? 'Syncing Feeds...' : 'Sync Google News & The Hindu'}</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Article</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 overflow-x-auto">
        <table className="w-full text-left text-xs text-neutral-800 dark:text-neutral-200">
          <thead className="bg-neutral-100 dark:bg-[#1f1f1f] border-b border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Headline</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Placement</th>
              <th className="py-3 px-3">Published (IST)</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {articles.map((art) => (
              <tr key={art.id} className="hover:bg-neutral-50 dark:hover:bg-[#202020]">
                <td className="py-3 px-4 max-w-md">
                  <p className="font-semibold text-neutral-950 dark:text-neutral-100 line-clamp-1">{art.title}</p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{art.author_name}</p>
                </td>
                <td className="py-3 px-3 whitespace-nowrap">{art.category_name}</td>
                <td className="py-3 px-3 uppercase font-semibold whitespace-nowrap">
                  <span className={art.status === 'published' ? 'text-emerald-800 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-400'}>
                    {art.status}
                  </span>
                </td>
                <td className="py-3 px-3 whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                  {art.featured_slot || 'Standard'}
                  {art.is_breaking ? ' · Breaking' : ''}
                </td>
                <td className="py-3 px-3 whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                  {art.published_at ? formatHistoricalArticleDate(art.published_at) : '—'}
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                  {art.status === 'published' && (
                    <a
                      href={`/article/${art.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      title="View Published Article"
                      className="inline-flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-100"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(art)}
                    className="text-neutral-700 dark:text-neutral-300 hover:text-[#8C1D24] dark:hover:text-[#eb7a80]"
                    aria-label={`Edit ${art.title}`}
                  >
                    <Edit3 className="w-4 h-4 inline" />
                  </button>
                  {art.status !== 'published' ? (
                    <button
                      type="button"
                      onClick={() => handleQuickStatus(art, 'published')}
                      className="text-emerald-800 dark:text-emerald-400 font-semibold hover:underline"
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleQuickStatus(art, 'draft')}
                      className="text-amber-800 dark:text-amber-400 font-semibold hover:underline"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(art)}
                    className="text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    aria-label={`Delete ${art.title}`}
                  >
                    <Trash2 className="w-4 h-4 inline" />
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
