"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIRESTORE_DATABASE_ID = exports.ADMIN_RECIPIENT_EMAIL = exports.NOTIFICATION_RECIPIENT_EMAIL = void 0;
exports.escapeHtml = escapeHtml;
exports.sanitizeDocId = sanitizeDocId;
exports.buildUserRegisteredEmail = buildUserRegisteredEmail;
exports.buildNewsletterSubscribedEmail = buildNewsletterSubscribedEmail;
exports.buildSubmissionReceivedEmail = buildSubmissionReceivedEmail;
exports.sendViaConfiguredTransport = sendViaConfiguredTransport;
exports.deliverAdminEmailNotification = deliverAdminEmailNotification;
const firestore_1 = require("firebase-admin/firestore");
const nodemailer_1 = __importDefault(require("nodemailer"));
exports.NOTIFICATION_RECIPIENT_EMAIL = 'artifex.alexx@gmail.com';
exports.ADMIN_RECIPIENT_EMAIL = exports.NOTIFICATION_RECIPIENT_EMAIL;
exports.FIRESTORE_DATABASE_ID = 'ai-studio-thecontinental-1c41c7bd-8d23-4acc-9373-c6c44a3391b1';
function escapeHtml(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function sanitizeDocId(raw) {
    const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    return cleaned || 'notification';
}
function buildUserRegisteredEmail(params) {
    const cleanEmail = (params.email || '').trim().toLowerCase().slice(0, 180);
    const cleanPhone = (params.phoneNumber || '').trim().slice(0, 40);
    const actorContact = cleanEmail || cleanPhone || 'unknown@user';
    const fallbackName = cleanEmail ? cleanEmail.split('@')[0] : cleanPhone || 'New Reader';
    const actorName = (params.displayName || fallbackName).trim().slice(0, 120);
    const providers = params.providerIds && params.providerIds.length > 0 ? params.providerIds.join(', ') : 'firebase';
    const createdAt = params.createdAt || new Date().toISOString();
    const subject = `New User Registration: ${actorName} (${actorContact})`;
    const summaryMessage = `${actorName} (${actorContact}) registered a new account on THE CONTINENTAL via ${providers}.`;
    const text = [
        'THE CONTINENTAL — New User Registration Alert',
        '--------------------------------------------------',
        `Name: ${actorName}`,
        ...(cleanEmail ? [`Email: ${cleanEmail}`] : []),
        ...(cleanPhone ? [`Phone: ${cleanPhone}`] : []),
        `User UID: ${params.uid}`,
        `Auth Provider: ${providers}`,
        `Registered At (UTC): ${createdAt}`,
        '',
        'This automated notification was triggered by Firebase Cloud Functions.',
    ].join('\n');
    const html = `
    <div style="font-family: Georgia, serif; color: #111111; max-width: 600px; margin: 0 auto; border: 1px solid #d4d4d4; padding: 24px; background: #faf9f6;">
      <p style="font-family: sans-serif; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #8c1d24; font-weight: 700; margin: 0 0 8px;">
        THE CONTINENTAL · Account Alert
      </p>
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111111;">New User Registered</h2>
      <p style="font-family: sans-serif; font-size: 14px; line-height: 1.5; color: #262626;">
        A new reader/contributor account has been registered on <strong>THE CONTINENTAL</strong>.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 13px; margin: 16px 0; background: #ffffff; border: 1px solid #e5e5e5;">
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Full Name</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(actorName)}</td></tr>
        ${cleanEmail ? `<tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Email</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(cleanEmail)}</td></tr>` : ''}
        ${cleanPhone ? `<tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Phone Number</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(cleanPhone)}</td></tr>` : ''}
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">UID</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; font-family: monospace;">${escapeHtml(params.uid)}</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Provider</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(providers)}</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600;">Registered At</td><td style="padding: 8px 12px;">${escapeHtml(createdAt)}</td></tr>
      </table>
      <p style="font-family: sans-serif; font-size: 11px; color: #737373; margin: 16px 0 0;">
        Sent to ${exports.NOTIFICATION_RECIPIENT_EMAIL} by Firebase Cloud Functions.
      </p>
    </div>
  `.trim();
    return {
        to: exports.NOTIFICATION_RECIPIENT_EMAIL,
        subject: subject.slice(0, 220),
        text,
        html,
        actorEmail: actorContact,
        actorName,
        summaryMessage: summaryMessage.slice(0, 1000),
    };
}
function buildNewsletterSubscribedEmail(params) {
    const actorEmail = (params.email || 'unknown@subscriber').trim().toLowerCase().slice(0, 180);
    const source = (params.source || 'web_signup').trim().slice(0, 64);
    const subscribedAt = params.subscribedAt || new Date().toISOString();
    const subject = `New Newsletter Subscriber: ${actorEmail}`;
    const summaryMessage = `${actorEmail} subscribed to THE CONTINENTAL newsletter dispatch (source: ${source}).`;
    const text = [
        'THE CONTINENTAL — Newsletter Subscription Alert',
        '--------------------------------------------------',
        `Subscriber Email: ${actorEmail}`,
        `Subscriber ID: ${params.subscriberId}`,
        `Source: ${source}`,
        `Subscribed At (UTC): ${subscribedAt}`,
        '',
        'This automated notification was triggered by Firebase Cloud Functions.',
    ].join('\n');
    const html = `
    <div style="font-family: Georgia, serif; color: #111111; max-width: 600px; margin: 0 auto; border: 1px solid #d4d4d4; padding: 24px; background: #faf9f6;">
      <p style="font-family: sans-serif; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #8c1d24; font-weight: 700; margin: 0 0 8px;">
        THE CONTINENTAL · Newsletter Alert
      </p>
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111111;">New Newsletter Subscriber</h2>
      <p style="font-family: sans-serif; font-size: 14px; line-height: 1.5; color: #262626;">
        A reader has subscribed to <strong>THE CONTINENTAL</strong> Morning Dispatch newsletter.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 13px; margin: 16px 0; background: #ffffff; border: 1px solid #e5e5e5;">
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Subscriber Email</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(actorEmail)}</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Subscriber ID</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; font-family: monospace;">${escapeHtml(params.subscriberId)}</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Source</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(source)}</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600;">Subscribed At</td><td style="padding: 8px 12px;">${escapeHtml(subscribedAt)}</td></tr>
      </table>
      <p style="font-family: sans-serif; font-size: 11px; color: #737373; margin: 16px 0 0;">
        Sent to ${exports.NOTIFICATION_RECIPIENT_EMAIL} by Firebase Cloud Functions.
      </p>
    </div>
  `.trim();
    return {
        to: exports.NOTIFICATION_RECIPIENT_EMAIL,
        subject: subject.slice(0, 220),
        text,
        html,
        actorEmail,
        actorName: actorEmail,
        summaryMessage: summaryMessage.slice(0, 1000),
    };
}
function buildSubmissionReceivedEmail(params) {
    const code = (params.submissionCode || params.submissionId).trim().slice(0, 64);
    const title = (params.title || 'Untitled Manuscript').trim().slice(0, 220);
    const actorEmail = (params.authorEmail || 'unknown@author').trim().toLowerCase().slice(0, 180);
    const actorName = (params.authorName || actorEmail.split('@')[0] || 'Contributor').trim().slice(0, 120);
    const categoryId = (params.categoryId || 'general').trim().slice(0, 64);
    const createdAt = params.createdAt || new Date().toISOString();
    const subject = `New Article Submission (${code}): ${title}`;
    const summaryMessage = `${actorName} (${actorEmail}) submitted manuscript "${title}" (ID: ${code}, Category: ${categoryId}) for editorial review.`;
    const text = [
        'THE CONTINENTAL — New Article Submission Alert',
        '--------------------------------------------------',
        `Submission ID: ${code}`,
        `Title: ${title}`,
        `Author: ${actorName}`,
        `Author Email: ${actorEmail}`,
        `Category ID: ${categoryId}`,
        `Submitted At (UTC): ${createdAt}`,
        '',
        'Review this manuscript inside THE CONTINENTAL Admin Console.',
    ].join('\n');
    const html = `
    <div style="font-family: Georgia, serif; color: #111111; max-width: 600px; margin: 0 auto; border: 1px solid #d4d4d4; padding: 24px; background: #faf9f6;">
      <p style="font-family: sans-serif; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #8c1d24; font-weight: 700; margin: 0 0 8px;">
        THE CONTINENTAL · Publish Your Writing
      </p>
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111111;">New Article Manuscript Submitted</h2>
      <p style="font-family: sans-serif; font-size: 14px; line-height: 1.5; color: #262626;">
        A contributor has submitted a manuscript for editorial review on <strong>THE CONTINENTAL</strong>.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 13px; margin: 16px 0; background: #ffffff; border: 1px solid #e5e5e5;">
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Submission ID</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; font-family: monospace; color: #8c1d24; font-weight: 700;">${escapeHtml(code)}</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Article Title</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">${escapeHtml(title)}</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Contributor</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(actorName)}</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Email</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(actorEmail)}</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">Category</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(categoryId)}</td></tr>
        <tr><td style="padding: 8px 12px; font-weight: 600;">Submitted At</td><td style="padding: 8px 12px;">${escapeHtml(createdAt)}</td></tr>
      </table>
      <p style="font-family: sans-serif; font-size: 11px; color: #737373; margin: 16px 0 0;">
        Sent to ${exports.NOTIFICATION_RECIPIENT_EMAIL} by Firebase Cloud Functions.
      </p>
    </div>
  `.trim();
    return {
        to: exports.NOTIFICATION_RECIPIENT_EMAIL,
        subject: subject.slice(0, 220),
        text,
        html,
        actorEmail,
        actorName,
        summaryMessage: summaryMessage.slice(0, 1000),
    };
}
async function sendViaConfiguredTransport(payload) {
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (resendApiKey) {
        try {
            const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'THE CONTINENTAL <onboarding@resend.dev>';
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: fromAddress,
                    to: [payload.to],
                    subject: payload.subject,
                    text: payload.text,
                    html: payload.html,
                }),
            });
            if (response.ok) {
                return { sent: true, provider: 'resend', status: 'emailed_via_resend' };
            }
            const errBody = await response.text().catch(() => '');
            return {
                sent: false,
                provider: 'resend',
                status: 'delivery_failed',
                error: `Resend HTTP ${response.status}: ${errBody.slice(0, 200)}`,
            };
        }
        catch (err) {
            return {
                sent: false,
                provider: 'resend',
                status: 'delivery_failed',
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
    const gmailPassword = process.env.GMAIL_APP_PASSWORD?.trim();
    const gmailUser = process.env.GMAIL_USER?.trim() || exports.NOTIFICATION_RECIPIENT_EMAIL;
    const smtpHost = process.env.SMTP_HOST?.trim() || (gmailPassword ? 'smtp.gmail.com' : '');
    const smtpPort = Number(process.env.SMTP_PORT || '465');
    const smtpUser = process.env.SMTP_USER?.trim() || (gmailPassword ? gmailUser : '');
    const smtpPass = process.env.SMTP_PASS?.trim() || gmailPassword || '';
    if (smtpHost && smtpUser && smtpPass) {
        try {
            const transporter = nodemailer_1.default.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: {
                    user: smtpUser,
                    pass: smtpPass,
                },
            });
            await transporter.sendMail({
                from: process.env.SMTP_FROM?.trim() || `THE CONTINENTAL <${smtpUser}>`,
                to: payload.to,
                subject: payload.subject,
                text: payload.text,
                html: payload.html,
            });
            return { sent: true, provider: 'smtp', status: 'emailed_via_smtp' };
        }
        catch (err) {
            return {
                sent: false,
                provider: 'smtp',
                status: 'delivery_failed',
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
    return {
        sent: false,
        provider: 'none',
        status: 'recorded_missing_mail_credentials',
    };
}
async function deliverAdminEmailNotification(params) {
    const safeId = sanitizeDocId(params.notificationId);
    const safeActorUid = sanitizeDocId(params.actorUid);
    const docRef = params.db.collection('admin_notifications').doc(safeId);
    // Atomically claim the idempotency slot before dispatching email so Cloud Function retries never double-send.
    const claimed = await params.db.runTransaction(async (tx) => {
        const existing = await tx.get(docRef);
        if (existing.exists) {
            return false;
        }
        tx.set(docRef, {
            id: safeId,
            eventType: params.eventType,
            recipientEmail: exports.NOTIFICATION_RECIPIENT_EMAIL,
            actorUid: safeActorUid,
            actorEmail: params.actorEmail.slice(0, 180),
            actorName: params.actorName.slice(0, 120),
            subject: params.subject.slice(0, 220),
            message: params.summaryMessage.slice(0, 1000),
            isRead: false,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return true;
    });
    if (!claimed) {
        return {
            skippedDuplicate: true,
            delivery: { sent: false, provider: 'none', status: 'duplicate_skipped' },
        };
    }
    const sender = params.sender || sendViaConfiguredTransport;
    const delivery = await sender(params.emailPayload);
    return { skippedDuplicate: false, delivery };
}
//# sourceMappingURL=emailNotifier.js.map