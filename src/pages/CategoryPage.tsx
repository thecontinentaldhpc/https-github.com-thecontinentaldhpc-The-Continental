import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useSite } from '../context/SiteContext';
import type { Article } from '../types/publication';
import { formatNewsUpdatedLabel, resolveArticleTimestamp } from '../lib/dateIst';
import { EditorialImage } from '../components/EditorialImage';

export function CategoryPage({ slug, title }: { slug: string; title: string }) {
  const { categories, istDate, setEditionUpdatedAt } = useSite();
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const categoryMeta = categories.find((c) => c.slug === slug);

  useEffect(() => {
    setPage(1);
  }, [slug]);

  const fetchArticles = useCallback(() => {
    setLoading(true);
    api
      .getArticles({ category: slug, page, limit: 12 })
      .then((res) => {
        setArticles(res.articles);
        setTotalPages(res.pagination.totalPages);
        if (res.editionUpdatedAt) {
          setEditionUpdatedAt(res.editionUpdatedAt);
        }
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [slug, page, setEditionUpdatedAt]);

  useEffect(() => {
    document.title = `${categoryMeta?.name || title} | THE CONTINENTAL`;
    fetchArticles();

    const onUpdate = () => fetchArticles();
    window.addEventListener('tc:news-updated', onUpdate);
    window.addEventListener('focus', onUpdate);
    return () => {
      window.removeEventListener('tc:news-updated', onUpdate);
      window.removeEventListener('focus', onUpdate);
    };
  }, [fetchArticles, categoryMeta?.name, title]);

  const lead = articles[0];
  const rest = articles.slice(1);

  return (
    <main className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8">
      <div className="border-b-2 border-neutral-950 dark:border-neutral-200 pb-4 mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">Section Dispatch</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">
          {categoryMeta?.name || title}
        </h1>
        {categoryMeta?.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-2 max-w-2xl">{categoryMeta.description}</p>
        )}
      </div>

      {loading ? (
        <p className="py-12 text-sm text-neutral-500 dark:text-neutral-400">Loading section articles...</p>
      ) : articles.length === 0 ? (
        <div className="border border-neutral-200 dark:border-neutral-800 bg-[#FAF9F6] dark:bg-[#181818] p-10 text-center">
          <p className="font-serif text-xl text-neutral-800 dark:text-neutral-200">No published dispatches in this section yet.</p>
          <Link
            to="/publish-your-writing"
            className="inline-block mt-4 px-5 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white"
          >
            Submit an Article to {categoryMeta?.name || title}
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {lead && (
            <article className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-8 border-b border-neutral-300 dark:border-neutral-800 group">
              {lead.featured_image_url && (
                <Link to={`/article/${lead.slug}`} className="lg:col-span-7 block">
                  <EditorialImage src={lead.featured_image_url} alt={lead.title} aspectClass="aspect-[16/9]" />
                </Link>
              )}
              <div className={lead.featured_image_url ? 'lg:col-span-5 flex flex-col justify-center' : 'lg:col-span-12'}>
                <p className="text-xs font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80] mb-2">Featured in {lead.category_name}</p>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-950 dark:text-neutral-50 group-hover:text-[#8C1D24] dark:group-hover:text-[#eb7a80] leading-tight">
                  <Link to={`/article/${lead.slug}`}>{lead.title}</Link>
                </h2>
                {lead.subheadline && <p className="text-base text-neutral-700 dark:text-neutral-300 mt-3">{lead.subheadline}</p>}
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-3 leading-relaxed">{lead.summary}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-4 tabular-nums">
                  By <span className="font-semibold text-neutral-800 dark:text-neutral-200">{lead.author_name}</span> ·{' '}
                  {(() => {
                    const ts = resolveArticleTimestamp(lead);
                    const lbl = formatNewsUpdatedLabel(ts.iso, new Date(istDate.nowMs));
                    return `${ts.label}: ${lbl.combined}`;
                  })()}
                </p>
              </div>
            </article>
          )}

          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {rest.map((art) => {
                const ts = resolveArticleTimestamp(art);
                const lbl = formatNewsUpdatedLabel(ts.iso, new Date(istDate.nowMs));
                return (
                  <article key={art.id} className="group border-b border-neutral-200 dark:border-neutral-800 pb-6">
                    {art.featured_image_url && (
                      <Link to={`/article/${art.slug}`} className="block mb-3">
                        <EditorialImage src={art.featured_image_url} alt={art.title} aspectClass="aspect-[4/3]" />
                      </Link>
                    )}
                    <h3 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-50 group-hover:text-[#8C1D24] dark:group-hover:text-[#eb7a80] leading-snug">
                      <Link to={`/article/${art.slug}`}>{art.title}</Link>
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-2 line-clamp-3">{art.summary}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3 tabular-nums">
                      {art.author_name} ·{' '}
                      {ts.isUpdated ? `Updated · ${lbl.formatted}` : lbl.formatted}
                    </p>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-neutral-100 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-neutral-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
