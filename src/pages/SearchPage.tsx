import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useSite } from '../context/SiteContext';
import { formatHistoricalArticleDate } from '../lib/dateIst';

export function SearchPage() {
  const { categories } = useSite();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [type, setType] = useState(searchParams.get('type') || 'all');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [page, setPage] = useState(Number(searchParams.get('page') || 1));

  const [results, setResults] = useState<Awaited<ReturnType<typeof api.search>>['results']>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const runSearch = async (paramsObj: {
    q: string;
    type: string;
    category: string;
    dateFrom: string;
    dateTo: string;
    page: number;
  }) => {
    setLoading(true);
    try {
      const res = await api.search(paramsObj);
      setResults(res.results);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Search Archives | THE CONTINENTAL';
    runSearch({ q, type, category, dateFrom, dateTo, page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextParams = new URLSearchParams();
    if (q) nextParams.set('q', q);
    if (type !== 'all') nextParams.set('type', type);
    if (category) nextParams.set('category', category);
    if (dateFrom) nextParams.set('dateFrom', dateFrom);
    if (dateTo) nextParams.set('dateTo', dateTo);
    setSearchParams(nextParams);
    setPage(1);
    runSearch({ q, type, category, dateFrom, dateTo, page: 1 });
  };

  return (
    <main className="max-w-[1160px] mx-auto px-4 sm:px-6 py-8">
      <div className="border-b-2 border-neutral-950 dark:border-neutral-200 pb-4 mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">Publication Archive</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">Search THE CONTINENTAL</h1>
      </div>

      <form onSubmit={handleSubmit} className="border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] p-5 mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <label htmlFor="search-query" className="sr-only">Search keywords</label>
          <input
            id="search-query"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search headlines, article text, authors, magazine, or e-paper..."
            className="flex-1 bg-white dark:bg-[#121212] border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-300"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white"
          >
            <SearchIcon className="w-4 h-4" />
            <span>Search</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label htmlFor="search-type" className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Content Type</label>
            <select
              id="search-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-white dark:bg-[#121212] border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-neutral-900 dark:text-neutral-100"
            >
              <option value="all">All Publications</option>
              <option value="article">News & Articles</option>
              <option value="magazine">Monthly Magazine</option>
              <option value="epaper">Digital E-Paper</option>
            </select>
          </div>

          <div>
            <label htmlFor="search-category" className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Category</label>
            <select
              id="search-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white dark:bg-[#121212] border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-neutral-900 dark:text-neutral-100"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="search-from" className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">From Date (IST)</label>
            <input
              id="search-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-white dark:bg-[#121212] border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label htmlFor="search-to" className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">To Date (IST)</label>
            <input
              id="search-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-white dark:bg-[#121212] border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>
      </form>

      <div className="mb-4 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
        <span>{loading ? 'Searching...' : `${total} matching record${total === 1 ? '' : 's'}`}</span>
      </div>

      {results.length === 0 && !loading ? (
        <div className="border border-neutral-200 dark:border-neutral-800 p-10 text-center text-sm text-neutral-600 dark:text-neutral-400">
          No published results matched your search criteria. Try broadening your filters.
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border-t border-neutral-300 dark:border-neutral-700">
          {results.map((item) => (
            <article key={`${item.resultType}-${item.id}`} className="py-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C1D24] dark:text-[#eb7a80]">
                {item.resultType} · {item.category}
              </p>
              <h2 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-50 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] mt-1">
                <Link to={item.url}>{item.title}</Link>
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1.5 line-clamp-2">{item.summary}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                {item.subtitle} · {item.date.length === 10 ? item.date : formatHistoricalArticleDate(item.date)}
              </p>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-neutral-100 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="font-mono text-xs text-neutral-600 dark:text-neutral-400">Page {page} of {totalPages}</span>
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
    </main>
  );
}
