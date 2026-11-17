import { randomUUID } from 'node:crypto';
import { bumpEditionLastUpdatedAt, db } from './db';
import { logAudit } from './auth';
import {
  computeTitleSimilarity,
  mergeDevelopingStoryUpdate,
  parseRssFeedXml,
  pickVerifiedFallbackImage,
  synthesizeEditorialDispatch,
  type FeedSource,
  type ParsedRssItem,
} from './liveNewsParser';

interface FeedConfig {
  label: string;
  url: string;
  source: FeedSource;
  defaultCategorySlug: string;
}

const LIVE_NEWS_FEEDS: readonly FeedConfig[] = [
  {
    label: 'Google News Top Stories',
    url: 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en',
    source: 'google-news',
    defaultCategorySlug: 'india',
  },
  {
    label: 'Google News World Wire',
    url: 'https://news.google.com/rss/search?q=World+Diplomacy+OR+Global+Crisis+when:2d&hl=en-IN&gl=IN&ceid=IN:en',
    source: 'google-news',
    defaultCategorySlug: 'world',
  },
  {
    label: 'Google News India & Policy',
    url: 'https://news.google.com/rss/search?q=India+Parliament+OR+Supreme+Court+OR+Economy+when:2d&hl=en-IN&gl=IN&ceid=IN:en',
    source: 'google-news',
    defaultCategorySlug: 'india',
  },
  {
    label: 'The Hindu National',
    url: 'https://www.thehindu.com/news/national/feeder/default.rss',
    source: 'the-hindu',
    defaultCategorySlug: 'india',
  },
  {
    label: 'The Hindu International',
    url: 'https://www.thehindu.com/news/international/feeder/default.rss',
    source: 'the-hindu',
    defaultCategorySlug: 'world',
  },
  {
    label: 'The Hindu Business & Economy',
    url: 'https://www.thehindu.com/business/feeder/default.rss',
    source: 'the-hindu',
    defaultCategorySlug: 'business',
  },
  {
    label: 'The Hindu Science & Tech',
    url: 'https://www.thehindu.com/sci-tech/feeder/default.rss',
    source: 'the-hindu',
    defaultCategorySlug: 'science-technology',
  },
  {
    label: 'The Hindu Sport',
    url: 'https://www.thehindu.com/sport/feeder/default.rss',
    source: 'the-hindu',
    defaultCategorySlug: 'sports',
  },
];

const FEED_USER_AGENT =
  'Mozilla/5.0 (compatible; Feedfetcher-Google; +http://www.google.com/feedfetcher.html)';

export interface LiveSyncResult {
  inserted: number;
  updated: number;
  feedsChecked: number;
  feedsSucceeded: number;
  editionUpdatedAt: string;
}

let inFlightSync: Promise<LiveSyncResult> | null = null;

async function fetchRssXml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': FEED_USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.includes('<item') ? text : null;
  } catch {
    return null;
  }
}

async function verifyImageUrlReachable(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  if (!/^https:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    return ct.startsWith('image/') || ct === '' ? url : null;
  } catch {
    return null;
  }
}

