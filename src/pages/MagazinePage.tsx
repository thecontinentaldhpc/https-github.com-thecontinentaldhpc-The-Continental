import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Eye, X } from 'lucide-react';
import { api } from '../lib/api';
import type { MagazineIssue } from '../types/publication';
import { getMonthName } from '../lib/dateIst';
import { sanitizeEditorialHtml } from '../lib/editorialRules';
import { EditorialImage } from '../components/EditorialImage';
import { BrandLogo } from '../components/BrandLogo';

const MAGAZINE_CATEGORIES = [
  'All',
  'World Affairs',
  'Politics',
  'Culture',
  'Education',
  'Literature',
  'Science and Technology',
  'Society',
  'Interviews',
  'Special Reports',
];

export function MagazinePage() {
  const [magazines, setMagazines] = useState<MagazineIssue[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [readingEssayId, setReadingEssayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    document.title = 'THE CONTINENTAL MAGAZINE | Monthly Digital Magazine';
    api
      .getMagazines()
      .then((res) => {
        setMagazines(res.magazines);
        const qIssue = searchParams.get('issue');
        if (qIssue && res.magazines.some((m) => m.issue_code === qIssue)) {
          setSelectedCode(qIssue);
        } else if (res.magazines.length > 0) {
          const published = res.magazines.find((m) => m.status === 'published');
          setSelectedCode(published ? published.issue_code : res.magazines[0].issue_code);
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const currentIssue = magazines.find((m) => m.issue_code === selectedCode) || magazines[0] || null;
  const upcomingIssues = magazines.filter((m) => m.status === 'upcoming' && m.issue_code !== currentIssue?.issue_code);
  const years = Array.from(new Set(magazines.map((m) => m.year))).sort((a, b) => b - a);

  const issueArticles = (currentIssue?.articles || []).filter(
    (a) => activeCategory === 'All' || a.category_name === activeCategory
  );
  const readingEssay = issueArticles.find((a) => a.id === readingEssayId) || null;
  const hasDownloadablePdf = Boolean(
    currentIssue && currentIssue.status === 'published' && currentIssue.approved_by_admin && currentIssue.pdf_url
  );

  return (
    <main className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-12">
      <div className="border-b-2 border-[#8C1D24] pb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <BrandLogo className="h-11 sm:h-12 w-auto mb-3" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8C1D24] dark:text-[#eb7a80]">
            Monthly Long-Form Journal · First Issue January 2027
          </p>
          <h1 className="font-serif text-3xl sm:text-5xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">
            THE CONTINENTAL MAGAZINE
          </h1>
        </div>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-sm">
          Published monthly. In-depth reporting, essays, interviews, literature, and special reports.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading magazine archive...</p>
      ) : !currentIssue ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No magazine issues configured yet.</p>
      ) : (
        <>
          {/* Current Issue Hero */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start border-b border-neutral-300 dark:border-neutral-800 pb-12">
            <div className="lg:col-span-4">
              <div className="border border-neutral-300 dark:border-neutral-700 p-2 bg-[#FAF9F6] dark:bg-[#181818]">
                <EditorialImage
                  src={currentIssue.cover_image_url}
                  alt={`${currentIssue.title} Cover`}
                  aspectClass="aspect-[3/4]"
                />
              </div>
            </div>

            <div className="lg:col-span-8 space-y-5">
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
                <span className="font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">
                  {getMonthName(currentIssue.month)} {currentIssue.year}
                </span>
                <span>·</span>
                <span className="font-mono">{currentIssue.issue_code}</span>
                <span>·</span>
                <span className="uppercase tracking-wider font-semibold">
                  {currentIssue.status === 'published' ? 'Published Edition' : 'Upcoming / Planned Edition'}
                </span>
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-neutral-950 dark:text-neutral-50 leading-tight">
                {currentIssue.title}
              </h2>

              <div className="border-t border-b border-neutral-200 dark:border-neutral-800 py-5">
                <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2">Editor’s Note</p>
                <p className="font-prose text-base text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-line">
                  {currentIssue.editors_note}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {hasDownloadablePdf ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewPdfUrl(currentIssue.pdf_url!)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Preview Issue PDF</span>
                    </button>
                    <a
                      href={currentIssue.pdf_url!}
                      download
                      className="inline-flex items-center gap-2 px-5 py-2.5 border border-neutral-900 dark:border-neutral-400 text-neutral-900 dark:text-neutral-100 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-900 dark:hover:bg-neutral-100 hover:text-white dark:hover:text-neutral-950"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PDF</span>
                    </a>
                  </>
                ) : (
                  <div className="border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] px-4 py-3 text-xs text-neutral-700 dark:text-neutral-300">
                    The downloadable PDF edition for {getMonthName(currentIssue.month)} {currentIssue.year} will be available once finalised and approved by the editorial desk.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Magazine Contents & Categories */}
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-50">Issue Contents</h2>
              <div className="flex flex-wrap gap-1.5">
                {MAGAZINE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      activeCategory === cat
                        ? 'bg-[#8C1D24] text-white'
                        : 'bg-neutral-100 dark:bg-[#1e1e1e] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2a2a2a]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {issueArticles.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 py-6">
                No essays listed under “{activeCategory}” for this issue yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {issueArticles.map((item) => (
                  <article key={item.id} className="border border-neutral-200 dark:border-neutral-800 p-6 bg-white dark:bg-[#181818] flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">
                        {item.category_name} {item.is_featured ? '· Featured Essay' : ''}
                      </p>
                      <h3 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-50 mt-1.5">{item.title}</h3>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-2 leading-relaxed">{item.summary}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{item.author_name}</span>
                      <button
                        type="button"
                        onClick={() => setReadingEssayId(item.id)}
                        className="font-bold uppercase tracking-wider text-[#8C1D24] dark:text-[#eb7a80] hover:underline"
                      >
                        Read Excerpt
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Archive by Year and Month + Upcoming Issues */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-neutral-300 dark:border-neutral-800">
            <div className="lg:col-span-7">
              <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-50 mb-4">Archive by Year & Month</h2>
              <div className="space-y-5">
                {years.map((yr) => (
                  <div key={yr} className="border border-neutral-200 dark:border-neutral-800 p-5">
                    <h3 className="font-mono text-base font-bold text-neutral-950 dark:text-neutral-100 mb-3">{yr}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {magazines
                        .filter((m) => m.year === yr)
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedCode(m.issue_code);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className={`text-left px-3 py-2 border text-xs transition-colors ${
                              m.issue_code === currentIssue.issue_code
                                ? 'border-[#8C1D24] dark:border-[#eb7a80] bg-[#8C1D24]/5 dark:bg-[#8C1D24]/15 font-bold text-[#8C1D24] dark:text-[#eb7a80]'
                                : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 text-neutral-800 dark:text-neutral-200'
                            }`}
                          >
                            <span className="block">{getMonthName(m.month)}</span>
                            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 capitalize">{m.status}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5">
              <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-50 mb-4">Upcoming Schedule</h2>
              <div className="border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
                {upcomingIssues.slice(0, 5).map((up) => (
                  <div key={up.id} className="p-4 flex items-baseline justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">
                        {getMonthName(up.month)} {up.year}
                      </p>
                      <p className="font-serif text-base font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">{up.title}</p>
                    </div>
                    <span className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 shrink-0">Planned</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Essay Excerpt Modal */}
      {readingEssay && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181818] max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 border border-neutral-900 dark:border-neutral-600">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">{readingEssay.category_name}</p>
                <h3 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">{readingEssay.title}</h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">By {readingEssay.author_name}</p>
              </div>
              <button type="button" onClick={() => setReadingEssayId(null)} aria-label="Close essay modal" className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div
              className="mt-5 article-prose"
              dangerouslySetInnerHTML={{ __html: sanitizeEditorialHtml(readingEssay.content_html) }}
            />
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181818] w-full max-w-5xl h-[88vh] flex flex-col border border-neutral-900 dark:border-neutral-600">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
              <span className="font-serif font-bold text-base text-neutral-950 dark:text-neutral-50">Magazine PDF Reader</span>
              <button type="button" onClick={() => setPreviewPdfUrl(null)} aria-label="Close PDF preview" className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe src={previewPdfUrl} title="THE CONTINENTAL Magazine PDF" className="flex-1 w-full bg-white" />
          </div>
        </div>
      )}
    </main>
  );
}
