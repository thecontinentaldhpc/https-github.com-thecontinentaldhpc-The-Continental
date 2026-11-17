import { useState } from 'react';
import { CheckCircle2, Eye } from 'lucide-react';
import { api } from '../../lib/api';
import type { PublicSubmission, SubmissionStatus } from '../../types/publication';
import { formatHistoricalArticleDate } from '../../lib/dateIst';
import { sanitizeEditorialHtml, SUBMISSION_STATUS_ORDER } from '../../lib/editorialRules';

interface Props {
  submissions: PublicSubmission[];
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}

export function AdminSubmissionsPanel({ submissions, onRefresh, onNotice }: Props) {
  const [selected, setSelected] = useState<PublicSubmission | null>(null);
  const [status, setStatus] = useState<SubmissionStatus>('Under Review');
  const [internalNotes, setInternalNotes] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [saving, setSaving] = useState(false);

  const openReview = (sub: PublicSubmission) => {
    setSelected(sub);
    setStatus(sub.status);
    setInternalNotes(sub.internal_notes || '');
    setEditTitle(sub.title);
    setEditSummary(sub.short_description);
  };

  const handleSaveReview = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.adminUpdateSubmission(selected.id, {
        status,
        internal_notes: internalNotes,
        title: editTitle,
        short_description: editSummary,
      });
      onNotice(`Updated submission ${selected.submission_code}.`);
      setSelected(null);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleApproveAndPublish = async () => {
    if (!selected) return;
    if (!window.confirm(`Approve and publish "${editTitle}" to live public articles?`)) return;
    setSaving(true);
    try {
      await api.adminUpdateSubmission(selected.id, {
        status: 'Approved',
        internal_notes: internalNotes,
        title: editTitle,
        short_description: editSummary,
      });
      const res = await api.adminPublishSubmission(selected.id);
      window.dispatchEvent(
        new CustomEvent('tc:news-updated', { detail: { editionUpdatedAt: res.editionUpdatedAt } })
      );
      onNotice(`Submission published live as /article/${res.slug}`);
      setSelected(null);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  if (selected) {
    return (
      <div className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-4">
          <div>
            <p className="font-mono text-xs text-[#8C1D24] dark:text-[#eb7a80] font-semibold">{selected.submission_code}</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-100 mt-0.5">Review Contributor Submission</h2>
          </div>
          <button type="button" onClick={() => setSelected(null)} className="text-xs underline text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-100">
            Back to Queue
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-[#FAF9F6] dark:bg-[#1e1e1e] text-neutral-800 dark:text-neutral-200 p-4 border border-neutral-200 dark:border-neutral-700">
          <div>
            <p><strong>Contributor:</strong> {selected.full_name}</p>
            <p className="mt-1"><strong>Email:</strong> {selected.email}</p>
            <p className="mt-1"><strong>Category:</strong> {selected.category_name}</p>
          </div>
          <div>
            <p><strong>Submitted (IST):</strong> {formatHistoricalArticleDate(selected.created_at)}</p>
            <p className="mt-1"><strong>Author Bio:</strong> {selected.author_bio}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="sub-rev-title" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
              Headline (Editable by Desk)
            </label>
            <input
              id="sub-rev-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
            />
          </div>
          <div>
            <label htmlFor="sub-rev-sum" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
              Standfirst / Short Description
            </label>
            <textarea
              id="sub-rev-sum"
              rows={2}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
            />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1.5">Submitted Manuscript</p>
            <div
              className="border border-neutral-200 dark:border-neutral-700 p-5 max-h-80 overflow-y-auto article-prose bg-white dark:bg-[#141414]"
              dangerouslySetInnerHTML={{ __html: sanitizeEditorialHtml(selected.content_html) }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
            <div>
              <label htmlFor="sub-rev-status" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                Editorial Workflow Status
              </label>
              <select
                id="sub-rev-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as SubmissionStatus)}
                className="w-full border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              >
                {SUBMISSION_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sub-rev-notes" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                Private Internal Editorial Notes (Never Public)
              </label>
              <textarea
                id="sub-rev-notes"
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Fact-checking remarks, revision feedback..."
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveReview}
            className="px-5 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 dark:hover:bg-neutral-300 transition-colors"
          >
            Save Editorial Decision
          </button>
          {selected.status !== 'Published' && (
            <button
              type="button"
              disabled={saving}
              onClick={handleApproveAndPublish}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#8C1D24] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#6d141a]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve & Publish Live</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-100">Public Writing Submissions ({submissions.length})</h2>
      <div className="bg-white dark:bg-[#181818] border border-neutral-300 dark:border-neutral-700 overflow-x-auto">
        <table className="w-full text-left text-xs text-neutral-800 dark:text-neutral-200">
          <thead className="bg-neutral-100 dark:bg-[#1f1f1f] border-b border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-3">Title & Contributor</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Received (IST)</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                  No public submissions received yet.
                </td>
              </tr>
            ) : (
              submissions.map((s) => (
                <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-[#202020]">
                  <td className="py-3 px-4 font-mono whitespace-nowrap">{s.submission_code}</td>
                  <td className="py-3 px-3 max-w-sm">
                    <p className="font-semibold text-neutral-950 dark:text-neutral-100 line-clamp-1">{s.title}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{s.full_name} ({s.email})</p>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">{s.category_name}</td>
                  <td className="py-3 px-3 whitespace-nowrap font-semibold text-[#8C1D24] dark:text-[#eb7a80]">{s.status}</td>
                  <td className="py-3 px-3 whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                    {formatHistoricalArticleDate(s.created_at)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openReview(s)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