export async function runLiveNewsSync(options?: { maxNewPerCycle?: number; triggeredBy?: string }): Promise<LiveSyncResult> {
  if (inFlightSync) return inFlightSync;

  inFlightSync = (async () => {
    const maxNew = options?.maxNewPerCycle ?? 14;
    const now = new Date();
    const nowIso = now.toISOString();
    const cutoffMs = now.getTime() - 48 * 60 * 60 * 1000;

    let feedsChecked = 0;
    let feedsSucceeded = 0;
    const collectedItems: ParsedRssItem[] = [];

    const feedResponses = await Promise.all(
      LIVE_NEWS_FEEDS.map(async (feed) => {
        feedsChecked++;
        const xml = await fetchRssXml(feed.url);
        if (!xml) return [];
        feedsSucceeded++;
        return parseRssFeedXml(xml, feed.source, feed.defaultCategorySlug).slice(0, 6);
      })
    );

    for (const batch of feedResponses) {
      for (const item of batch) {
        const pubMs = Date.parse(item.pubDateIso);
        if (!Number.isNaN(pubMs) && pubMs >= cutoffMs) {
          collectedItems.push(item);
        }
      }
    }

    // Sort newest first so freshest developments lead
    collectedItems.sort((a, b) => Date.parse(b.pubDateIso) - Date.parse(a.pubDateIso));

    const categoryRows = db.prepare('SELECT id, slug FROM categories').all() as Array<{ id: string; slug: string }>;
    const catIdBySlug = new Map(categoryRows.map((c) => [c.slug, c.id]));

    const authorRows = db.prepare('SELECT id, slug FROM authors').all() as Array<{ id: string; slug: string }>;
    const authorIdBySlug = new Map(authorRows.map((a) => [a.slug, a.id]));
    const fallbackAuthorId = authorRows[0]?.id;
    const fallbackCategoryId = catIdBySlug.get('india') || categoryRows[0]?.id;

    if (!fallbackAuthorId || !fallbackCategoryId) {
      return {
        inserted: 0,
        updated: 0,
        feedsChecked,
        feedsSucceeded,
        editionUpdatedAt: nowIso,
      };
    }

    const existingArticles = db
      .prepare(
        `SELECT id, title, slug, summary, content_html, featured_image_url, source_guid, published_at, updated_at
         FROM articles
         ORDER BY COALESCE(published_at, created_at) DESC
         LIMIT 150`
      )
      .all() as Array<{
      id: string;
      title: string;
      slug: string;
      summary: string;
      content_html: string;
      featured_image_url: string | null;
      source_guid: string | null;
      published_at: string | null;
      updated_at: string;
    }>;

    const existingGuids = new Set(existingArticles.map((a) => a.source_guid).filter(Boolean) as string[]);
    const seenBatchTitles: string[] = [];

    let inserted = 0;
    let updated = 0;

    for (const item of collectedItems) {
      // Avoid duplicates within the same fetch batch
      if (seenBatchTitles.some((t) => computeTitleSimilarity(t, item.title) >= 0.45)) {
        continue;
      }

      const dispatch = synthesizeEditorialDispatch(item);
      seenBatchTitles.push(dispatch.title);

      // 1. Check exact source_guid match first
      const exactExisting = existingArticles.find((a) => a.source_guid === dispatch.sourceGuid);
      if (exactExisting) {
        continue;
      }

      // 2. Check developing issue match by title similarity against existing stories
      const relatedExisting = existingArticles.find(
        (a) => computeTitleSimilarity(a.title, dispatch.title) >= 0.38
      );

      if (relatedExisting) {
        const merged = mergeDevelopingStoryUpdate(
          relatedExisting.content_html,
          relatedExisting.summary,
          dispatch,
          nowIso
        );
        if (merged.changed) {
          let nextImage = relatedExisting.featured_image_url;
          if (!nextImage && dispatch.featuredImageUrl) {
            nextImage =
              (await verifyImageUrlReachable(dispatch.featuredImageUrl)) ||
              pickVerifiedFallbackImage(dispatch.categorySlug, dispatch.title, dispatch.summary);
          }

          db.prepare(
            `UPDATE articles
             SET summary = ?, content_html = ?, featured_image_url = COALESCE(featured_image_url, ?),
                 is_breaking = CASE WHEN ? = 1 THEN 1 ELSE is_breaking END,
                 updated_at = ?
             WHERE id = ?`
          ).run(
            merged.nextSummary,
            merged.nextContentHtml,
            nextImage,
            dispatch.isBreaking ? 1 : 0,
            nowIso,
            relatedExisting.id
          );

          relatedExisting.content_html = merged.nextContentHtml;
          relatedExisting.summary = merged.nextSummary;
          relatedExisting.updated_at = nowIso;
          updated++;
        }
        continue;
      }

      if (inserted >= maxNew) continue;
      if (existingGuids.has(dispatch.sourceGuid)) continue;

      const categoryId = catIdBySlug.get(dispatch.categorySlug) || fallbackCategoryId;
      const authorId = authorIdBySlug.get(dispatch.authorSlug) || fallbackAuthorId;

      let verifiedImage = await verifyImageUrlReachable(dispatch.featuredImageUrl);
      if (!verifiedImage) {
        verifiedImage = pickVerifiedFallbackImage(dispatch.categorySlug, dispatch.title, dispatch.summary);
      }

      const id = randomUUID();
      let slug = dispatch.slug;
      const slugExists = db.prepare('SELECT id FROM articles WHERE slug = ?').get(slug);
      if (slugExists) {
        slug = `${slug.slice(0, 64)}-${id.slice(0, 6)}`;
      }

      const isFeaturedTop = inserted < 2 ? 1 : 0;
      const featuredSlot = inserted < 2 ? 'top_story' : null;

      db.prepare(
        `INSERT INTO articles (
          id, title, subheadline, slug, summary, content_html, featured_image_url,
          image_caption, image_credit, author_id, category_id, tags_json,
          seo_title, seo_description, status, approval_status, is_featured,
          featured_slot, is_breaking, scheduled_at, published_at, updated_at, created_at,
          source_guid, source_url, source_name, topic_signature
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'approved', ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        dispatch.title,
        dispatch.subheadline,
        slug,
        dispatch.summary,
        dispatch.contentHtml,
        verifiedImage,
        verifiedImage ? dispatch.imageCaption : '',
        verifiedImage ? dispatch.imageCredit : '',
        authorId,
        categoryId,
        JSON.stringify(dispatch.tags),
        `${dispatch.title} | THE CONTINENTAL`,
        dispatch.summary,
        isFeaturedTop,
        featuredSlot,
        dispatch.isBreaking ? 1 : 0,
        dispatch.publishedAtIso,
        dispatch.publishedAtIso,
        nowIso,
        dispatch.sourceGuid,
        dispatch.sourceUrl,
        dispatch.sourceName,
        dispatch.topicSignature
      );

      existingGuids.add(dispatch.sourceGuid);
      existingArticles.unshift({
        id,
        title: dispatch.title,
        slug,
        summary: dispatch.summary,
        content_html: dispatch.contentHtml,
        featured_image_url: verifiedImage,
        source_guid: dispatch.sourceGuid,
        published_at: dispatch.publishedAtIso,
        updated_at: dispatch.publishedAtIso,
      });
      inserted++;
    }

    // Keep breaking bar focused on up to 6 freshest breaking dispatches
    db.exec(`
      UPDATE articles
      SET is_breaking = 0
      WHERE is_breaking = 1
        AND id NOT IN (
          SELECT id FROM articles
          WHERE status = 'published' AND approval_status = 'approved' AND is_breaking = 1
          ORDER BY COALESCE(updated_at, published_at, created_at) DESC
          LIMIT 6
        )
    `);

    if (inserted > 0 || updated > 0) {
      bumpEditionLastUpdatedAt(nowIso);
      logAudit(
        options?.triggeredBy || 'news-monitor@system',
        'LIVE_NEWS_SYNC',
        'article',
        'live-feeds',
        `Synced Google News & The Hindu: ${inserted} new dispatches added, ${updated} developing stories updated (${feedsSucceeded}/${feedsChecked} feeds active).`
      );
    }

    db.prepare(
      `INSERT INTO site_settings (key, value_json, updated_at) VALUES ('live_sync_last_run', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
    ).run(JSON.stringify({ at: nowIso, inserted, updated, feedsSucceeded, feedsChecked }), nowIso);

    return {
      inserted,
      updated,
      feedsChecked,
      feedsSucceeded,
      editionUpdatedAt: nowIso,
    };
  })().finally(() => {
    inFlightSync = null;
  });

  return inFlightSync;
}
