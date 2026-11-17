import { useEffect, useState } from 'react';
import { Download, Eye, X } from 'lucide-react';
import { api } from '../lib/api';
import type { EpaperEdition } from '../types/publication';
import { formatImmutableEditionDate } from '../lib/dateIst';
import { BrandLogo } from '../components/BrandLogo';

export function EpaperPage() {
  const [editions, setEditions] = useState<EpaperEdition[]>([]);
  const [selected, setSelected] = useState<EpaperEdition | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Digital Newspaper / E-Paper | THE CONTINENTAL';
    api
      .getEpaper()
      .then((res) => {
        setEditions(res.editions);
        const published = res.editions.find((e) => e.status === 'published' && e.pdf_url);
        setSelected(published || res.editions[0] || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const publishedEditions = editions.filter((e) => (e.status === 'published' || e.status === 'archived') && e.approved_by_admin && e.pdf_url);
  const hasAnyPublished = publishedEditions.length > 0;
  const selectedReady = Boolean(selected && (selected.status === 'published' || selected.status === 'archived') && selected.approved_by_admin && selected.pdf_url);

  return (
    <main className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-10">
      <div className="border-b-2 border-neutral-950 dark:border-neutral-200 pb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8C1D24] dark:text-[#eb7a80]">
            Print-Replica Broadsheet · First Edition 1 January 2027
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">
            DIGITAL NEWSPAPER / E-PAPER
          </h1>
        </div>
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          Every approved newspaper edition permanently retains its original publication date.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading e-paper editions...</p>
      ) : !hasAnyPublished ? (
        <section className="border-2 border-neutral-950 dark:border-neutral-600 bg-[#FAF9F6] dark:bg-[#181818] p-8 sm:p-12 text-center max-w-3xl mx-auto">
          <BrandLogo className="h-14 sm:h-16 w-auto mx-auto mb-5" />
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-950 dark:text-neutral-50">
            THE CONTINENTAL — Our first newspaper edition arrives on 1 January 2027.
          </h2>
          <p className="text-sm sm:text-base text-neutral-700 dark:text-neutral-300 mt-4 leading-relaxed max-w-xl mx-auto">
            PDF reading and downloads activate automatically once an approved daily edition is uploaded and published by the Super Administrator.
          </p>
          {editions.length > 0 && (
            <div className="mt-6 pt-5 border-t border-neutral-300 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-400">
              Scheduled Inaugural Record: <strong>{editions[0].edition_number}</strong> · {formatImmutableEditionDate(editions[0].edition_date)}
            </div>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Active Edition Viewer */}
          <section className="lg:col-span-8 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181818] p-6">
            {selected && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">
                      {selected.edition_number} · {formatImmutableEditionDate(selected.edition_date)}
                    </p>
                    <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">{selected.title}</h2>
                  </div>
                  {selectedReady && (
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(selected.pdf_url!)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Full Screen</span>
                      </button>
                      <a
                        href={selected.pdf_url!}
                        download
                        className="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-900 dark:border-neutral-400 text-neutral-900 dark:text-neutral-100 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-900 dark:hover:bg-neutral-100 hover:text-white dark:hover:text-neutral-950"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download PDF</span>
                      </a>
                    </div>
                  )}
                </div>

                {selectedReady ? (
                  <iframe
                    src={selected.pdf_url!}
                    title={selected.title}
                    className="w-full h-[640px] border border-neutral-200 dark:border-neutral-700 bg-neutral-100"
                  />
                ) : (
                  <div className="py-16 text-center bg-[#FAF9F6] dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800">
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      This edition PDF has not been published yet.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Edition Archive */}
          <aside className="lg:col-span-4 border border-neutral-200 dark:border-neutral-800 p-5">
            <h2 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-50 border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-4">
              Edition Archive
            </h2>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {publishedEditions.map((ed) => (
                <button
                  key={ed.id}
                  type="button"
                  onClick={() => setSelected(ed)}
                  className={`w-full text-left py-3 px-2 transition-colors ${
                    selected?.id === ed.id ? 'bg-[#8C1D24]/5 dark:bg-[#8C1D24]/15' : 'hover:bg-neutral-50 dark:hover:bg-[#1c1c1c]'
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">
                    {ed.edition_number}
                  </p>
                  <p className="font-serif text-base font-bold text-neutral-950 dark:text-neutral-100 mt-0.5">{ed.title}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{formatImmutableEditionDate(ed.edition_date)}</p>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181818] w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
              <span className="font-serif font-bold text-neutral-950 dark:text-neutral-50">E-Paper Reader</span>
              <button type="button" onClick={() => setPreviewUrl(null)} aria-label="Close E-Paper preview" className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe src={previewUrl} title="E-Paper Full Screen" className="flex-1 w-full bg-white" />
          </div>
        </div>
      )}
    </main>
  );
}
