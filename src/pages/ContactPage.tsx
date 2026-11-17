import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { notifyViaWeb3FormsInBackground } from '../lib/web3forms';

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    document.title = 'Contact Us | THE CONTINENTAL';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);
    try {
      const res = await api.sendContact({ name, email, subject, message });
      notifyViaWeb3FormsInBackground({
        eventType: 'New Message',
        userName: name,
        userEmail: email,
        subject: `[THE CONTINENTAL] New Message: ${subject}`,
        message,
        metadata: {
          'Message ID': res.id,
          'Contact Subject': subject,
        },
      });
      setStatus({ type: 'success', text: res.message });
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setStatus({ type: 'error', text: err instanceof Error ? err.message : 'Unable to send message.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="border-b-2 border-neutral-950 dark:border-neutral-200 pb-4 mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">Editorial & Reader Desk</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">Contact Us</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
          Reach our editorial desk regarding news corrections, reader feedback, syndication, or publication enquiries.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="contact-name" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1.5">
              Full Name *
            </label>
            <input
              id="contact-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white dark:bg-[#1a1a1a] border border-neutral-300 dark:border-neutral-700 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-300"
            />
          </div>
          <div>
            <label htmlFor="contact-email" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1.5">
              Email Address *
            </label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white dark:bg-[#1a1a1a] border border-neutral-300 dark:border-neutral-700 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-300"
            />
          </div>
        </div>

        <div>
          <label htmlFor="contact-subject" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1.5">
            Subject *
          </label>
          <input
            id="contact-subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Correction Request, Editorial Enquiry, General Feedback"
            className="w-full bg-white dark:bg-[#1a1a1a] border border-neutral-300 dark:border-neutral-700 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-300"
          />
        </div>

        <div>
          <label htmlFor="contact-message" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1.5">
            Message *
          </label>
          <textarea
            id="contact-message"
            required
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-white dark:bg-[#1a1a1a] border border-neutral-300 dark:border-neutral-700 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-300"
          />
        </div>

        {status && (
          <p
            role="status"
            className={`text-sm font-medium ${
              status.type === 'success'
                ? 'text-emerald-800 dark:text-emerald-400'
                : 'text-[#8C1D24] dark:text-[#eb7a80]'
            }`}
          >
            {status.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="px-7 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </main>
  );
}
