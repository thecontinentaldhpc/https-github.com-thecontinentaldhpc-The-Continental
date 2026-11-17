import React, { useId, useState } from 'react';
import { Mail } from 'lucide-react';
import { api } from '../lib/api';
import { notifyViaWeb3FormsInBackground } from '../lib/web3forms';

export interface NewsletterSignupProps {
  variant?: 'sidebar' | 'banner';
  kicker?: string;
  title?: string;
  description?: string;
  className?: string;
}

export function NewsletterSignup({
  variant = 'sidebar',
  kicker = 'Daily Briefing & Monthly Digest',
  title,
  description,
  className = '',
}: NewsletterSignupProps) {
  const uid = useId();
  const headingId = `${uid}-heading`;
  const emailId = `${uid}-email`;
  const consentId = `${uid}-consent`;

  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState<'subscribe' | 'unsubscribe'>('subscribe');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSidebar = variant === 'sidebar';
  const resolvedTitle =
    title ?? (isSidebar ? 'Morning Dispatch' : 'Subscribe to THE CONTINENTAL Dispatch');
  const resolvedDescription =
    description ??
    (mode === 'subscribe'
      ? isSidebar
        ? 'Get our front-page briefing, lead editorials, and monthly magazine alerts in your inbox.'
        : 'Receive morning headlines, editorial commentary, and notifications when our monthly magazine and e-paper editions are released.'
      : 'Enter your subscribed email address below to unsubscribe from THE CONTINENTAL mailing list.');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setSubmitting(true);
    try {
      if (mode === 'subscribe') {
        const res = await api.subscribeNewsletter(email, consent);
        notifyViaWeb3FormsInBackground({
          eventType: 'New Subscription',
          userName: email.trim(),
          userEmail: email.trim(),
          subject: `[THE CONTINENTAL] New Subscription — ${email.trim().toLowerCase()}`,
          message: `${email.trim().toLowerCase()} subscribed to THE CONTINENTAL morning dispatch newsletter.`,
          metadata: {
            Consent: 'Confirmed',
            Placement: variant,
          },
        });
        setStatusMessage({ type: 'success', text: res.message });
        setEmail('');
        setConsent(false);
      } else {
        const res = await api.unsubscribeNewsletter(email);
        setStatusMessage({ type: 'success', text: res.message });
        setEmail('');
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to process request.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isSidebar) {
    return (
      <section
        aria-labelledby={headingId}
        data-testid="newsletter-signup-sidebar"
        className={`border border-neutral-300 dark:border-neutral-700 border-t-2 border-t-[#8C1D24] bg-[#FAF9F6] dark:bg-[#181818] p-5 ${className}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8C1D24] dark:text-[#eb7a80]">
              {kicker}
            </p>
            <h2 id={headingId} className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-50 mt-1 leading-snug">
              {resolvedTitle}
            </h2>
          </div>
          <Mail className="w-4 h-4 text-[#8C1D24] dark:text-[#eb7a80] shrink-0 mt-1" aria-hidden="true" />
        </div>

        <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-3 leading-relaxed">{resolvedDescription}</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor={emailId} className="sr-only">
              Email address
            </label>
            <input
              id={emailId}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reader@example.com"
              className="w-full bg-white dark:bg-[#121212] border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-300 focus:border-neutral-900 dark:focus:border-neutral-300"
            />
          </div>

          {mode === 'subscribe' && (
            <label htmlFor={consentId} className="flex items-start gap-2 text-[11px] text-neutral-700 dark:text-neutral-300 cursor-pointer leading-snug">
              <input
                id={consentId}
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
                className="mt-0.5 accent-[#8C1D24] shrink-0"
              />
              <span>
                I consent to receive free editorial dispatches and edition alerts from THE CONTINENTAL.
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors disabled:opacity-50"
          >
            {submitting
              ? 'Processing...'
              : mode === 'subscribe'
                ? 'Subscribe'
                : 'Unsubscribe'}
          </button>

          {statusMessage && (
            <p
              role="status"
              className={`text-xs font-medium leading-snug ${
                statusMessage.type === 'success'
                  ? 'text-emerald-800 dark:text-emerald-400'
                  : 'text-[#8C1D24] dark:text-[#eb7a80]'
              }`}
            >
              {statusMessage.text}
            </p>
          )}

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === 'subscribe' ? 'unsubscribe' : 'subscribe'));
                setStatusMessage(null);
              }}
              className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] underline underline-offset-4"
            >
              {mode === 'subscribe' ? 'Manage or Unsubscribe' : 'Return to Subscribe'}
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      data-testid="newsletter-signup-banner"
      className={`border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] p-6 sm:p-8 ${className}`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">
              {kicker}
            </p>
            <h2 id={headingId} className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">
              {resolvedTitle}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === 'subscribe' ? 'unsubscribe' : 'subscribe'));
                setStatusMessage(null);
              }}
              className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] underline underline-offset-4"
            >
              {mode === 'subscribe' ? 'Manage or Unsubscribe' : 'Return to Subscribe'}
            </button>
          </div>
        </div>

        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-3 leading-relaxed">{resolvedDescription}</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <label htmlFor={emailId} className="sr-only">
              Email address
            </label>
            <input
              id={emailId}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reader@example.com"
              className="flex-1 bg-white dark:bg-[#121212] border border-neutral-300 dark:border-neutral-700 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-300 focus:border-neutral-900 dark:focus:border-neutral-300"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-sm font-semibold hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {submitting ? 'Processing...' : mode === 'subscribe' ? 'Subscribe' : 'Unsubscribe'}
            </button>
          </div>

          {mode === 'subscribe' && (
            <label htmlFor={consentId} className="flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
              <input
                id={consentId}
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
                className="mt-0.5 accent-[#8C1D24]"
              />
              <span>
                I consent to receive free editorial dispatches from THE CONTINENTAL and have read the Privacy Policy.
              </span>
            </label>
          )}

          {statusMessage && (
            <p
              role="status"
              className={`text-sm font-medium ${
                statusMessage.type === 'success'
                  ? 'text-emerald-800 dark:text-emerald-400'
                  : 'text-[#8C1D24] dark:text-[#eb7a80]'
              }`}
            >
              {statusMessage.text}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
