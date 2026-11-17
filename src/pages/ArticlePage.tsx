import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Check, Printer, Share2 } from 'lucide-react';
import { api } from '../lib/api';
import { useSite } from '../context/SiteContext';
import type { Article } from '../types/publication';
import { formatHistoricalArticleDate, formatNewsUpdatedLabel, resolveArticleTimestamp } from '../lib/dateIst';
import { sanitizeEditorialHtml } from '../lib/editorialRules';
import { EditorialImage } from '../components/EditorialImage';
import { NewsletterSignup } from '../components/NewsletterSignup';
import { BrandLogo } from '../components/BrandLogo';

export function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { istDate, user, openLoginModal, isArticleSaved, toggleSaveArticle } = useSite();
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const loadArticle = useCallback(() => {
    if (!slug) return;
    setError(null);
    api
      .getArticleBySlug(slug)
      .then((res) => {
        setArticle(res.article);
        setRelated(res.related);
        document.title = res.article.seo_title || `${res.article.title} | THE CONTINENTAL`;
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Article not found.'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    loadArticle();

    const onUpdate = () => loadArticle();
    window.addEventListener('tc:news-updated', onUpdate);
    return () => window.removeEventListener('tc:news-updated', onUpdate);
  }, [loadArticle]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share && article) {
      try {
        await navigator.share({ title: article.title, text: article.summary, url });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggleSave = async () => {
    if (!article) return;
    if (!user) {
      openLoginModal(`/article/${article.slug}`);
      return;
    }
    setSaveNotice(null);
    setSavingBookmark(true);
    try {
      const nowSaved = await toggleSaveArticle(article);
      setSaveNotice(nowSaved ? 'Saved to your reading list.' : 'Removed from your reading list.');
      setTimeout(() => setSaveNotice(null), 4000);
    } catch (err) {
      setSaveNotice(err instanceof Error ? err.message : 'Unable to update reading list.');
    } finally {
      setSavingBookmark(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-sm text-neutral-500 dark:text-neutral-400">
        Loading article...
      </div>
    );
  }

  if (error || !article) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="font-serif text-3xl font-bold text-neutral-950 dark:text-neutral-50">Article Unavailable</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">{error || 'This dispatch could not be located.'}</p>
        <Link
          to="/"
          className="inline-block mt-6 px-5 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white"
        >
          Return to Front Page
        </Link>
      </main>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.seo_description || article.summary,
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at,
    author: { '@type': 'Person', name: article.author_name },
    publisher: { '@type': 'Organization', name: 'THE CONTINENTAL', url: 'https://thecontinental.dhpc.in' },
  };

  return (
    <main className="max-w-[1160px] mx-auto px-4 sm:px-6 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Print Masthead (hidden on screen because site Masthead is visible) */}
      <div className="hidden print:flex items-center justify-between pb-4 mb-6 border-b-2 border-neutral-950">
        <BrandLogo tone="dark" className="h-12 w-auto" />
        <span className="text-xs uppercase tracking-widest text-neutral-700">
          Independent Journalism. Informed World.
        </span>
      </div>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-neutral-500 dark:text-neutral-400 mb-5 flex items-center gap-2 no-print">
        <Link to="/" className="hover:text-[#8C1D24] dark:hover:text-[#eb7a80]">Home</Link>
        <span>/</span>
        <Link to={`/${article.category_slug}`} className="text-[#8C1D24] dark:text-[#eb7a80] font-semibold uppercase tracking-wider hover:underline">
          {article.category_name}
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <article className="lg:col-span-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80] mb-2">
            {article.category_name}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-bold leading-[1.14] text-neutral-950 dark:text-neutral-50">
            {article.title}
          </h1>
          {article.subheadline && (
            <p className="font-prose text-lg sm:text-xl text-neutral-700 dark:text-neutral-300 mt-4 leading-relaxed">
              {article.subheadline}
            </p>
          )}

          {/* Author & Immutable Historical Dates Bar */}
          <div className="mt-6 py-4 border-y border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
              <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-100">
                By {article.author_name}
                {article.author_role ? <span className="font-normal text-neutral-500 dark:text-neutral-400"> · {article.author_role}</span> : null}
              </p>
              <p className="tabular-nums">
                Published: <time dateTime={article.published_at || article.created_at}>{formatHistoricalArticleDate(article.published_at || article.created_at)}</time>
                {(() => {
                  const ts = resolveArticleTimestamp(article);
                  if (!ts.isUpdated) return null;
                  const lbl = formatNewsUpdatedLabel(ts.iso, new Date(istDate.nowMs));
                  return <> · Updated: <time dateTime={ts.iso}>{lbl.formatted}</time></>;
                })()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              {(() => {
                const saved = isArticleSaved(article.id);
                return (
                  <button
                    type="button"
                    data-testid="save-for-later-btn"
                    aria-pressed={saved}
                    disabled={savingBookmark}
                    onClick={handleToggleSave}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold transition-colors disabled:opacity-60 ${
                      saved
                        ? 'border-[#8C1D24] bg-[#8C1D24] text-white hover:bg-[#6e151a]'
                        : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 dark:hover:border-neutral-400'
                    }`}
                  >
                    {saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                    <span>{savingBookmark ? 'Saving...' : saved ? 'Saved' : 'Save for Later'}</span>
                  </button>
                );
              })()}
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 dark:hover:border-neutral-400 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'Link Copied' : 'Share'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 dark:hover:border-neutral-400 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {saveNotice && (
            <div
              role="status"
              data-testid="save-for-later-status"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] px-3.5 py-2 text-xs text-neutral-800 dark:text-neutral-200 no-print"
            >
              <span>{saveNotice}</span>
              {user && (
                <Link
                  to="/reading-list"
                  className="font-semibold text-[#8C1D24] dark:text-[#eb7a80] hover:underline"
                >
                  Open Reading List &rarr;
                </Link>
              )}
            </div>
          )}

          {article.featured_image_url && (
            <figure className="mt-6">
              <EditorialImage src={article.featured_image_url} alt={article.title} aspectClass="aspect-[16/9]" />
              {(article.image_caption || article.image_credit) && (
                <figcaption className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
                  {article.image_caption}
                  {article.image_credit ? ` (${article.image_credit})` : ''}
                </figcaption>
              )}
            </figure>
          )}

          {/* Main Article Body */}
          <div
            className="mt-8 article-prose article-dropcap max-w-prose"
            dangerouslySetInnerHTML={{ __html: sanitizeEditorialHtml(article.content_html) }}
          />

          {/* Tags as unboxed text */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
              <span className="font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mr-2">Topics:</span>
              {article.tags.join(' · ')}
            </div>
          )}

          {/* Author Biography */}
          <section aria-label="Author Biography" className="mt-8 border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">About the Author</p>
            <h2 className="font-serif text-lg font-bold text-neutral-950 dark:text-neutral-50 mt-1">{article.author_name}</h2>
            {article.author_role && <p className="text-xs text-neutral-500 dark:text-neutral-400">{article.author_role}</p>}
            {article.author_bio && <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-2 leading-relaxed">{article.author_bio}</p>}
          </section>
        </article>

        {/* Sidebar: Related Stories & Newsletter Signup */}
        <aside className="lg:col-span-4 lg:border-l lg:border-neutral-200 dark:lg:border-neutral-800 lg:pl-8 no-print space-y-8">
          <div>
            <div className="border-t-2 border-neutral-950 dark:border-neutral-200 border-b border-neutral-300 dark:border-neutral-800 py-2 mb-5">
              <h2 className="font-serif text-lg font-bold text-neutral-950 dark:text-neutral-50">Related in {article.category_name}</h2>
            </div>
            {related.length > 0 ? (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 space-y-5">
                {related.map((rel, i) => (
                  <article key={rel.id} className={i > 0 ? 'pt-5' : ''}>
                    <h3 className="font-serif text-base font-bold text-neutral-950 dark:text-neutral-100 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] leading-snug">
                      <Link to={`/article/${rel.slug}`}>{rel.title}</Link>
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1.5 line-clamp-2">{rel.summary}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5">{rel.author_name}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">More dispatches in {article.category_name} coming soon.</p>
            )}
          </div>

          <NewsletterSignup variant="sidebar" />
        </aside>
      </div>
    </main>
  );
}
