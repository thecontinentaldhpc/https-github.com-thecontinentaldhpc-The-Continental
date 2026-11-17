import type { Article, SavedArticleItem } from '../types/publication';

const FIRESTORE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export type SavedArticleInput = Pick<
  Article,
  | 'id'
  | 'slug'
  | 'title'
  | 'summary'
  | 'subheadline'
  | 'category_name'
  | 'category_slug'
  | 'author_name'
  | 'featured_image_url'
  | 'published_at'
  | 'created_at'
>;

export interface SavedArticleFirestoreFields {
  id: string;
  userId: string;
  articleId: string;
  slug: string;
  title: string;
  summary: string;
  categoryName: string;
  categorySlug: string;
  authorName: string;
  featuredImageUrl?: string;
  publishedAt: string;
}

export function isValidFirestoreId(value: string): boolean {
  return typeof value === 'string' && FIRESTORE_ID_PATTERN.test(value);
}

function clampRequiredText(value: string | null | undefined, fallback: string, maxLen: number): string {
  const cleaned = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return fallback.slice(0, maxLen);
  }
  return cleaned.slice(0, maxLen);
}

function clampOptionalText(value: string | null | undefined, maxLen: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export function toSavedArticlePayload(
  article: SavedArticleInput,
  userId: string
): SavedArticleFirestoreFields {
  const cleanUserId = String(userId || '').trim();
  const cleanArticleId = String(article.id || '').trim();

  if (!isValidFirestoreId(cleanUserId)) {
    throw new Error('Invalid user identifier for Firestore reading list.');
  }
  if (!isValidFirestoreId(cleanArticleId)) {
    throw new Error('Invalid article identifier for Firestore reading list.');
  }

  const rawImage = String(article.featured_image_url ?? '').trim();
  const safePublishedAt = clampOptionalText(article.published_at || article.created_at || '', 64);

  const payload: SavedArticleFirestoreFields = {
    id: cleanArticleId,
    userId: cleanUserId,
    articleId: cleanArticleId,
    slug: clampRequiredText(article.slug, cleanArticleId, 160),
    title: clampRequiredText(article.title, 'Untitled Dispatch', 300),
    summary: clampOptionalText(article.summary || article.subheadline || '', 1000),
    categoryName: clampRequiredText(article.category_name, 'News', 80),
    categorySlug: clampRequiredText(article.category_slug, 'world', 80),
    authorName: clampRequiredText(article.author_name, 'THE CONTINENTAL Staff', 120),
    publishedAt: safePublishedAt,
  };

  if (rawImage.length > 0 && rawImage.length <= 500) {
    payload.featuredImageUrl = rawImage;
  }

  return payload;
}

export function normalizeTimestampValue(value: unknown, fallbackIso = new Date().toISOString()): string {
  if (!value) return fallbackIso;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? fallbackIso : new Date(ms).toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallbackIso : value.toISOString();
  }
  if (typeof value === 'object') {
    const obj = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof obj.toDate === 'function') {
      const dt = obj.toDate();
      return Number.isNaN(dt.getTime()) ? fallbackIso : dt.toISOString();
    }
    const seconds = typeof obj.seconds === 'number' ? obj.seconds : obj._seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  return fallbackIso;
}

export function normalizeSavedArticleDoc(
  raw: Record<string, unknown>,
  fallbackId?: string
): SavedArticleItem | null {
  const articleId = String(raw.articleId || raw.id || fallbackId || '').trim();
  const userId = String(raw.userId || '').trim();
  const slug = String(raw.slug || '').trim();
  const title = String(raw.title || '').trim();
  if (!articleId || !slug || !title) {
    return null;
  }

  const featuredImageUrl =
    typeof raw.featuredImageUrl === 'string' && raw.featuredImageUrl.trim().length > 0
      ? raw.featuredImageUrl.trim()
      : null;

  return {
    id: String(raw.id || articleId),
    userId,
    articleId,
    slug,
    title,
    summary: String(raw.summary || ''),
    categoryName: String(raw.categoryName || 'News'),
    categorySlug: String(raw.categorySlug || 'world'),
    authorName: String(raw.authorName || 'THE CONTINENTAL Staff'),
    featuredImageUrl,
    publishedAt: String(raw.publishedAt || ''),
    savedAt: normalizeTimestampValue(raw.savedAt),
  };
}

export function sortReadingListNewestFirst(items: SavedArticleItem[]): SavedArticleItem[] {
  return [...items].sort((a, b) => {
    const aMs = Date.parse(a.savedAt) || 0;
    const bMs = Date.parse(b.savedAt) || 0;
    return bMs - aMs;
  });
}

export function upsertSavedArticleInList(
  items: SavedArticleItem[],
  nextItem: SavedArticleItem
): SavedArticleItem[] {
  const filtered = items.filter((item) => item.articleId !== nextItem.articleId);
  return sortReadingListNewestFirst([nextItem, ...filtered]);
}

export function removeSavedArticleFromList(
  items: SavedArticleItem[],
  articleId: string
): SavedArticleItem[] {
  return items.filter((item) => item.articleId !== articleId);
}

export function hasSavedArticle(items: SavedArticleItem[], articleId: string | null | undefined): boolean {
  if (!articleId) return false;
  return items.some((item) => item.articleId === articleId);
}
