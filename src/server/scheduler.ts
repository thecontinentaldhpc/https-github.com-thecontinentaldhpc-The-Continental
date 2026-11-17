import { bumpEditionLastUpdatedAt, db } from './db';
import { logAudit } from './auth';
import { isScheduledPublishDue } from '../lib/dateIst';
import { runLiveNewsSync } from './liveNewsSync';

const LIVE_SYNC_INTERVAL_MS = 10 * 60 * 1000; // Check Google News & The Hindu every 10 minutes continuously

export function runScheduledPublishingCycle(): {
  articlesPublished: number;
  magazinesPublished: number;
  epapersPublished: number;
} {
  const now = new Date();
  const nowIso = now.toISOString();
  let articlesPublished = 0;
  let magazinesPublished = 0;
  let epapersPublished = 0;

  // 1. Scheduled Articles: only publish when scheduled_at <= now AND approval_status === 'approved'
  const dueArticles = db
    .prepare(
      `SELECT id, title, scheduled_at, approval_status FROM articles
       WHERE status = 'scheduled' AND scheduled_at IS NOT NULL`
    )
    .all() as Array<{ id: string; title: string; scheduled_at: string; approval_status: string }>;

  for (const art of dueArticles) {
    if (isScheduledPublishDue(art.scheduled_at, art.approval_status, now)) {
      db.prepare(
        `UPDATE articles SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?`
      ).run(art.scheduled_at, nowIso, art.id);
      logAudit('scheduler@system', 'AUTO_PUBLISH_ARTICLE', 'article', art.id, `Scheduled article published at ${nowIso}: ${art.title}`);
      articlesPublished++;
    }
  }

  // 2. Scheduled Magazines: ONLY publish if approved_by_admin = 1 AND pdf_url is uploaded
  const dueMags = db
    .prepare(
      `SELECT id, title, scheduled_at, approved_by_admin, pdf_url FROM magazines
       WHERE status = 'scheduled' AND scheduled_at IS NOT NULL`
    )
    .all() as Array<{ id: string; title: string; scheduled_at: string; approved_by_admin: number; pdf_url: string | null }>;

  for (const mag of dueMags) {
    if (
      mag.approved_by_admin === 1 &&
      mag.pdf_url &&
      mag.pdf_url.trim().length > 0 &&
      isScheduledPublishDue(mag.scheduled_at, 'approved', now)
    ) {
      db.prepare(
        `UPDATE magazines SET status = 'published', published_at = COALESCE(published_at, ?) WHERE id = ?`
      ).run(mag.scheduled_at, mag.id);
      logAudit('scheduler@system', 'AUTO_PUBLISH_MAGAZINE', 'magazine', mag.id, `Scheduled magazine published: ${mag.title}`);
      magazinesPublished++;
    }
  }

  // 3. Scheduled E-Paper Editions: ONLY publish if approved_by_admin = 1 AND pdf_url is uploaded
  const dueEpapers = db
    .prepare(
      `SELECT id, title, scheduled_at, approved_by_admin, pdf_url FROM epaper_editions
       WHERE status = 'scheduled' AND scheduled_at IS NOT NULL`
    )
    .all() as Array<{ id: string; title: string; scheduled_at: string; approved_by_admin: number; pdf_url: string | null }>;

  for (const ep of dueEpapers) {
    if (
      ep.approved_by_admin === 1 &&
      ep.pdf_url &&
      ep.pdf_url.trim().length > 0 &&
      isScheduledPublishDue(ep.scheduled_at, 'approved', now)
    ) {
      db.prepare(
        `UPDATE epaper_editions SET status = 'published', published_at = COALESCE(published_at, ?) WHERE id = ?`
      ).run(ep.scheduled_at, ep.id);
      logAudit('scheduler@system', 'AUTO_PUBLISH_EPAPER', 'epaper', ep.id, `Scheduled e-paper published: ${ep.title}`);
      epapersPublished++;
    }
  }

  if (articlesPublished > 0) {
    bumpEditionLastUpdatedAt(nowIso);
  }

  return { articlesPublished, magazinesPublished, epapersPublished };
}

export function startScheduler(): NodeJS.Timeout {
  runScheduledPublishingCycle();

  // Trigger initial live Google News + The Hindu check shortly after startup (non-blocking)
  setTimeout(() => {
    void runLiveNewsSync({ maxNewPerCycle: 14, triggeredBy: 'startup-monitor@system' }).catch((err) => {
      console.error('Initial live news sync failed:', err);
    });
  }, 1500);

  // Keep continuous 24/7 newsroom monitoring active while the server runs
  setInterval(() => {
    void runLiveNewsSync({ maxNewPerCycle: 10, triggeredBy: 'continuous-monitor@system' }).catch((err) => {
      console.error('Periodic live news sync failed:', err);
    });
  }, LIVE_SYNC_INTERVAL_MS);

  return setInterval(() => {
    try {
      runScheduledPublishingCycle();
    } catch (err) {
      console.error('Scheduler cycle failed:', err);
    }
  }, 30000);
}
