import type { SubmissionStatus } from '../types/publication';

export function generateSlug(title: string): string {
  const cleaned = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return cleaned.slice(0, 90) || 'article';
}

export function calculateReadingTimeMinutes(htmlOrText: string): number {
  const plain = htmlOrText
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return 1;
  const words = plain.split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}

export function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitizes editorial rich-text HTML on both client and server:
 * - Strips <script>, <iframe>, <object>, <embed>, <style>, <form>, <svg>
 * - Removes inline event handlers (onclick=, onerror=, etc.)
 * - Neutralizes javascript: and data: URIs in href/src
 */
export function sanitizeEditorialHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  let cleaned = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<(object|embed|form|input|button|textarea|select|meta|link|base)\b[^>]*\/?>/gi, '')
    .replace(/<\/(object|embed|form|button|textarea|select)>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(?:"\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*')/gi, '$1="#"');

  return cleaned.trim();
}

export function generateSubmissionCode(date: Date = new Date(), randomSuffix?: string): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const suffix =
    randomSuffix ||
    Math.random().toString(36).substring(2, 6).toUpperCase() +
      Math.floor(10 + Math.random() * 89).toString();
  return `TC-SUB-${y}${m}${d}-${suffix}`;
}

export const SUBMISSION_STATUS_ORDER: SubmissionStatus[] = [
  'Submitted',
  'Under Review',
  'Revision Requested',
  'Approved',
  'Rejected',
  'Published',
];

export function canPublishSubmission(status: SubmissionStatus): boolean {
  return status === 'Approved' || status === 'Published';
}

export function canPublishEdition(pdfUrl: string | null | undefined, approvedByAdmin: boolean): boolean {
  return Boolean(pdfUrl && pdfUrl.trim().length > 0 && approvedByAdmin);
}

export function convertPlainTextToParagraphHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (/<(p|h2|h3|blockquote|ul|ol)\b/i.test(trimmed)) {
    return sanitizeEditorialHtml(trimmed);
  }
  return trimmed
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const ADMIN_EMAIL = 'thecontinental.dhpc@gmail.com';
export const NOTIFICATION_EMAIL = 'thecontinental.dhpc@gmail.com';
export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send'] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.trim().toLowerCase() === ADMIN_EMAIL);
}

export function isNotificationRecipientEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.trim().toLowerCase() === NOTIFICATION_EMAIL);
}

export function getNotificationRecipientEmail(override?: string | null): string {
  const candidate = (override || '').trim().toLowerCase();
  if (candidate && candidate.includes('@')) {
    return candidate;
  }
  return NOTIFICATION_EMAIL;
}

export function resolveRoleForEmail(
  email: string | null | undefined,
  emailVerified: boolean = true
): 'super_admin' | 'reader' {
  if (emailVerified && isAdminEmail(email)) {
    return 'super_admin';
  }
  return 'reader';
}

