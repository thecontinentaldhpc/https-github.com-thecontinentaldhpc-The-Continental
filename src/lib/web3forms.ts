import { NOTIFICATION_EMAIL } from './editorialRules';
import { formatHistoricalArticleDate } from './dateIst';

export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
export const WEB3FORMS_RECIPIENT_EMAIL = NOTIFICATION_EMAIL;

export type Web3FormsEventType =
  | 'New Login'
  | 'New Registration'
  | 'New Subscription'
  | 'New Submission'
  | 'New Message';

export interface Web3FormsNotificationInput {
  eventType: Web3FormsEventType;
  userName?: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
  subject?: string;
  message?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  timestamp?: string;
}

export interface Web3FormsPayload {
  access_key: string;
  subject: string;
  from_name: string;
  name: string;
  email: string;
  replyto?: string;
  to: string;
  event_type: Web3FormsEventType;
  timestamp: string;
  message: string;
}

export interface Web3FormsResult {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  message?: string;
  error?: string;
}

export interface Web3FormsSendOptions {
  accessKey?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export function getWeb3FormsAccessKey(): string {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    if (metaEnv && typeof metaEnv.NEXT_PUBLIC_WEB3FORMS_KEY === 'string' && metaEnv.NEXT_PUBLIC_WEB3FORMS_KEY.trim()) {
      return metaEnv.NEXT_PUBLIC_WEB3FORMS_KEY.trim();
    }
  } catch {
    // Ignore import.meta access errors in restricted runtimes
  }

  try {
    if (typeof process !== 'undefined' && process.env && typeof process.env.NEXT_PUBLIC_WEB3FORMS_KEY === 'string') {
      return process.env.NEXT_PUBLIC_WEB3FORMS_KEY.trim();
    }
  } catch {
    // Ignore process.env access errors in browser runtimes
  }

  return '';
}

function isValidEmailFormat(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function formatNotificationTimestamp(isoTimestamp?: string): {
  iso: string;
  ist: string;
} {
  const date = isoTimestamp ? new Date(isoTimestamp) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const iso = safeDate.toISOString();
  return {
    iso,
    ist: formatHistoricalArticleDate(iso) || iso,
  };
}

export function buildWeb3FormsPayload(
  input: Web3FormsNotificationInput,
  accessKey: string
): Web3FormsPayload {
  const cleanEmail = input.userEmail?.trim() || '';
  const cleanPhone = input.userPhone?.trim() || '';
  const cleanName = input.userName?.trim() || cleanEmail || cleanPhone || 'THE CONTINENTAL Reader';
  const validReplyEmail = isValidEmailFormat(cleanEmail) ? cleanEmail.toLowerCase() : undefined;
  const senderEmail = validReplyEmail || 'noreply@thecontinental.dhpc.in';
  const { iso, ist } = formatNotificationTimestamp(input.timestamp);

  const actorSummary = validReplyEmail
    ? cleanName !== validReplyEmail
      ? `${cleanName} (${validReplyEmail})`
      : validReplyEmail
    : cleanPhone
      ? `${cleanName} (${cleanPhone})`
      : cleanName;

  const subject =
    input.subject?.trim() || `[THE CONTINENTAL] ${input.eventType} — ${actorSummary}`;

  const metadataLines: string[] = [];
  if (input.metadata) {
    for (const [key, val] of Object.entries(input.metadata)) {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        metadataLines.push(`${key}: ${String(val).trim()}`);
      }
    }
  }

  const bodyLines = [
    `THE CONTINENTAL — Automated Activity Notification`,
    `==================================================`,
    `Event Type: ${input.eventType}`,
    `Recipient Inbox: ${WEB3FORMS_RECIPIENT_EMAIL}`,
    `User Name: ${cleanName}`,
    `User Email: ${validReplyEmail || 'Not provided'}`,
    ...(cleanPhone ? [`User Phone: ${cleanPhone}`] : []),
    ...metadataLines,
    `Timestamp (IST): ${ist}`,
    `Timestamp (UTC): ${iso}`,
    ``,
    `Details / Message Content:`,
    `--------------------------------------------------`,
    input.message?.trim() || `${input.eventType} recorded for ${actorSummary}.`,
  ];

  return {
    access_key: accessKey.trim(),
    subject,
    from_name: 'THE CONTINENTAL',
    name: cleanName,
    email: senderEmail,
    ...(validReplyEmail ? { replyto: validReplyEmail } : {}),
    to: WEB3FORMS_RECIPIENT_EMAIL,
    event_type: input.eventType,
    timestamp: iso,
    message: bodyLines.join('\n'),
  };
}

export async function sendWeb3FormsNotification(
  input: Web3FormsNotificationInput,
  options: Web3FormsSendOptions = {}
): Promise<Web3FormsResult> {
  const accessKey = (options.accessKey ?? getWeb3FormsAccessKey()).trim();
  if (!accessKey) {
    return {
      ok: false,
      skipped: true,
      error: 'NEXT_PUBLIC_WEB3FORMS_KEY is not configured.',
    };
  }

  const fetchFn = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchFn) {
    return {
      ok: false,
      skipped: true,
      error: 'Fetch API is unavailable in this environment.',
    };
  }

  const endpoint = options.endpoint || WEB3FORMS_ENDPOINT;
  const payload = buildWeb3FormsPayload(input, accessKey);

  try {
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
    };

    if (!response.ok || data.success === false) {
      const errorMsg = data.message || `Web3Forms responded with status ${response.status}`;
      console.warn('[Web3Forms] Notification delivery failed:', errorMsg);
      return {
        ok: false,
        status: response.status,
        error: errorMsg,
      };
    }

    return {
      ok: true,
      status: response.status,
      message: data.message || 'Notification sent via Web3Forms.',
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unexpected Web3Forms network error.';
    console.warn('[Web3Forms] Silent background delivery error:', errorMsg);
    return {
      ok: false,
      error: errorMsg,
    };
  }
}

/**
 * Triggers a Web3Forms notification silently in the background without blocking
 * or throwing into the caller's UX flow.
 */
export function notifyViaWeb3FormsInBackground(
  input: Web3FormsNotificationInput,
  options?: Web3FormsSendOptions
): void {
  try {
    void sendWeb3FormsNotification(input, options).catch((err) => {
      console.warn('[Web3Forms] Unhandled background notification error:', err);
    });
  } catch (err) {
    console.warn('[Web3Forms] Background dispatch setup error:', err);
  }
}
