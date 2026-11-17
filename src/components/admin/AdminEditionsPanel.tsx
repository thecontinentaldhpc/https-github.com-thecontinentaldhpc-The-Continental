import React, { useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import type { EditionStatus, EpaperEdition, MagazineIssue } from '../../types/publication';
import { getMonthName } from '../../lib/dateIst';

export function AdminMagazinesPanel({
  magazines,
  onRefresh,
  onNotice,
}: {
  magazines: MagazineIssue[];
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [month, setMonth] = useState(7);
  const [year, setYear] = useState(2027);
  const [editorsNote, setEditorsNote] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [status, setStatus] = useState<EditionStatus>('upcoming');
  const [approved, setApproved] = useState(false);

  const [essayMagId, setEssayMagId] = useState('');
  const [essayTitle, setEssayTitle] = useState('');
  const [essayAuthor, setEssayAuthor] = useState('');
  const [essayCat, setEssayCat] = useState('World Affairs');
  const [essaySummary, setEssaySummary] = useState('');

  const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>, target: 'cover' | 'pdf', updateId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const up = await api.adminUploadMedia(file, file.name, 'THE CONTINENTAL Magazine');
    if (updateId) {
      await api.adminUpdateMagazine(updateId, target === 'pdf' ? { pdf_url: up.url } : { cover_image_url: up.url });
      onNotice(`Uploaded ${target.toUpperCase()} for magazine issue.`);
      await onRefresh();
    } else {
      if (target === 'pdf') setPdfUrl(up.url);
      else setCoverUrl(up.url);
    }
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.adminCreateMagazine({
        title,
        month,
        year,
        cover_image_url: coverUrl || null,
        editors_note: editorsNote,
        pdf_url: pdfUrl || null,
        status,
        approved_by_admin: approved,
      });
      setTitle('');
      setEditorsNote('');
      setCoverUrl('');
      setPdfUrl('');
      setApproved(false);
      onNotice('Magazine issue created.');
      await onRefresh();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Failed to create issue.');
    }
  };

  const handlePublishIssue = async (m: MagazineIssue) => {
    try {
      await api.adminUpdateMagazine(m.id, { status: 'published', approved_by_admin: true });
      onNotice(`${m.issue_code} published.`);
      await onRefresh();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Upload a PDF before publishing.');
    }
  };

  const handleAddEssay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!essayMagId) return;
    await api.adminAddMagazineArticle(essayMagId, {
      title: essayTitle,
      author_name: essayAuthor,
      category_name: essayCat,
      summary: essaySummary,
    });
    setEssayTitle('');
    setEssayAuthor('');
    setEssaySummary('');
    onNotice('Added essay to magazine issue.');
    await onRefresh();
  };

  const handleDeleteIssue = async (m: MagazineIssue) => {
    if (!window.confirm(`Delete magazine issue ${m.issue_code} (${m.title})?`)) return;
    await api.adminDeleteMagazine(m.id);
    onNotice('Magazine issue deleted.');
    await onRefresh();
  };

  return (
    <div className="space-y-8 text-neutral-900 dark:text-neutral-100">
      <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-100">Monthly Magazine Management</h2>

      <form onSubmit={handleCreateIssue} className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C1D24] dark:text-[#eb7a80]">Create Magazine Edition</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold mb-1">Issue Title *</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-full border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{getMonthName(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Year</label>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-xs" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Editor’s Note</label>
          <textarea rows={2} value={editorsNote} onChange={(e) => setEditorsNote(e.target.value)} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-xs" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold mb-1">Cover Image Upload</label>
            <input type="file" accept="image/*" onChange={(e) => handleUploadAsset(e, 'cover')} className="text-xs text-neutral-700 dark:text-neutral-300" />
            {coverUrl && <p className="text-[11px] text-emerald-800 dark:text-emerald-400 mt-1">{coverUrl}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Issue PDF Upload</label>
            <input type="file" accept="application/pdf" onChange={(e) => handleUploadAsset(e, 'pdf')} className="text-xs text-neutral-700 dark:text-neutral-300" />
            {pdfUrl && <p className="text-[11px] text-emerald-800 dark:text-emerald-400 mt-1">{pdfUrl}</p>}
          </div>
          <div className="flex items-center gap-4">
            <select value={status} onChange={(e) => setStatus(e.target.value as EditionStatus)} className="border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
              <option value="upcoming">Upcoming</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="accent-[#8C1D24]" />
              <span>Approved</span>
            </label>
          </div>
        </div>
        <button type="submit" className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors">
          <Plus className="w-4 h-4" />
          <span>Save Magazine Issue</span>
        </button>
      </form>

      {/* Add Essay to Issue */}
      <form onSubmit={handleAddEssay} className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C1D24] dark:text-[#eb7a80]">Add Magazine Essay / Feature</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select required value={essayMagId} onChange={(e) => setEssayMagId(e.target.value)} className="border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
            <option value="">Select Issue...</option>
            {magazines.map((m) => (
              <option key={m.id} value={m.id}>{m.issue_code} ({getMonthName(m.month)} {m.year})</option>
            ))}
          </select>
          <input required placeholder="Essay Title" value={essayTitle} onChange={(e) => setEssayTitle(e.target.value)} className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs" />
          <input required placeholder="Author Name" value={essayAuthor} onChange={(e) => setEssayAuthor(e.target.value)} className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs" />
          <select value={essayCat} onChange={(e) => setEssayCat(e.target.value)} className="border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
            {['World Affairs', 'Politics', 'Culture', 'Education', 'Literature', 'Science and Technology', 'Society', 'Interviews', 'Special Reports'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <input placeholder="Brief summary..." value={essaySummary} onChange={(e) => setEssaySummary(e.target.value)} className="flex-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs" />
          <button type="submit" className="px-4 py-2 bg-[#8C1D24] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#6e141a]">Add Essay</button>
        </div>
      </form>

      <div className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 overflow-x-auto">
        <table className="w-full text-left text-xs text-neutral-800 dark:text-neutral-200">
          <thead className="bg-neutral-100 dark:bg-[#1f1f1f] border-b border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 uppercase">
            <tr>
              <th className="py-3 px-4">Issue</th>
              <th className="py-3 px-3">Title</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">PDF</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {magazines.map((m) => (
              <tr key={m.id} className="hover:bg-neutral-50 dark:hover:bg-[#202020]">
                <td className="py-3 px-4 font-mono whitespace-nowrap">
                  {m.issue_code} ({getMonthName(m.month)} {m.year})
                </td>
                <td className="py-3 px-3">{m.title}</td>
                <td className="py-3 px-3 uppercase font-semibold">{m.status}</td>
                <td className="py-3 px-3">
                  {m.pdf_url ? (
                    <span className="text-emerald-800 dark:text-emerald-400 font-medium">Uploaded</span>
                  ) : (
                    <label className="inline-flex items-center gap-1 text-[#8C1D24] dark:text-[#eb7a80] cursor-pointer underline">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload PDF</span>
                      <input type="file" accept="application/pdf" onChange={(e) => handleUploadAsset(e, 'pdf', m.id)} className="sr-only" />
                    </label>
                  )}
                </td>
                <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                  {m.status !== 'published' && (
                    <button type="button" onClick={() => handlePublishIssue(m)} className="text-emerald-800 dark:text-emerald-400 font-semibold hover:underline">
                      Approve & Publish
                    </button>
                  )}
                  <button type="button" onClick={() => handleDeleteIssue(m)} className="text-red-700 dark:text-red-400" aria-label={`Delete ${m.issue_code}`}>
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

export function AdminEpaperPanel({
  editions,
  onRefresh,
  onNotice,
}: {
  editions: EpaperEdition[];
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}) {
  const [editionNumber, setEditionNumber] = useState('VOL. I · NO. 2');
  const [editionDate, setEditionDate] = useState('2027-01-02');
  const [title, setTitle] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [status, setStatus] = useState<EditionStatus>('draft');
  const [approved, setApproved] = useState(false);

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>, existingId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const up = await api.adminUploadMedia(file, file.name, 'THE CONTINENTAL E-Paper');
    if (existingId) {
      await api.adminUpdateEpaper(existingId, { pdf_url: up.url });
      onNotice('Newspaper PDF uploaded to edition.');
      await onRefresh();
    } else {
      setPdfUrl(up.url);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.adminCreateEpaper({
        edition_number: editionNumber,
        edition_date: editionDate,
        title,
        pdf_url: pdfUrl || null,
        status,
        approved_by_admin: approved,
      });
      setTitle('');
      setPdfUrl('');
      setApproved(false);
      onNotice('E-Paper edition created.');
      await onRefresh();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Unable to create E-Paper edition.');
    }
  };

  const handlePublish = async (ed: EpaperEdition) => {
    try {
      await api.adminUpdateEpaper(ed.id, { status: 'published', approved_by_admin: true });
      onNotice(`E-Paper ${ed.edition_number} published.`);
      await onRefresh();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Upload a PDF before publishing.');
    }
  };

  const handleDelete = async (ed: EpaperEdition) => {
    if (!window.confirm(`Delete E-Paper edition ${ed.edition_number}?`)) return;
    await api.adminDeleteEpaper(ed.id);
    onNotice('E-Paper edition removed.');
    await onRefresh();
  };

  return (
    <div className="space-y-6 text-neutral-900 dark:text-neutral-100">
      <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-100">Digital Newspaper / E-Paper Management</h2>

      <form onSubmit={handleCreate} className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C1D24] dark:text-[#eb7a80]">Upload / Schedule Newspaper Edition</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Edition Number *</label>
            <input required value={editionNumber} onChange={(e) => setEditionNumber(e.target.value)} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-xs font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Edition Date (IST, Permanent) *</label>
            <input required type="date" value={editionDate} onChange={(e) => setEditionDate(e.target.value)} className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Edition Title *</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="THE CONTINENTAL Daily Edition" className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-xs" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <input type="file" accept="application/pdf" onChange={(e) => handleUploadPdf(e)} className="text-xs text-neutral-700 dark:text-neutral-300" />
          {pdfUrl && <span className="text-xs text-emerald-800 dark:text-emerald-400">{pdfUrl}</span>}
          <select value={status} onChange={(e) => setStatus(e.target.value as EditionStatus)} className="border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100">
            <option value="draft">Draft</option>
            <option value="upcoming">Upcoming</option>
            <option value="published">Published</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="accent-[#8C1D24]" />
            <span>Approved for Release</span>
          </label>
          <button type="submit" className="px-5 py-2 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors">
            Save Edition
          </button>
        </div>
      </form>

      <div className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 overflow-x-auto">
        <table className="w-full text-left text-xs text-neutral-800 dark:text-neutral-200">
          <thead className="bg-neutral-100 dark:bg-[#1f1f1f] border-b border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 uppercase">
            <tr>
              <th className="py-3 px-4">Edition</th>
              <th className="py-3 px-3">Date (Immutable)</th>
              <th className="py-3 px-3">Title</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">PDF</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {editions.map((ed) => (
              <tr key={ed.id} className="hover:bg-neutral-50 dark:hover:bg-[#202020]">
                <td className="py-3 px-4 font-mono whitespace-nowrap">{ed.edition_number}</td>
                <td className="py-3 px-3 whitespace-nowrap">{ed.edition_date}</td>
                <td className="py-3 px-3">{ed.title}</td>
                <td className="py-3 px-3 uppercase font-semibold">{ed.status}</td>
                <td className="py-3 px-3">
                  {ed.pdf_url ? (
                    <a href={ed.pdf_url} target="_blank" rel="noreferrer" className="text-emerald-800 dark:text-emerald-400 underline">
                      View PDF
                    </a>
                  ) : (
                    <label className="inline-flex items-center gap-1 text-[#8C1D24] dark:text-[#eb7a80] cursor-pointer underline">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload PDF</span>
                      <input type="file" accept="application/pdf" onChange={(e) => handleUploadPdf(e, ed.id)} className="sr-only" />
                    </label>
                  )}
                </td>
                <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                  {ed.status !== 'published' && (
                    <button type="button" onClick={() => handlePublish(ed)} className="text-emerald-800 dark:text-emerald-400 font-semibold hover:underline">
                      Approve & Publish
                    </button>
                  )}
                  <button type="button" onClick={() => handleDelete(ed)} className="text-red-700 dark:text-red-400" aria-label={`Delete ${ed.edition_number}`}>
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
