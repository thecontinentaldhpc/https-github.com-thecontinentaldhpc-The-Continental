import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, FileText, PenLine } from 'lucide-react';
import { api } from '../lib/api';
import { useSite } from '../context/SiteContext';
import type { Article } from '../types/publication';
import {
  formatImmutableEditionDate,
  formatNewsUpdatedLabel,
  getMonthName,
  resolveArticleTimestamp,
} from '../lib/dateIst';
import { BreakingNewsBar } from '../components/BreakingNewsBar';
import { EditorialImage } from '../components/EditorialImage';
import { NewsletterBox } from '../components/NewsletterBox';
import { NewsletterSignup } from '../components/NewsletterSignup';
import { BrandLogo } from '../components/BrandLogo';

function SectionHeader({ title, to }: { title: string; to: string }) {
  return (
    <div className="flex items-baseline justify-between border-t-2 border-neutral-950 dark:border-neutral-200 border-b border-neutral-300 dark:border-neutral-800 py-2 mb-5">
      <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">{title}</h2>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80] hover:underline whitespace-nowrap shrink-0"
      >
        <span>View Section</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

function StoryCard({
  article,
  nowMs,
  showImage = true,
  compact = false,
}: {
  article: Article;
  nowMs: number;
  showImage?: boolean;
  compact?: boolean;
}) {
  const ts = resolveArticleTimestamp(article);
  const tsLabel = formatNewsUpdatedLabel(ts.iso, new Date(nowMs));

  return (
    <article className="group flex flex-col">
      {showImage && article.featured_image_url && (
        <Link to={`/article/${article.slug}`} className="block mb-3">
          <EditorialImage src={article.featured_image_url} alt={article.title} aspectClass="aspect-[4/3]" />
        </Link>
      )}
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80] mb-1">
        {article.category_name}
      </p>
      <h3 className={`font-serif font-bold text-neutral-950 dark:text-neutral-50 group-hover:text-[#8C1D24] dark:group-hover:text-[#eb7a80] transition-colors leading-snug ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>
        <Link to={`/article/${article.slug}`}>{article.title}</Link>
      </h3>
      {!compact && article.summary && (
        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-2 line-clamp-3 leading-relaxed">{article.summary}</p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">{article.author_name}</span>
        {ts.iso && (
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={ts.iso}>
              {ts.isUpdated ? `Updated · ${tsLabel.formatted}` : tsLabel.formatted}
            </time>
          </>
        )}
      </div>
    </article>
  );
}

export function HomePage() {
  const { istDate, setEditionUpdatedAt } = useSite();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getHomepage>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHomepage = useCallback(async () => {
    try {
      const res = await api.getHomepage();
      setData(res);
      if (res.editionUpdatedAt) {
        setEditionUpdatedAt(res.editionUpdatedAt);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load front page.');
    } finally {
      setLoading(false);
    }
  }, [setEditionUpdatedAt]);

  useEffect(() => {
    document.title = 'THE CONTINENTAL — Independent Journalism. Informed World.';
    void loadHomepage();

    const intervalId = setInterval(() => {
      void loadHomepage();
    }, 30_000);

    const handleFocus = () => {
      void loadHomepage();
    };
    const handleNewsUpdated = () => {
      void loadHomepage();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('tc:news-updated', handleNewsUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('tc:news-updated', handleNewsUpdated);
    };
  }, [loadHomepage]);

  if (loading) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Loading front page edition...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-sm text-[#8C1D24] dark:text-[#eb7a80] font-medium">{error || 'Front page unavailable.'}</p>
      </div>
    );
  }

  const { lead, topStories, breaking, sections, latestNews, latestMagazine, latestEpaper, editionUpdatedAt } = data;
  const epaperReady = Boolean(latestEpaper && latestEpaper.status === 'published' && latestEpaper.pdf_url);
  const editionFreshness = formatNewsUpdatedLabel(editionUpdatedAt, new Date(istDate.nowMs));
  const leadTimestamp = lead ? resolveArticleTimestamp(lead) : null;
  const leadTimeLabel = leadTimestamp ? formatNewsUpdatedLabel(leadTimestamp.iso, new Date(istDate.nowMs)) : null;

  return (
    <div>
      {/* Section 2: Breaking News */}
      <BreakingNewsBar items={breaking} />

      <main className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-12">
        {editionUpdatedAt && (
          <div
            data-testid="frontpage-edition-updated"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3 -mt-2 text-xs text-neutral-600 dark:text-neutral-400 tabular-nums"
          >
            <span className="font-semibold uppercase tracking-[0.14em] text-neutral-800 dark:text-neutral-200">
              Front Page Edition
            </span>
            <span>
              Last Updated:{' '}
              <time dateTime={editionUpdatedAt} className="font-medium text-neutral-900 dark:text-neutral-100">
                {editionFreshness.combined}
              </time>
            </span>
          </div>
        )}

        {/* Section 3 & 4: Lead Story + Top Stories Broadsheet Front Page */}
        <section aria-label="Front Page Lead and Top Stories" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Lead Story (7 cols) */}
          {lead && (
            <article className="lg:col-span-7 group lg:pr-6 lg:border-r lg:border-neutral-200 dark:lg:border-neutral-800">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80] mb-2">
                Lead Dispatch · {lead.category_name}
              </p>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-bold leading-[1.12] text-neutral-950 dark:text-neutral-50 group-hover:text-[#8C1D24] dark:group-hover:text-[#eb7a80] transition-colors">
                <Link to={`/article/${lead.slug}`}>{lead.title}</Link>
              </h1>
              {lead.subheadline && (
                <p className="font-prose text-lg text-neutral-700 dark:text-neutral-300 mt-3 leading-relaxed">
                  {lead.subheadline}
                </p>
              )}

              {lead.featured_image_url && (
                <figure className="mt-5">
                  <Link to={`/article/${lead.slug}`} className="block">
                    <EditorialImage
                      src={lead.featured_image_url}
                      alt={lead.title}
                      aspectClass="aspect-[16/9]"
                    />
                  </Link>
                  {lead.image_caption && (
                    <figcaption className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
                      {lead.image_caption}
                      {lead.image_credit ? ` — ${lead.image_credit}` : ''}
                    </figcaption>
                  )}
                </figure>
              )}

              <p className="text-base text-neutral-800 dark:text-neutral-200 mt-4 leading-relaxed">{lead.summary}</p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <div className="text-xs text-neutral-600 dark:text-neutral-400 flex flex-wrap items-center gap-2 tabular-nums">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">By {lead.author_name}</span>
                  {leadTimestamp && leadTimeLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <time dateTime={leadTimestamp.iso}>
                        {leadTimestamp.label}: {leadTimeLabel.combined}
                      </time>
                    </>
                  )}
                </div>
                <Link
                  to={`/article/${lead.slug}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80] hover:underline"
                >
                  <span>Read Full Article</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          )}

          {/* Top Stories & Wire Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="border-b-2 border-neutral-950 dark:border-neutral-200 pb-1.5 flex items-baseline justify-between">
              <h2 className="font-serif text-lg font-bold uppercase tracking-wide text-neutral-950 dark:text-neutral-50">Top Stories</h2>
              <span className="text-[11px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Front Page</span>
            </div>

            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 space-y-5">
              {topStories.slice(0, 4).map((story, idx) => (
                <article key={story.id} className={`group ${idx > 0 ? 'pt-5' : ''}`}>
                  <div className="grid grid-cols-12 gap-4 items-start">
                    <div className={story.featured_image_url ? 'col-span-8' : 'col-span-12'}>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80] mb-1">
                        {story.category_name}
                      </p>
                      <h3 className="font-serif text-lg font-bold text-neutral-950 dark:text-neutral-50 group-hover:text-[#8C1D24] dark:group-hover:text-[#eb7a80] leading-snug">
                        <Link to={`/article/${story.slug}`}>{story.title}</Link>
                      </h3>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1.5 line-clamp-2">{story.summary}</p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 tabular-nums">
                        {story.author_name}
                        {(() => {
                          const st = resolveArticleTimestamp(story);
                          const stLabel = formatNewsUpdatedLabel(st.iso, new Date(istDate.nowMs));
                          return st.iso
                            ? ` · ${st.isUpdated ? `Updated · ${stLabel.formatted}` : stLabel.formatted}`
                            : '';
                        })()}
                      </p>
                    </div>
                    {story.featured_image_url && (
                      <Link to={`/article/${story.slug}`} className="col-span-4 block">
                        <EditorialImage src={story.featured_image_url} alt={story.title} aspectClass="aspect-[4/3]" />
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <NewsletterSignup variant="sidebar" />
          </div>
        </section>

        {/* Section 5: World News */}
        {sections.world.length > 0 && (
          <section aria-label="World News">
            <SectionHeader title="World" to="/world" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:divide-x lg:divide-neutral-200 dark:lg:divide-neutral-800">
              {sections.world.map((art, i) => (
                <div key={art.id} className={i > 0 ? 'lg:pl-6' : ''}>
                  <StoryCard article={art} nowMs={istDate.nowMs} showImage={i === 0} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 6 & 7: India (National) & Regional News */}
        <section aria-label="National and Regional News" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <SectionHeader title="India" to="/india" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {sections.india.map((art) => (
                <StoryCard key={art.id} article={art} nowMs={istDate.nowMs} showImage={Boolean(art.featured_image_url)} />
              ))}
              {sections.india.length === 0 && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">No dispatches filed in India yet.</p>
              )}
            </div>
          </div>
          <div className="lg:col-span-5 lg:border-l lg:border-neutral-200 dark:lg:border-neutral-800 lg:pl-8">
            <SectionHeader title="Regional" to="/regional" />
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 space-y-4">
              {sections.regional.map((art, idx) => (
                <div key={art.id} className={idx > 0 ? 'pt-4' : ''}>
                  <StoryCard article={art} nowMs={istDate.nowMs} showImage={false} />
                </div>
              ))}
              {sections.regional.length === 0 && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">No regional dispatches published yet.</p>
              )}
            </div>
          </div>
        </section>

        {/* Section 8: Politics, Business & Economy */}
        <section aria-label="Politics, Business and Economy" className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <SectionHeader title="Politics" to="/politics" />
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 space-y-4">
              {sections.politics.map((art, i) => (
                <div key={art.id} className={i > 0 ? 'pt-4' : ''}>
                  <StoryCard article={art} nowMs={istDate.nowMs} showImage={false} />
                </div>
              ))}
            </div>
          </div>

          <div className="md:border-l md:border-neutral-200 dark:md:border-neutral-800 md:pl-8">
            <SectionHeader title="Business" to="/business" />
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 space-y-4">
              {sections.business.map((art, i) => (
                <div key={art.id} className={i > 0 ? 'pt-4' : ''}>
                  <StoryCard article={art} nowMs={istDate.nowMs} showImage={false} />
                </div>
              ))}
            </div>
          </div>

          <div className="md:border-l md:border-neutral-200 dark:md:border-neutral-800 md:pl-8">
            <SectionHeader title="Economy" to="/economy" />
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 space-y-4">
              {sections.economy.map((art, i) => (
                <div key={art.id} className={i > 0 ? 'pt-4' : ''}>
                  <StoryCard article={art} nowMs={istDate.nowMs} showImage={i === 0} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 9 & 10: Education, Science & Technology, Environment & Sports */}
        <section aria-label="Education, Science, Environment and Sports" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6">
            <SectionHeader title="Education" to="/education" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {sections.education.map((art) => (
                <StoryCard key={art.id} article={art} nowMs={istDate.nowMs} showImage={Boolean(art.featured_image_url)} />
              ))}
            </div>
          </div>
          <div className="lg:col-span-6 lg:border-l lg:border-neutral-200 dark:lg:border-neutral-800 lg:pl-8">
            <SectionHeader title="Science & Technology" to="/science-technology" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {sections.scienceTechnology.map((art) => (
                <StoryCard key={art.id} article={art} nowMs={istDate.nowMs} showImage={Boolean(art.featured_image_url)} />
              ))}
            </div>
          </div>
        </section>

        <section aria-label="Environment and Sports" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6">
            <SectionHeader title="Environment" to="/environment" />
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 space-y-4">
              {sections.environment.map((art, i) => (
                <div key={art.id} className={i > 0 ? 'pt-4' : ''}>
                  <StoryCard article={art} nowMs={istDate.nowMs} showImage={false} />
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-6 lg:border-l lg:border-neutral-200 dark:lg:border-neutral-800 lg:pl-8">
            <SectionHeader title="Sports" to="/sports" />
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 space-y-4">
              {sections.sports.map((art, i) => (
                <div key={art.id} className={i > 0 ? 'pt-4' : ''}>
                  <StoryCard article={art} nowMs={istDate.nowMs} showImage={false} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 11: Opinion & Editorial */}
        <section aria-label="Opinion and Editorial" className="bg-[#FAF9F6] dark:bg-[#171717] border-y border-neutral-300 dark:border-neutral-800 py-8 px-5 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6">
              <div className="border-b-2 border-[#8C1D24] pb-2 mb-5 flex items-baseline justify-between">
                <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-50">Editorial</h2>
                <Link to="/editorial" className="text-xs font-semibold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80] hover:underline">
                  All Editorials
                </Link>
              </div>
              <div className="space-y-6">
                {sections.editorial.map((art) => (
                  <article key={art.id} className="group">
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-neutral-950 dark:text-neutral-50 group-hover:text-[#8C1D24] dark:group-hover:text-[#eb7a80]">
                      <Link to={`/article/${art.slug}`}>{art.title}</Link>
                    </h3>
                    <p className="font-prose text-base text-neutral-700 dark:text-neutral-300 mt-2 leading-relaxed">{art.summary}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{art.author_name}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 lg:border-l lg:border-neutral-300 dark:lg:border-neutral-800 lg:pl-8">
              <div className="border-b-2 border-neutral-950 dark:border-neutral-200 pb-2 mb-5 flex items-baseline justify-between">
                <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-50">Opinion & Analysis</h2>
                <Link to="/opinion" className="text-xs font-semibold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80] hover:underline">
                  All Columns
                </Link>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 space-y-5">
                {sections.opinion.map((art, i) => (
                  <div key={art.id} className={i > 0 ? 'pt-5' : ''}>
                    <StoryCard article={art} nowMs={istDate.nowMs} showImage={false} />
                  </div>
                ))}
              </div>

              {/* Publish Your Writing Invitation */}
              <div className="mt-6 pt-5 border-t border-neutral-300 dark:border-neutral-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">Contribute</p>
                  <p className="text-sm text-neutral-800 dark:text-neutral-200 mt-0.5">
                    Have an original perspective or research dispatch? Submit for editorial review.
                  </p>
                </div>
                <Link
                  to="/publish-your-writing"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  <span>Publish Your Writing</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 12, 13 & 14: Latest Wire + Monthly Magazine + E-Paper */}
        <section aria-label="Latest News, Magazine and E-Paper" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Latest News Wire (4 cols) */}
          <div className="lg:col-span-4">
            <div className="border-t-2 border-neutral-950 dark:border-neutral-200 border-b border-neutral-300 dark:border-neutral-800 py-2 mb-4">
              <h2 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-50">Latest News</h2>
            </div>
            <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {latestNews.slice(0, 7).map((art, idx) => (
                <li key={art.id} className="py-3 flex items-baseline gap-3">
                  <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500 tabular-nums shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">
                      {art.category_name}
                    </p>
                    <Link
                      to={`/article/${art.slug}`}
                      className="font-serif text-sm font-bold text-neutral-950 dark:text-neutral-100 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] leading-snug block mt-0.5"
                    >
                      {art.title}
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Section 13: THE CONTINENTAL MAGAZINE (4 cols) */}
          <div className="lg:col-span-4 lg:border-l lg:border-neutral-200 dark:lg:border-neutral-800 lg:pl-8">
            <div className="border-t-2 border-[#8C1D24] border-b border-neutral-300 dark:border-neutral-800 py-2 mb-4 flex items-baseline justify-between">
              <h2 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-50">The Continental Magazine</h2>
              <BookOpen className="w-4 h-4 text-[#8C1D24] dark:text-[#eb7a80]" />
            </div>
            {latestMagazine ? (
              <div className="border border-neutral-200 dark:border-neutral-800 p-5 bg-white dark:bg-[#181818]">
                {latestMagazine.cover_image_url && (
                  <Link to="/magazine" className="block mb-4">
                    <EditorialImage
                      src={latestMagazine.cover_image_url}
                      alt={latestMagazine.title}
                      aspectClass="aspect-[3/4]"
                    />
                  </Link>
                )}
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">
                  Monthly Issue · {getMonthName(latestMagazine.month)} {latestMagazine.year}
                </p>
                <h3 className="font-serif text-lg font-bold text-neutral-950 dark:text-neutral-50 mt-1">
                  {latestMagazine.title}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-2 line-clamp-3 leading-relaxed">
                  {latestMagazine.editors_note}
                </p>
                <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {latestMagazine.status === 'published' ? 'Published Edition' : 'Upcoming — Jan 2027'}
                  </span>
                  <Link
                    to="/magazine"
                    className="text-xs font-bold uppercase tracking-wider text-[#8C1D24] dark:text-[#eb7a80] hover:underline"
                  >
                    Explore Issue
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Magazine edition details coming soon.</p>
            )}
          </div>

          {/* Section 14: E-Paper (4 cols) */}
          <div className="lg:col-span-4 lg:border-l lg:border-neutral-200 dark:lg:border-neutral-800 lg:pl-8">
            <div className="border-t-2 border-neutral-950 dark:border-neutral-200 border-b border-neutral-300 dark:border-neutral-800 py-2 mb-4 flex items-baseline justify-between">
              <h2 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-50">Digital E-Paper</h2>
              <FileText className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
            </div>
            <div className="border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] p-6">
              <BrandLogo className="h-9 w-auto mb-3" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">
                Daily Print-Replica Edition
              </p>
              {epaperReady && latestEpaper ? (
                <>
                  <h3 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-50 mt-2">
                    {latestEpaper.title}
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                    {latestEpaper.edition_number} · {formatImmutableEditionDate(latestEpaper.edition_date)}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      to="/epaper"
                      className="px-4 py-2 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white"
                    >
                      Read E-Paper
                    </Link>
                    <a
                      href={latestEpaper.pdf_url!}
                      download
                      className="px-4 py-2 border border-neutral-900 dark:border-neutral-400 text-neutral-900 dark:text-neutral-100 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-900 dark:hover:bg-neutral-100 hover:text-white dark:hover:text-neutral-950"
                    >
                      Download PDF
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-50 mt-2 leading-snug">
                    THE CONTINENTAL — Our first newspaper edition arrives on 1 January 2027.
                  </h3>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-3 leading-relaxed">
                    Our daily broadsheet PDF e-paper will be archived permanently by edition number and publication date once approved and published by the editorial desk.
                  </p>
                  <Link
                    to="/epaper"
                    className="inline-block mt-5 px-4 py-2 border border-neutral-900 dark:border-neutral-400 text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 dark:hover:bg-neutral-100 hover:text-white dark:hover:text-neutral-950 transition-colors"
                  >
                    Visit E-Paper Desk
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Section 15: Newsletter */}
        <NewsletterBox />
      </main>
    </div>
  );
}
