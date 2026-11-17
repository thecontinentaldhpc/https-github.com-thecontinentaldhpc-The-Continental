import { escapeHtml, NOTIFICATION_EMAIL } from './editorialRules';

export interface NotificationEmailTemplateInput {
  eventType: string;
  subject: string;
  message: string;
  actorName: string;
  actorEmail: string;
  createdAt: string;
  recipientEmail?: string;
}

export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function encodeUtf8Base64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function encodeMimeSubject(subject: string): string {
  const clean = sanitizeHeaderValue(subject);
  const bytes = new TextEncoder().encode(clean);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

export function formatEventLabel(eventType: string): string {
  switch (eventType) {
    case 'user_registered':
      return 'New User Registration';
    case 'newsletter_subscribe':
      return 'Newsletter Subscription';
    case 'submission_received':
      return 'New Article Submission';
    case 'contact_message':
      return 'Reader Contact Message';
    case 'user_login':
      return 'User Sign-In Alert';
    default:
      return 'THE CONTINENTAL Alert';
  }
}

export function buildNotificationEmailContent(input: NotificationEmailTemplateInput): {
  subject: string;
  text: string;
  html: string;
} {
  const recipient = (input.recipientEmail || NOTIFICATION_EMAIL).trim().toLowerCase();
  const label = formatEventLabel(input.eventType);
  const subject = sanitizeHeaderValue(input.subject);

  const text = [
    `THE CONTINENTAL — ${label}`,
    '--------------------------------------------------',
    input.message,
    '',
    `Event: ${input.eventType}`,
    `Actor: ${input.actorName} (${input.actorEmail})`,
    `Recipient Inbox: ${recipient}`,
    `Time (UTC): ${input.createdAt}`,
  ].join('\n');

  const html = `
    <div style="font-family: Georgia, serif; color: #111111; max-width: 600px; margin: 0 auto; border: 1px solid #d4d4d4; padding: 24px; background: #faf9f6;">
      <p style="font-family: sans-serif; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #8c1d24; font-weight: 700; margin: 0 0 8px;">
        THE CONTINENTAL · ${escapeHtml(label)}
      </p>
      <h2 style="margin: 0 0 14px; font-size: 20px; color: #111111;">${escapeHtml(subject)}</h2>
      <div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #262626; background: #ffffff; border: 1px solid #e5e5e5; padding: 14px 16px; white-space: pre-line;">${escapeHtml(input.message)}</div>
      <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 12px; margin: 16px 0; background: #ffffff; border: 1px solid #e5e5e5;">
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Actor</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(input.actorName)} (${escapeHtml(input.actorEmail)})</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Event</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(input.eventType)}</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600;">Time (UTC)</td><td style="padding: 8px 12px;">${escapeHtml(input.createdAt)}</td></tr>
      </table>
      <p style="font-family: sans-serif; font-size: 11px; color: #737373; margin: 16px 0 0;">
        Delivered directly to ${escapeHtml(recipient)} by THE CONTINENTAL.
      </p>
    </div>
  `.trim();

  return { subject, text, html };
}

export function buildRawMimeEmail(params: {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html: string;
}): string {
  const to = sanitizeHeaderValue(params.to);
  const from = params.from ? sanitizeHeaderValue(params.from) : '';
  const boundary = 'tc_alt_boundary_2027';

  const headers = [
    ...(from ? [`From: ${from}`] : []),
    `To: ${to}`,
    `Subject: ${encodeMimeSubject(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.html,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return encodeUtf8Base64Url(`${headers.join('\r\n')}\r\n\r\n${body}`);
}
