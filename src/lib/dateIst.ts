/**
 * Automatic Date, Day & Calendar Utility for THE CONTINENTAL
 * Official Publication Timezone: Asia/Kolkata (IST, UTC+05:30)
 *
 * Avoids UTC date-shift errors and guarantees historical article/edition dates
 * remain immutable while the masthead calendar advances automatically at 00:00 IST.
 */

export const PUBLICATION_TIMEZONE = 'Asia/Kolkata';

export interface IstDateParts {
  weekday: string;      // e.g., "MONDAY"
  weekdayTitle: string; // e.g., "Monday"
  day: number;          // 1..31
  month: number;        // 1..12
  monthName: string;    // e.g., "JANUARY"
  monthTitle: string;   // e.g., "January"
  year: number;         // e.g., 2027
  isoDate: string;      // YYYY-MM-DD in IST
  formattedMasthead: string; // e.g., "MONDAY | 4 JANUARY 2027"
  formattedDateOnly: string; // e.g., "4 JANUARY 2027"
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function getMonthName(monthNumber: number): string {
  return MONTH_NAMES[Math.max(0, Math.min(11, monthNumber - 1))] || 'January';
}

export function getIstDateParts(date: Date = new Date()): IstDateParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: PUBLICATION_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const numericFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PUBLICATION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const numParts = numericFormatter.formatToParts(date);

  const weekdayTitle = parts.find((p) => p.type === 'weekday')?.value ?? 'Monday';
  const dayStr = parts.find((p) => p.type === 'day')?.value ?? '1';
  const monthTitle = parts.find((p) => p.type === 'month')?.value ?? 'January';
  const yearStr = parts.find((p) => p.type === 'year')?.value ?? '2027';

  const isoYear = numParts.find((p) => p.type === 'year')?.value ?? yearStr;
  const isoMonth = numParts.find((p) => p.type === 'month')?.value ?? '01';
  const isoDay = numParts.find((p) => p.type === 'day')?.value ?? '01';

  const day = Number.parseInt(dayStr, 10);
  const month = Number.parseInt(isoMonth, 10);
  const year = Number.parseInt(yearStr, 10);
  const weekday = weekdayTitle.toUpperCase();
  const monthName = monthTitle.toUpperCase();

  return {
    weekday,
    weekdayTitle,
    day,
    month,
    monthName,
    monthTitle,
    year,
    isoDate: `${isoYear}-${isoMonth}-${isoDay}`,
    formattedMasthead: `${weekday} | ${day} ${monthName} ${year}`,
    formattedDateOnly: `${day} ${monthName} ${year}`,
  };
}

export function formatIstTime(date: Date = new Date()): string {
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: PUBLICATION_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
      .format(date)
      .toUpperCase() + ' IST'
  );
}

/**
 * Formats exact IST date/time and time-only strings when news is published or updated.
 * Never outputs relative "...m ago" or "Just now" labels.
 */
export function formatNewsUpdatedLabel(
  isoString: string | null | undefined,
  _now: Date = new Date()
): { formatted: string; timeOnly: string; relative: string; combined: string } {
  if (!isoString) {
    return { formatted: '', timeOnly: '', relative: '', combined: '' };
  }
  const target = new Date(isoString);
  if (Number.isNaN(target.getTime())) {
    return { formatted: '', timeOnly: '', relative: '', combined: '' };
  }

  const formatted = formatHistoricalArticleDate(isoString);
  const timeOnly = formatIstTime(target);

  return {
    formatted,
    timeOnly,
    relative: '',
    combined: formatted,
  };
}

/**
 * Resolves whether an article has been updated after publication (>= 60s delta)
 * and returns the display timestamp + prefix ("Updated" vs "Published").
 */
export function resolveArticleTimestamp(article: {
  updated_at?: string | null;
  published_at?: string | null;
  created_at?: string | null;
}): { iso: string; isUpdated: boolean; label: 'Updated' | 'Published' } {
  const pubIso = article.published_at || article.created_at || '';
  const updIso = article.updated_at || '';
  if (updIso && pubIso) {
    const pubMs = Date.parse(pubIso);
    const updMs = Date.parse(updIso);
    if (!Number.isNaN(pubMs) && !Number.isNaN(updMs) && updMs - pubMs >= 60_000) {
      return { iso: updIso, isUpdated: true, label: 'Updated' };
    }
  }
  return { iso: pubIso || updIso, isUpdated: false, label: 'Published' };
}

/**
 * Formats a historical publication timestamp strictly in Asia/Kolkata.
 * Never mutates when the current calendar advances.
 */
export function formatHistoricalArticleDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: PUBLICATION_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: PUBLICATION_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${formatted} · ${time.toUpperCase()} IST`;
}

/**
 * Formats an immutable edition YYYY-MM-DD date string without timezone drift.
 */
export function formatImmutableEditionDate(yyyyMmDd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!match) return yyyyMmDd;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  // Noon UTC ensures no calendar shift when rendered in IST
  const safeUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PUBLICATION_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(safeUtc);
}

/**
 * Returns milliseconds remaining until the next 00:00:01 Asia/Kolkata midnight.
 */
export function msUntilNextIstMidnight(now: Date = new Date()): number {
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PUBLICATION_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hour = Number.parseInt(timeParts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24;
  const minute = Number.parseInt(timeParts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const second = Number.parseInt(timeParts.find((p) => p.type === 'second')?.value ?? '0', 10);

  const secondsElapsedToday = hour * 3600 + minute * 60 + second;
  const secondsInDay = 86400;
  const secondsRemaining = Math.max(1, secondsInDay - secondsElapsedToday);
  return secondsRemaining * 1000 + 1000;
}

/**
 * Converts an Asia/Kolkata local date & time ("YYYY-MM-DD", "HH:MM") into a UTC ISO string.
 */
export function istDateTimeToUtcIso(dateStr: string, timeStr: string = '00:00'): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) {
    throw new Error('Invalid IST date or time format. Expected YYYY-MM-DD and HH:MM.');
  }
  const year = Number.parseInt(dateMatch[1], 10);
  const month = Number.parseInt(dateMatch[2], 10);
  const day = Number.parseInt(dateMatch[3], 10);
  const hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2], 10);

  // IST is strictly UTC + 05:30 (330 minutes)
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0) - 330 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/**
 * Determines whether a scheduled article is eligible for automatic publication.
 * Requires BOTH editorial approval AND current time >= scheduled_at.
 */
export function isScheduledPublishDue(
  scheduledAtIso: string | null | undefined,
  approvalStatus: string,
  now: Date = new Date()
): boolean {
  if (!scheduledAtIso || approvalStatus !== 'approved') return false;
  const target = new Date(scheduledAtIso);
  if (Number.isNaN(target.getTime())) return false;
  return now.getTime() >= target.getTime();
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
