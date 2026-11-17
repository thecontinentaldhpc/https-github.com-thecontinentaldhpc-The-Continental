import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { db } from './db';
import { logAudit } from './auth';
import { getNotificationRecipientEmail, NOTIFICATION_EMAIL } from '../lib/editorialRules';
import { buildNotificationEmailContent, buildRawMimeEmail } from '../lib/gmailPayload';
import {
  notifyViaWeb3FormsInBackground,
  type Web3FormsEventType,
} from '../lib/web3forms';

export type NotificationEventType =
  | 'user_login'
  | 'user_registered'
  | 'newsletter_subscribe'
  | 'submission_received'
  | 'contact_message';

export interface NotificationDispatchInput {
  eventType: NotificationEventType;
  actorEmail: string;
  actorName?: string;
  subject: string;
  message: string;
  ipAddress?: string;
  skipWeb3Forms?: boolean;
}

function mapEventTypeToWeb3FormsLabel(eventType: NotificationEventType): Web3FormsEventType {
  switch (eventType) {
    case 'user_registered':
      return 'New Registration';
    case 'newsletter_subscribe':
      return 'New Subscription';
    case 'submission_received':
      return 'New Submission';
    case 'contact_message':
      return 'New Message';
    default:
      return 'New Login';
  }
}

export function resolveNotificationRecipient(envOverride?: string): string {
  return getNotificationRecipientEmail(envOverride ?? process.env.NOTIFICATION_RECIPIENT_EMAIL);
}

function getAuditAction(eventType: NotificationEventType): string {
  switch (eventType) {
    case 'user_registered':
      return 'NOTIFY_INBOX_REGISTRATION';
    case 'newsletter_subscribe':
      return 'NOTIFY_INBOX_SUBSCRIPTION';
    case 'submission_received':
      return 'NOTIFY_INBOX_SUBMISSION';
    case 'contact_message':
      return 'NOTIFY_INBOX_CONTACT';
    default:
      return 'NOTIFY_INBOX_LOGIN';
  }
}

export async function dispatchAdminNotification(input: NotificationDispatchInput): Promise<{
  id: string;
  recipientEmail: string;
  deliveryStatus: string;
}> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const recipientEmail = resolveNotificationRecipient();
  const rawActor = input.actorEmail.trim();
  const actorEmail = rawActor.includes('@') ? rawActor.toLowerCase() : rawActor;
  const actorName = (input.actorName || actorEmail).trim();

  const content = buildNotificationEmailContent({
    eventType: input.eventType,
    subject: input.subject,
    message: input.message,
    actorName,
    actorEmail,
    createdAt: now,
    recipientEmail,
  });

  let deliveryStatus = 'queued_for_inbox_delivery';

  // Option 0: Fire-and-forget Web3Forms delivery if NEXT_PUBLIC_WEB3FORMS_KEY is configured and client did not already dispatch
  if (!input.skipWeb3Forms && process.env.NEXT_PUBLIC_WEB3FORMS_KEY?.trim()) {
    notifyViaWeb3FormsInBackground({
      eventType: mapEventTypeToWeb3FormsLabel(input.eventType),
      userName: actorName,
      userEmail: actorEmail.includes('@') ? actorEmail : undefined,
      userPhone: actorEmail.includes('@') ? undefined : actorEmail,
      subject: content.subject,
      message: input.message,
      timestamp: now,
    });
  }

  // Option 1: Live email delivery via Resend API if RESEND_API_KEY is configured
  if (process.env.RESEND_API_KEY) {
    try {
      const fromAddress = process.env.RESEND_FROM_EMAIL || 'THE CONTINENTAL <onboarding@resend.dev>';
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipientEmail],
          subject: content.subject,
          text: content.text,
          html: content.html,
        }),
      });
      if (resp.ok) {
        deliveryStatus = 'emailed_to_inbox';
      }
    } catch (err) {
      console.error('Resend notification delivery error:', err);
    }
  }

  // Option 2: Live email delivery via Gmail SMTP / generic SMTP via Nodemailer
  if (deliveryStatus !== 'emailed_to_inbox') {
    const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();
    const gmailUser = process.env.GMAIL_USER?.trim() || recipientEmail;
    const smtpHost = process.env.SMTP_HOST?.trim() || (gmailPass ? 'smtp.gmail.com' : '');
    const smtpPort = Number(process.env.SMTP_PORT || '465');
    const smtpUser = process.env.SMTP_USER?.trim() || (gmailPass ? gmailUser : '');
    const smtpPass = process.env.SMTP_PASS?.trim() || gmailPass || '';

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM?.trim() || `THE CONTINENTAL <${smtpUser}>`,
          to: recipientEmail,
          subject: content.subject,
          text: content.text,
          html: content.html,
        });
        deliveryStatus = 'emailed_to_inbox';
      } catch (err) {
        console.error('SMTP notification delivery error:', err);
      }
    }
  }

  db.prepare(
    `INSERT INTO admin_notifications (
      id, event_type, recipient_email, actor_email, actor_name, subject, message, delivery_status, is_read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    id,
    input.eventType,
    recipientEmail,
    actorEmail,
    actorName,
    content.subject,
    input.message,
    deliveryStatus,
    now
  );

  logAudit(
    actorEmail,
    getAuditAction(input.eventType),
    'notification',
    id,
    `Notification queued for ${recipientEmail}: ${content.subject} (${deliveryStatus})`,
    input.ipAddress || ''
  );

  return { id, recipientEmail, deliveryStatus };
}

export async function verifyGmailBearerToken(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ valid: boolean; emailAddress?: string; error?: string }> {
  const cleanToken = accessToken.trim();
  if (!cleanToken) {
    return { valid: false, error: 'Missing Gmail OAuth Bearer token.' };
  }

  try {
    const profileRes = await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${cleanToken}` },
    });
    if (!profileRes.ok) {
      const errText = await profileRes.text().catch(() => '');
      return {
        valid: false,
        error: `Gmail authorization expired or missing gmail.send permission (${profileRes.status}): ${errText.slice(0, 160)}`,
      };
    }
    const profileData = (await profileRes.json()) as { emailAddress?: string };
    return {
      valid: true,
      emailAddress: (profileData.emailAddress || NOTIFICATION_EMAIL).toLowerCase(),
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unable to validate Gmail access token.',
    };
  }
}

export async function sendNotificationViaGmailApi(params: {
  accessToken: string;
  senderEmail?: string;
  to?: string;
  subject: string;
  text: string;
  html: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const fetchFn = params.fetchImpl || fetch;
  const recipient = (params.to || NOTIFICATION_EMAIL).trim().toLowerCase();
  const fromHeader = params.senderEmail ? `THE CONTINENTAL <${params.senderEmail}>` : undefined;
  const raw = buildRawMimeEmail({
    to: recipient,
    from: fromHeader,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });

  try {
    const resp = await fetchFn('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return {
        ok: false,
        error: `Gmail API send failed (${resp.status}): ${errText.slice(0, 200)}`,
      };
    }
    const data = (await resp.json().catch(() => ({}))) as { id?: string };
    return { ok: true, messageId: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error calling Gmail API.',
    };
  }
}
