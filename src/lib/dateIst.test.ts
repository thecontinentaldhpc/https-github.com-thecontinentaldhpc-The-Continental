import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatHistoricalArticleDate,
  formatImmutableEditionDate,
  formatIstTime,
  formatNewsUpdatedLabel,
  getIstDateParts,
  isLeapYear,
  isScheduledPublishDue,
  istDateTimeToUtcIso,
  msUntilNextIstMidnight,
  resolveArticleTimestamp,
} from './dateIst';

test('IST date avoids UTC shift before 05:30 IST (late UTC evening is next day in IST)', () => {
  // 2027-01-03T20:00:00Z is 2027-01-04 01:30:00 IST (Monday)
  const utcEvening = new Date('2027-01-03T20:00:00.000Z');
  const parts = getIstDateParts(utcEvening);
  assert.equal(parts.isoDate, '2027-01-04');
  assert.equal(parts.weekday, 'MONDAY');
  assert.equal(parts.day, 4);
  assert.equal(parts.monthName, 'JANUARY');
  assert.equal(parts.year, 2027);
  assert.equal(parts.formattedMasthead, 'MONDAY | 4 JANUARY 2027');
});

test('IST midnight transition advances cleanly across month and year boundaries', () => {
  // 2026-12-31 23:59:30 IST -> 2026-12-31T18:29:30Z
  const beforeMidnight = new Date('2026-12-31T18:29:30.000Z');
  // 2027-01-01 00:00:30 IST -> 2026-12-31T18:30:30Z
  const afterMidnight = new Date('2026-12-31T18:30:30.000Z');

  assert.equal(getIstDateParts(beforeMidnight).isoDate, '2026-12-31');
  assert.equal(getIstDateParts(beforeMidnight).year, 2026);
  assert.equal(getIstDateParts(afterMidnight).isoDate, '2027-01-01');
  assert.equal(getIstDateParts(afterMidnight).year, 2027);
  assert.equal(getIstDateParts(afterMidnight).weekday, 'FRIDAY');

  const msWait = msUntilNextIstMidnight(beforeMidnight);
  assert.ok(msWait >= 30000 && msWait <= 32000);
});

test('Leap year handling works on 29 February 2028 in IST', () => {
  assert.equal(isLeapYear(2028), true);
  assert.equal(isLeapYear(2027), false);
  const leapDayUtc = new Date('2028-02-28T20:00:00.000Z'); // 2028-02-29 01:30 IST
  const parts = getIstDateParts(leapDayUtc);
  assert.equal(parts.isoDate, '2028-02-29');
  assert.equal(parts.monthName, 'FEBRUARY');
  assert.equal(parts.day, 29);
});

test('Historical article dates and edition dates stay immutable regardless of current date', () => {
  const historical = '2027-01-01T02:30:00.000Z'; // 2027-01-01 08:00 AM IST
  const formatted = formatHistoricalArticleDate(historical);
  assert.match(formatted, /1 January 2027/i);
  assert.match(formatted, /IST$/);

  const edition = formatImmutableEditionDate('2027-01-01');
  assert.match(edition, /Friday, 1 January 2027/i);
});

test('Scheduled publishing converts IST properly and enforces editorial approval', () => {
  const utcIso = istDateTimeToUtcIso('2027-01-05', '06:00');
  assert.equal(utcIso, '2027-01-05T00:30:00.000Z');

  const before = new Date('2027-01-05T00:29:00.000Z');
  const after = new Date('2027-01-05T00:31:00.000Z');

  assert.equal(isScheduledPublishDue(utcIso, 'approved', before), false);
  assert.equal(isScheduledPublishDue(utcIso, 'pending', after), false);
  assert.equal(isScheduledPublishDue(utcIso, 'approved', after), true);
});

test('formatIstTime, formatNewsUpdatedLabel, and resolveArticleTimestamp reflect automatic news updates', () => {
  const istTime = formatIstTime(new Date('2026-11-16T04:00:00.000Z')); // 09:30 AM IST
  assert.match(istTime, /09:30 AM IST/i);

  const now = new Date('2026-11-16T10:15:00.000Z');
  const recent = formatNewsUpdatedLabel('2026-11-16T10:14:40.000Z', now);
  assert.equal(recent.relative, '');
  assert.doesNotMatch(recent.combined, /ago|Just now/i);
  assert.match(recent.combined, /16 November 2026 · 03:44 PM IST$/i);
  assert.match(recent.timeOnly, /03:44 PM IST$/i);

  const earlier = formatNewsUpdatedLabel('2026-11-16T07:15:00.000Z', now);
  assert.equal(earlier.relative, '');
  assert.doesNotMatch(earlier.combined, /ago|Just now/i);
  assert.match(earlier.combined, /16 November 2026 · 12:45 PM IST$/i);

  const sameTime = resolveArticleTimestamp({
    published_at: '2026-11-16T08:00:00.000Z',
    updated_at: '2026-11-16T08:00:10.000Z',
    created_at: '2026-11-16T07:55:00.000Z',
  });
  assert.equal(sameTime.isUpdated, false);
  assert.equal(sameTime.label, 'Published');
  assert.equal(sameTime.iso, '2026-11-16T08:00:00.000Z');

  const editedLater = resolveArticleTimestamp({
    published_at: '2026-11-16T08:00:00.000Z',
    updated_at: '2026-11-16T09:15:00.000Z',
    created_at: '2026-11-16T07:55:00.000Z',
  });
  assert.equal(editedLater.isUpdated, true);
  assert.equal(editedLater.label, 'Updated');
  assert.equal(editedLater.iso, '2026-11-16T09:15:00.000Z');
});
