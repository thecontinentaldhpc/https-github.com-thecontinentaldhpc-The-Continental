import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import { bumpEditionLastUpdatedAt, db, getEditionLastUpdatedAt, initializeDatabase, UPLOADS_DIR } from './src/server/db';
import {
  type AuthenticatedRequest,
  buildSessionCookieHeader,
  extractSessionToken,
  hashPassword,
  logAudit,
  rateLimit,
  requireAdmin,
  requireAdminOrNotificationRecipient,
  requireUser,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './src/server/auth';
import { runScheduledPublishingCycle, startScheduler } from './src/server/scheduler';
import { runLiveNewsSync } from './src/server/liveNewsSync';
import {
  dispatchAdminNotification,
  sendNotificationViaGmailApi,
  verifyGmailBearerToken,
} from './src/server/notifications';
import { adminAuth, adminDb } from './src/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  ADMIN_EMAIL,
  canPublishEdition,
  convertPlainTextToParagraphHtml,
  generateSlug,
  generateSubmissionCode,
  isAdminEmail,
  NOTIFICATION_EMAIL,
  resolveRoleForEmail,
  sanitizeEditorialHtml,
} from './src/lib/editorialRules';
import { buildNotificationEmailContent } from './src/lib/gmailPayload';
import { getIstDateParts } from './src/lib/dateIst';
import {
  isValidFirestoreId,
  normalizeSavedArticleDoc,
  sortReadingListNewestFirst,
  toSavedArticlePayload,
} from './src/lib/readingList';

initializeDatabase();
startScheduler();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Serve uploaded files safely
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1d' }));

// Multer storage with strict extension & MIME validation
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
  },
});

const uploadMedia = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only JPEG, PNG, WebP, GIF images and PDF documents are allowed.'));
    }
  },
});

const uploadPublicImage = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, or WebP images up to 4 MB are permitted.'));
    }
  },
});

function getAllSettings(): Record<string, unknown> {
  const rows = db.prepare('SELECT key, value_json FROM site_settings').all() as Array<{ key: string; value_json: string }>;
  const obj: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      obj[row.key] = JSON.parse(row.value_json);
    } catch {
      obj[row.key] = row.value_json;
    }
  }
  return obj;
}

function mapArticleRow(row: Record<string, unknown>) {
  let tags: string[] = [];
  try {
    tags = JSON.parse(String(row.tags_json || '[]'));
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    title: row.title,
    subheadline: row.subheadline,
    slug: row.slug,
    summary: row.summary,
    content_html: row.content_html,
    featured_image_url: row.featured_image_url,
    image_caption: row.image_caption,
    image_credit: row.image_credit,
    author_id: row.author_id,
    author_name: row.author_name,
    author_role: row.author_role,
    author_bio: row.author_bio,
    author_slug: row.author_slug,
    category_id: row.category_id,
    category_name: row.category_name,
    category_slug: row.category_slug,
    tags,
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    status: row.status,
    approval_status: row.approval_status,
    is_featured: Boolean(row.is_featured),
    featured_slot: row.featured_slot,
    is_breaking: Boolean(row.is_breaking),
    scheduled_at: row.scheduled_at,
    published_at: row.published_at,
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}

const ARTICLE_SELECT = `
  SELECT
    a.*,
    au.name as author_name,
    au.role_title as author_role,
    au.bio as author_bio,
    au.slug as author_slug,
    c.name as category_name,
    c.slug as category_slug
  FROM articles a
  JOIN authors au ON au.id = a.author_id
  JOIN categories c ON c.id = a.category_id
`;

// ==================================================
// HEALTH & CORE SITE DATA
// ==================================================

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timezone: 'Asia/Kolkata', ist: getIstDateParts() });
});

app.get('/api/site-data', (_req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
  const settings = getAllSettings();
  res.json({
    categories,
    settings,
    istDate: getIstDateParts(),
    editionUpdatedAt: getEditionLastUpdatedAt(),
    serverTimeIso: new Date().toISOString(),
  });
});

// ==================================================
// PUBLIC HOMEPAGE & NEWS ROUTES
// ==================================================

app.get('/api/homepage', (_req, res) => {
  runScheduledPublishingCycle();

  const publishedArticles = (
    db
      .prepare(
        `${ARTICLE_SELECT}
         WHERE a.status = 'published' AND a.approval_status = 'approved'
         ORDER BY MAX(COALESCE(a.published_at, a.created_at), COALESCE(a.updated_at, a.created_at)) DESC
         LIMIT 120`
      )
      .all() as Record<string, unknown>[]
  ).map(mapArticleRow);

  const breaking = publishedArticles.filter((a) => a.is_breaking).slice(0, 6);
  const lead =
    publishedArticles.find((a) => a.featured_slot === 'lead') ||
    publishedArticles.find((a) => a.featured_image_url) ||
    publishedArticles[0] ||
    null;

  const topStories = publishedArticles
    .filter((a) => a.id !== lead?.id && (a.featured_slot === 'top_story' || a.is_featured))
    .slice(0, 4);

  const byCategorySlug = (slug: string, limit = 4) =>
    publishedArticles.filter((a) => a.category_slug === slug && a.id !== lead?.id).slice(0, limit);

  const latestMagazine = db
    .prepare(
      `SELECT * FROM magazines
       WHERE status IN ('published', 'upcoming')
       ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END, year DESC, month ASC
       LIMIT 1`
    )
    .get() as Record<string, unknown> | undefined;

  let magazineArticles: Record<string, unknown>[] = [];
  if (latestMagazine) {
    magazineArticles = db
      .prepare('SELECT * FROM magazine_articles WHERE magazine_id = ? ORDER BY sort_order ASC LIMIT 4')
      .all(String(latestMagazine.id)) as Record<string, unknown>[];
  }

  const latestEpaper = db
    .prepare(
      `SELECT * FROM epaper_editions
       WHERE status IN ('published', 'upcoming')
       ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END, edition_date DESC
       LIMIT 1`
    )
    .get() as Record<string, unknown> | undefined;

  res.json({
    breaking,
    lead,
    topStories: topStories.length > 0 ? topStories : publishedArticles.filter((a) => a.id !== lead?.id).slice(0, 4),
    sections: {
      world: byCategorySlug('world', 4),
      india: byCategorySlug('india', 4),
      regional: byCategorySlug('regional', 4),
      politics: byCategorySlug('politics', 4),
      business: byCategorySlug('business', 4),
      economy: byCategorySlug('economy', 4),
      education: byCategorySlug('education', 4),
      scienceTechnology: byCategorySlug('science-technology', 4),
      environment: byCategorySlug('environment', 4),
      sports: byCategorySlug('sports', 4),
      opinion: byCategorySlug('opinion', 4),
      editorial: byCategorySlug('editorial', 3),
    },
    latestNews: publishedArticles.slice(0, 10),
    latestMagazine: latestMagazine
      ? {
          ...latestMagazine,
          approved_by_admin: Boolean(latestMagazine.approved_by_admin),
          pdf_url:
            latestMagazine.status === 'published' && latestMagazine.approved_by_admin
              ? latestMagazine.pdf_url
              : null,
          articles: magazineArticles,
        }
      : null,
    latestEpaper: latestEpaper
      ? {
          ...latestEpaper,
          approved_by_admin: Boolean(latestEpaper.approved_by_admin),
          pdf_url:
            latestEpaper.status === 'published' && latestEpaper.approved_by_admin
              ? latestEpaper.pdf_url
              : null,
        }
      : null,
    editionUpdatedAt: getEditionLastUpdatedAt(),
    serverTimeIso: new Date().toISOString(),
  });
});

app.get('/api/articles', (req, res) => {
  runScheduledPublishingCycle();
  const categorySlug = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(30, Math.max(1, Number(req.query.limit || 12)));
  const offset = (page - 1) * limit;

  let where = `WHERE a.status = 'published' AND a.approval_status = 'approved'`;
  const params: (string | number)[] = [];

  if (categorySlug) {
    where += ` AND c.slug = ?`;
    params.push(categorySlug);
  }

  const totalRow = db
    .prepare(`SELECT COUNT(*) as total FROM articles a JOIN categories c ON c.id = a.category_id ${where}`)
    .get(...params) as { total: number };

  const rows = db
    .prepare(
      `${ARTICLE_SELECT} ${where}
       ORDER BY MAX(COALESCE(a.published_at, a.created_at), COALESCE(a.updated_at, a.created_at)) DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Record<string, unknown>[];

  res.json({
    articles: rows.map(mapArticleRow),
    editionUpdatedAt: getEditionLastUpdatedAt(),
    pagination: {
      page,
      limit,
      total: totalRow.total,
      totalPages: Math.max(1, Math.ceil(totalRow.total / limit)),
    },
  });
});

app.get('/api/articles/:slug', (req, res) => {
  runScheduledPublishingCycle();
  const row = db
    .prepare(
      `${ARTICLE_SELECT}
       WHERE a.slug = ? AND a.status = 'published' AND a.approval_status = 'approved'`
    )
    .get(req.params.slug) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }

  const article = mapArticleRow(row);
  const relatedRows = db
    .prepare(
      `${ARTICLE_SELECT}
       WHERE a.status = 'published' AND a.approval_status = 'approved' AND a.category_id = ? AND a.id != ?
       ORDER BY COALESCE(a.published_at, a.created_at) DESC
       LIMIT 4`
    )
    .all(String(row.category_id), String(row.id)) as Record<string, unknown>[];

  res.json({
    article,
    related: relatedRows.map(mapArticleRow),
  });
});

// ==================================================
// USER READING LIST (FIRESTORE + SQLITE PROFILE STORE)
// ==================================================

async function ensureFirestoreUserDocForSession(user: NonNullable<AuthenticatedRequest['user']>): Promise<string> {
  const firestoreUid = user.uid || user.id;
  if (!isValidFirestoreId(firestoreUid)) {
    throw new Error('Invalid user profile identifier.');
  }
  const userRef = adminDb.collection('users').doc(firestoreUid);
  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set({
      uid: firestoreUid,
      displayName: (user.fullName || user.email || 'Reader').slice(0, 120),
      role: user.role,
      lastLoginAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  return firestoreUid;
}

app.get('/api/reading-list', requireUser, async (req: AuthenticatedRequest, res) => {
  const profileId = req.user!.id;
  const firestoreUid = req.user!.uid || req.user!.id;

  let firestoreItems: ReturnType<typeof sortReadingListNewestFirst> = [];
  if (isValidFirestoreId(firestoreUid)) {
    try {
      const snap = await adminDb
        .collection('users')
        .doc(firestoreUid)
        .collection('saved_articles')
        .orderBy('savedAt', 'desc')
        .get();
      firestoreItems = snap.docs
        .map((docSnap) => normalizeSavedArticleDoc(docSnap.data() as Record<string, unknown>, docSnap.id))
        .filter((item): item is NonNullable<typeof item> => item !== null);
    } catch (err) {
      console.warn('Firestore reading list read skipped:', err instanceof Error ? err.message : err);
    }
  }

  const sqliteRows = db
    .prepare(
      `SELECT * FROM saved_articles
       WHERE user_id = ?
       ORDER BY saved_at DESC`
    )
    .all(profileId) as Array<Record<string, unknown>>;

  const sqliteItems = sqliteRows
    .map((r) =>
      normalizeSavedArticleDoc(
        {
          id: r.article_id,
          userId: firestoreUid,
          articleId: r.article_id,
          slug: r.slug,
          title: r.title,
          summary: r.summary,
          categoryName: r.category_name,
          categorySlug: r.category_slug,
          authorName: r.author_name,
          featuredImageUrl: r.featured_image_url,
          publishedAt: r.published_at,
          savedAt: r.saved_at,
        },
        String(r.article_id)
      )
    )
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const mergedById = new Map<string, (typeof sqliteItems)[number]>();
  for (const item of sqliteItems) {
    mergedById.set(item.articleId, item);
  }
  for (const item of firestoreItems) {
    mergedById.set(item.articleId, item);
  }

  res.json({ items: sortReadingListNewestFirst(Array.from(mergedById.values())) });
});

app.post('/api/reading-list', requireUser, async (req: AuthenticatedRequest, res) => {
  const articleId = typeof req.body?.articleId === 'string' ? req.body.articleId.trim() : '';
  if (!isValidFirestoreId(articleId)) {
    res.status(400).json({ error: 'A valid articleId is required.' });
    return;
  }

  const row = db
    .prepare(
      `${ARTICLE_SELECT}
       WHERE a.id = ? AND a.status = 'published' AND a.approval_status = 'approved'`
    )
    .get(articleId) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Published article not found.' });
    return;
  }

  const firestoreUid = req.user!.uid || req.user!.id;
  if (!isValidFirestoreId(firestoreUid)) {
    res.status(400).json({ error: 'Invalid user identifier.' });
    return;
  }

  const mappedArticle = mapArticleRow(row) as {
    id: string;
    slug: string;
    title: string;
    summary: string;
    subheadline: string;
    category_name?: string;
    category_slug?: string;
    author_name?: string;
    featured_image_url: string | null;
    published_at: string | null;
    created_at: string;
  };
  const payload = toSavedArticlePayload(mappedArticle, firestoreUid);
  const nowIso = new Date().toISOString();

  const existingSqlite = db
    .prepare('SELECT saved_at FROM saved_articles WHERE user_id = ? AND article_id = ?')
    .get(req.user!.id, articleId) as { saved_at: string } | undefined;

  const effectiveSavedAt = existingSqlite?.saved_at || nowIso;

  db.prepare(
    `INSERT INTO saved_articles (
      user_id, article_id, slug, title, summary, category_name, category_slug,
      author_name, featured_image_url, published_at, saved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, article_id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      summary = excluded.summary,
      category_name = excluded.category_name,
      category_slug = excluded.category_slug,
      author_name = excluded.author_name,
      featured_image_url = excluded.featured_image_url,
      published_at = excluded.published_at`
  ).run(
    req.user!.id,
    payload.articleId,
    payload.slug,
    payload.title,
    payload.summary,
    payload.categoryName,
    payload.categorySlug,
    payload.authorName,
    payload.featuredImageUrl ?? null,
    payload.publishedAt,
    effectiveSavedAt
  );

  try {
    await ensureFirestoreUserDocForSession(req.user!);
    const docRef = adminDb.collection('users').doc(firestoreUid).collection('saved_articles').doc(articleId);
    const existingSnap = await docRef.get();
    if (!existingSnap.exists) {
      await docRef.set({
        ...payload,
        savedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await docRef.update({
        title: payload.title,
        summary: payload.summary,
        slug: payload.slug,
      });
    }
  } catch (err) {
    console.warn('Firestore reading list save sync skipped:', err instanceof Error ? err.message : err);
  }

  res.status(existingSqlite ? 200 : 201).json({
    item: {
      ...payload,
      featuredImageUrl: payload.featuredImageUrl ?? null,
      savedAt: effectiveSavedAt,
    },
  });
});

app.delete('/api/reading-list/:articleId', requireUser, async (req: AuthenticatedRequest, res) => {
  const articleId = String(req.params.articleId || '').trim();
  if (!isValidFirestoreId(articleId)) {
    res.status(400).json({ error: 'Invalid articleId.' });
    return;
  }
  const firestoreUid = req.user!.uid || req.user!.id;

  db.prepare('DELETE FROM saved_articles WHERE user_id = ? AND article_id = ?').run(req.user!.id, articleId);

  if (isValidFirestoreId(firestoreUid)) {
    try {
      await adminDb.collection('users').doc(firestoreUid).collection('saved_articles').doc(articleId).delete();
    } catch (err) {
      console.warn('Firestore reading list delete sync skipped:', err instanceof Error ? err.message : err);
    }
  }

  res.json({ ok: true });
});

// ==================================================
// PUBLIC WRITING SUBMISSION WORKFLOW
// ==================================================

const publicSubmissionSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name is required.').max(120),
  email: z.string().trim().email('Please provide a valid email address.').max(180),
  title: z.string().trim().min(6, 'Article title must be at least 6 characters.').max(220),
  category_id: z.string().trim().min(1, 'Please choose an article category.'),
  short_description: z.string().trim().min(10, 'Short description must be at least 10 characters.').max(600),
  content: z.string().trim().min(50, 'Full article content must be at least 50 characters.').max(60000),
  featured_image_url: z.string().trim().max(500).nullable().optional(),
  author_bio: z.string().trim().min(10, 'Author biography must be at least 10 characters.').max(800),
  originality_confirmed: z.literal(true, { error: 'You must confirm the work is original.' }),
  terms_accepted: z.literal(true, { error: 'You must accept the submission terms.' }),
  website_honeypot: z.string().optional(),
});

app.post(
  '/api/upload/public-image',
  requireUser,
  rateLimit('public-upload', 10, 60 * 60 * 1000),
  uploadPublicImage.single('file'),
  (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided.' });
      return;
    }
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url, originalName: req.file.originalname, sizeBytes: req.file.size });
  }
);

app.post('/api/submissions', requireUser, rateLimit('submissions', 8, 60 * 60 * 1000), async (req: AuthenticatedRequest, res) => {
  const fallbackEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const parsed = publicSubmissionSchema.safeParse({
    ...req.body,
    email: req.user!.email || fallbackEmail,
    full_name: (req.body?.full_name && String(req.body.full_name).trim()) || req.user!.fullName,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid submission fields.' });
    return;
  }
  const data = parsed.data;
  if (data.website_honeypot && data.website_honeypot.trim().length > 0) {
    res.status(400).json({ error: 'Submission rejected by spam filter.' });
    return;
  }

  const category = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(data.category_id) as
    | { id: string; name: string }
    | undefined;
  if (!category) {
    res.status(400).json({ error: 'Selected category does not exist.' });
    return;
  }

  const id = randomUUID();
  const submissionCode = generateSubmissionCode();
  const now = new Date().toISOString();
  const contentHtml = convertPlainTextToParagraphHtml(data.content);

  db.prepare(
    `INSERT INTO submissions (
      id, submission_code, full_name, email, title, category_id, short_description,
      content_html, featured_image_url, author_bio, originality_confirmed, terms_accepted,
      status, internal_notes, published_article_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'Submitted', '', NULL, ?, ?)`
  ).run(
    id,
    submissionCode,
    data.full_name,
    data.email,
    data.title,
    data.category_id,
    data.short_description,
    contentHtml,
    data.featured_image_url || null,
    data.author_bio,
    now,
    now
  );

  try {
    await adminDb.collection('submissions').doc(submissionCode).set({
      id: submissionCode,
      submissionCode,
      authorUid: req.user!.uid || req.user!.id,
      authorName: data.full_name.slice(0, 120),
      authorEmail: data.email.toLowerCase().slice(0, 180),
      title: data.title.slice(0, 220),
      categoryId: data.category_id.slice(0, 128),
      status: 'Submitted',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore submission sync skipped:', err instanceof Error ? err.message : err);
  }

  await dispatchAdminNotification({
    eventType: 'submission_received',
    actorEmail: data.email,
    actorName: data.full_name,
    subject: `New Article Submission (${submissionCode}): ${data.title}`,
    message: `${data.full_name} (${data.email}) submitted "${data.title}" under ${category.name}.\n\nSummary: ${data.short_description}\nSubmission ID: ${submissionCode}`,
    ipAddress: req.ip || '',
    skipWeb3Forms: req.headers['x-web3forms-client-dispatched'] === '1',
  });

  res.status(201).json({
    submissionId: submissionCode,
    status: 'Submitted',
    message: `Your article has been successfully submitted to THE CONTINENTAL.\n\nThank you for contributing.\n\nOur editorial team will review your submission. If selected, your article may be published after editorial approval.\n\nSubmission ID: ${submissionCode}`,
  });
});

// ==================================================
// PUBLIC MAGAZINE & E-PAPER ROUTES
// ==================================================

app.get('/api/magazines', (_req, res) => {
  runScheduledPublishingCycle();
  const rows = db
    .prepare(
      `SELECT * FROM magazines
       WHERE status IN ('published', 'upcoming', 'archived')
       ORDER BY year DESC, month ASC`
    )
    .all() as Record<string, unknown>[];

  const mapped = rows.map((m) => {
    const articles = db
      .prepare('SELECT * FROM magazine_articles WHERE magazine_id = ? ORDER BY sort_order ASC')
      .all(String(m.id));
    const canDownload = m.status === 'published' && Boolean(m.approved_by_admin) && Boolean(m.pdf_url);
    return {
      ...m,
      approved_by_admin: Boolean(m.approved_by_admin),
      pdf_url: canDownload ? m.pdf_url : null,
      articles,
    };
  });

  res.json({ magazines: mapped });
});

app.get('/api/epaper', (_req, res) => {
  runScheduledPublishingCycle();
  const rows = db
    .prepare(
      `SELECT * FROM epaper_editions
       WHERE status IN ('published', 'upcoming', 'archived')
       ORDER BY edition_date DESC`
    )
    .all() as Record<string, unknown>[];

  const editions = rows.map((e) => {
    const isAvailable =
      (e.status === 'published' || e.status === 'archived') &&
      Boolean(e.approved_by_admin) &&
      Boolean(e.pdf_url);
    return {
      ...e,
      approved_by_admin: Boolean(e.approved_by_admin),
      pdf_url: isAvailable ? e.pdf_url : null,
    };
  });

  res.json({ editions });
});

// ==================================================
// SEARCH, NEWSLETTER & CONTACT
// ==================================================

app.get('/api/search', (req, res) => {
  runScheduledPublishingCycle();
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const categorySlug = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const type = typeof req.query.type === 'string' ? req.query.type.trim() : 'all';
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = 12;

  const like = `%${q}%`;
  const results: Array<{
    resultType: 'article' | 'magazine' | 'epaper';
    id: string;
    title: string;
    subtitle: string;
    summary: string;
    url: string;
    category: string;
    date: string;
    imageUrl: string | null;
  }> = [];

  if (type === 'all' || type === 'article') {
    let sql = `${ARTICLE_SELECT} WHERE a.status = 'published' AND a.approval_status = 'approved'`;
    const params: string[] = [];
    if (q) {
      sql += ` AND (a.title LIKE ? OR a.subheadline LIKE ? OR a.summary LIKE ? OR a.content_html LIKE ? OR au.name LIKE ? OR c.name LIKE ?)`;
      params.push(like, like, like, like, like, like);
    }
    if (categorySlug) {
      sql += ` AND c.slug = ?`;
      params.push(categorySlug);
    }
    if (dateFrom) {
      sql += ` AND substr(COALESCE(a.published_at, a.created_at), 1, 10) >= ?`;
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ` AND substr(COALESCE(a.published_at, a.created_at), 1, 10) <= ?`;
      params.push(dateTo);
    }
    sql += ` ORDER BY COALESCE(a.published_at, a.created_at) DESC`;

    const artRows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    for (const row of artRows) {
      results.push({
        resultType: 'article',
        id: String(row.id),
        title: String(row.title),
        subtitle: `${row.author_name} · ${row.category_name}`,
        summary: String(row.summary || row.subheadline || ''),
        url: `/article/${row.slug}`,
        category: String(row.category_name),
        date: String(row.published_at || row.created_at),
        imageUrl: row.featured_image_url ? String(row.featured_image_url) : null,
      });
    }
  }

  if ((type === 'all' || type === 'magazine') && !categorySlug) {
    let sql = `SELECT * FROM magazines WHERE status IN ('published', 'upcoming', 'archived')`;
    const params: string[] = [];
    if (q) {
      sql += ` AND (title LIKE ? OR editors_note LIKE ? OR issue_code LIKE ?)`;
      params.push(like, like, like);
    }
    sql += ` ORDER BY year DESC, month DESC`;
    const magRows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    for (const row of magRows) {
      results.push({
        resultType: 'magazine',
        id: String(row.id),
        title: String(row.title),
        subtitle: `Monthly Magazine · ${row.issue_code}`,
        summary: String(row.editors_note || ''),
        url: `/magazine?issue=${row.issue_code}`,
        category: 'Magazine',
        date: String(row.published_at || `${row.year}-${String(row.month).padStart(2, '0')}-01`),
        imageUrl: row.cover_image_url ? String(row.cover_image_url) : null,
      });
    }
  }

  if ((type === 'all' || type === 'epaper') && !categorySlug) {
    let sql = `SELECT * FROM epaper_editions WHERE status IN ('published', 'upcoming', 'archived')`;
    const params: string[] = [];
    if (q) {
      sql += ` AND (title LIKE ? OR edition_number LIKE ? OR edition_date LIKE ?)`;
      params.push(like, like, like);
    }
    if (dateFrom) {
      sql += ` AND edition_date >= ?`;
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ` AND edition_date <= ?`;
      params.push(dateTo);
    }
    sql += ` ORDER BY edition_date DESC`;
    const epRows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    for (const row of epRows) {
      results.push({
        resultType: 'epaper',
        id: String(row.id),
        title: String(row.title),
        subtitle: `E-Paper · ${row.edition_number}`,
        summary: `Digital Newspaper Edition for ${row.edition_date}`,
        url: `/epaper`,
        category: 'E-Paper',
        date: String(row.edition_date),
        imageUrl: null,
      });
    }
  }

  const total = results.length;
  const paged = results.slice((page - 1) * limit, page * limit);

  res.json({
    results: paged,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

app.post('/api/newsletter/subscribe', rateLimit('newsletter', 15, 60 * 60 * 1000), async (req, res) => {
  const schema = z.object({
    email: z.string().trim().email('Please enter a valid email address.').max(180),
    consent: z.literal(true, { error: 'Please confirm newsletter consent.' }),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid email address.' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const existing = db.prepare('SELECT id, status FROM newsletter_subscribers WHERE email = ?').get(email) as
    | { id: string; status: string }
    | undefined;

  if (existing && existing.status === 'active') {
    res.status(409).json({ error: 'This email address is already subscribed to THE CONTINENTAL newsletter.' });
    return;
  }

  const now = new Date().toISOString();
  const subscriberId = existing ? existing.id : randomUUID();
  if (existing) {
    db.prepare(`UPDATE newsletter_subscribers SET status = 'active', consent_given = 1, fee_inr = 0, subscribed_at = ?, unsubscribed_at = NULL WHERE id = ?`).run(
      now,
      subscriberId
    );
  } else {
    db.prepare(
      `INSERT INTO newsletter_subscribers (id, email, consent_given, fee_inr, status, subscribed_at, unsubscribed_at)
       VALUES (?, ?, 1, 0, 'active', ?, NULL)`
    ).run(subscriberId, email, now);
  }

  try {
    await adminDb.collection('newsletter_subscribers').doc(subscriberId).set(
      {
        id: subscriberId,
        email,
        status: 'active',
        consentGiven: true,
        source: 'web_signup',
        subscribedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore newsletter_subscribers sync skipped:', err instanceof Error ? err.message : err);
  }

  await dispatchAdminNotification({
    eventType: 'newsletter_subscribe',
    actorEmail: email,
    actorName: email,
    subject: `New Newsletter Subscriber: ${email}`,
    message: `${email} subscribed to THE CONTINENTAL morning dispatch.`,
    ipAddress: req.ip || '',
    skipWeb3Forms: req.headers['x-web3forms-client-dispatched'] === '1',
  });

  res.status(201).json({
    message: 'You are subscribed to THE CONTINENTAL morning dispatch.',
  });
});

app.post('/api/newsletter/unsubscribe', rateLimit('newsletter-unsub', 20, 60 * 60 * 1000), async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) {
    res.status(400).json({ error: 'Email address is required.' });
    return;
  }
  const existing = db.prepare('SELECT id FROM newsletter_subscribers WHERE email = ?').get(email) as { id: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'No subscription found for that email address.' });
    return;
  }
  db.prepare(`UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    existing.id
  );
  try {
    await adminDb.collection('newsletter_subscribers').doc(existing.id).set(
      {
        status: 'unsubscribed',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore newsletter_subscribers unsubscribe sync skipped:', err instanceof Error ? err.message : err);
  }
  res.json({ message: 'You have been unsubscribed from THE CONTINENTAL newsletter.' });
});

app.post('/api/contact', rateLimit('contact', 10, 60 * 60 * 1000), async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2, 'Name is required.').max(120),
    email: z.string().trim().email('Valid email address is required.').max(180),
    subject: z.string().trim().min(3, 'Subject is required.').max(200),
    message: z.string().trim().min(10, 'Message must be at least 10 characters.').max(4000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid contact form data.' });
    return;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO contact_messages (id, name, email, subject, message, status, admin_notes, created_at)
     VALUES (?, ?, ?, ?, ?, 'new', '', ?)`
  ).run(id, parsed.data.name, parsed.data.email, parsed.data.subject, parsed.data.message, new Date().toISOString());

  await dispatchAdminNotification({
    eventType: 'contact_message',
    actorEmail: parsed.data.email,
    actorName: parsed.data.name,
    subject: `Contact Desk Message: ${parsed.data.subject}`,
    message: `${parsed.data.name} (${parsed.data.email}) sent a contact message:\n\n${parsed.data.message}`,
    ipAddress: req.ip || '',
    skipWeb3Forms: req.headers['x-web3forms-client-dispatched'] === '1',
  });

  res.status(201).json({ id, message: 'Thank you. Your message has been received by THE CONTINENTAL desk.' });
});

// ==================================================
// AUTHENTICATION (READERS + ADMIN thecontinental.dhpc@gmail.com)
// ==================================================

app.get('/api/auth/status', (req, res) => {
  const adminCount = (
    db.prepare("SELECT COUNT(*) as c FROM profiles WHERE role = 'super_admin' AND LOWER(email) = ?").get(ADMIN_EMAIL) as { c: number }
  ).c;
  const payload = verifySessionToken(extractSessionToken(req));
  let user: {
    id: string;
    uid?: string | null;
    email: string;
    phoneNumber?: string | null;
    fullName: string;
    role: 'super_admin' | 'reader';
    photoUrl?: string | null;
  } | null = null;

  if (payload) {
    const row = db
      .prepare('SELECT id, firebase_uid, email, phone_number, full_name, role, photo_url FROM profiles WHERE id = ?')
      .get(payload.userId) as
      | {
          id: string;
          firebase_uid: string | null;
          email: string | null;
          phone_number: string | null;
          full_name: string;
          role: 'super_admin' | 'reader';
          photo_url: string | null;
        }
      | undefined;
    if (row) {
      const email = row.email || '';
      const effectiveRole = row.role === 'super_admin' && isAdminEmail(email) ? 'super_admin' : 'reader';
      user = {
        id: row.id,
        uid: row.firebase_uid,
        email,
        phoneNumber: row.phone_number || null,
        fullName: row.full_name,
        role: effectiveRole,
        photoUrl: row.photo_url,
      };
    }
  }

  res.json({
    needsSetup: adminCount === 0,
    authenticated: Boolean(user),
    user,
    admin: user && user.role === 'super_admin' ? user : null,
  });
});

app.post('/api/auth/register', rateLimit('auth-register', 20, 60 * 60 * 1000), async (req, res) => {
  const schema = z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(120),
    email: z.string().trim().email('Please provide a valid email address.').max(180),
    password: z.string().min(6, 'Password must be at least 6 characters.').max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration fields.' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  if (isAdminEmail(email)) {
    res.status(403).json({ error: 'This email is reserved for the Administrator account. Please sign in instead.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM profiles WHERE LOWER(email) = ?').get(email) as { id: string } | undefined;
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    return;
  }

  const userId = randomUUID();
  const now = new Date().toISOString();
  const pwHash = hashPassword(parsed.data.password);

  db.prepare(
    `INSERT INTO profiles (id, email, full_name, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'reader', ?, ?)`
  ).run(userId, email, parsed.data.fullName, pwHash, now, now);

  try {
    await adminDb.collection('users').doc(userId).set({
      uid: userId,
      displayName: parsed.data.fullName.slice(0, 120),
      role: 'reader',
      lastLoginAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await adminDb.collection('users').doc(userId).collection('private').doc('info').set({
      uid: userId,
      email: email.slice(0, 180),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore user registration sync skipped:', err instanceof Error ? err.message : err);
  }

  logAudit(email, 'USER_REGISTER', 'profile', userId, `${parsed.data.fullName} (${email}) registered as contributor`, req.ip || '');

  await dispatchAdminNotification({
    eventType: 'user_registered',
    actorEmail: email,
    actorName: parsed.data.fullName,
    subject: `New User Registration: ${parsed.data.fullName} (${email})`,
    message: `${parsed.data.fullName} (${email}) registered as a new reader & contributor on THE CONTINENTAL.`,
    ipAddress: req.ip || '',
    skipWeb3Forms: req.headers['x-web3forms-client-dispatched'] === '1',
  });

  const token = signSessionToken({ userId, email, role: 'reader' });
  res.setHeader('Set-Cookie', buildSessionCookieHeader(req, token));

  const user = { id: userId, uid: null, email, fullName: parsed.data.fullName, role: 'reader' as const, photoUrl: null };
  res.status(201).json({ user, admin: null, sessionToken: token });
});

app.post('/api/auth/firebase', rateLimit('auth-firebase', 30, 15 * 60 * 1000), async (req, res) => {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
  const requestedDisplayName =
    typeof req.body?.displayName === 'string' ? req.body.displayName.trim().slice(0, 120) : '';
  if (!idToken) {
    res.status(400).json({ error: 'Firebase ID token is required.' });
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = (decoded.email || '').trim().toLowerCase();
    const phoneNumber = (decoded.phone_number || '').trim();
    if (!email && !phoneNumber) {
      res.status(400).json({ error: 'Verified email address or phone number is required.' });
      return;
    }

    const emailVerified = Boolean(decoded.email_verified);
    const role = email ? resolveRoleForEmail(email, emailVerified) : 'reader';
    const fallbackName = email ? email.split('@')[0] : phoneNumber || 'Reader';
    const fullName = String(requestedDisplayName || decoded.name || fallbackName).slice(0, 120);
    const photoUrl = decoded.picture ? String(decoded.picture) : null;
    const now = new Date().toISOString();

    let existing = db
      .prepare('SELECT id, email, phone_number, full_name FROM profiles WHERE firebase_uid = ?')
      .get(decoded.uid) as { id: string; email: string | null; phone_number: string | null; full_name: string } | undefined;

    if (!existing && email) {
      existing = db
        .prepare('SELECT id, email, phone_number, full_name FROM profiles WHERE LOWER(email) = ?')
        .get(email) as { id: string; email: string | null; phone_number: string | null; full_name: string } | undefined;
    }
    if (!existing && phoneNumber) {
      existing = db
        .prepare('SELECT id, email, phone_number, full_name FROM profiles WHERE phone_number = ?')
        .get(phoneNumber) as { id: string; email: string | null; phone_number: string | null; full_name: string } | undefined;
    }

    let userId: string;
    const isNewRegistration = !existing;
    const finalEmail = email || existing?.email || '';
    const finalPhone = phoneNumber || existing?.phone_number || null;
    const finalName = fullName || existing?.full_name || 'Reader';

    if (existing) {
      userId = existing.id;
      db.prepare(
        `UPDATE profiles SET email = ?, phone_number = ?, full_name = ?, role = ?, firebase_uid = ?, photo_url = ?, updated_at = ? WHERE id = ?`
      ).run(finalEmail || null, finalPhone, finalName, role, decoded.uid, photoUrl, now, userId);
    } else {
      userId = randomUUID();
      db.prepare(
        `INSERT INTO profiles (id, email, phone_number, full_name, password_hash, role, firebase_uid, photo_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?)`
      ).run(userId, finalEmail || null, finalPhone, finalName, role, decoded.uid, photoUrl, now, now);
    }

    const actorContact = finalEmail || finalPhone || decoded.uid;
    const authMethodLabel = phoneNumber && !email ? 'Phone Number' : 'Google';

    logAudit(
      actorContact,
      isNewRegistration ? 'USER_REGISTER' : role === 'super_admin' ? 'ADMIN_LOGIN' : 'USER_LOGIN',
      'profile',
      userId,
      `${finalName} (${actorContact}) signed in via ${authMethodLabel} (${role})`,
      req.ip || ''
    );

    await dispatchAdminNotification({
      eventType: isNewRegistration ? 'user_registered' : 'user_login',
      actorEmail: actorContact,
      actorName: finalName,
      subject: isNewRegistration
        ? `New User Registration: ${finalName} (${actorContact})`
        : `Reader Login Alert: ${finalName} (${actorContact})`,
      message: `${finalName} (${actorContact}) ${isNewRegistration ? 'registered and signed into' : 'signed into'} THE CONTINENTAL via ${authMethodLabel} as ${role === 'super_admin' ? 'Administrator' : 'Reader / Contributor'}.`,
      ipAddress: req.ip || '',
      skipWeb3Forms: req.headers['x-web3forms-client-dispatched'] === '1',
    });

    const token = signSessionToken({ userId, email: finalEmail, phoneNumber: finalPhone, role });
    res.setHeader('Set-Cookie', buildSessionCookieHeader(req, token));

    const user = { id: userId, uid: decoded.uid, email: finalEmail, phoneNumber: finalPhone, fullName: finalName, role, photoUrl };
    res.json({ user, admin: role === 'super_admin' ? user : null, sessionToken: token });
  } catch (err) {
    console.error('Firebase token verification error:', err);
    res.status(401).json({ error: 'Unable to verify authentication session. Please try again.' });
  }
});

app.post('/api/auth/setup', rateLimit('auth-setup', 10, 60 * 60 * 1000), async (req, res) => {
  const existingCount = (
    db.prepare("SELECT COUNT(*) as c FROM profiles WHERE role = 'super_admin' AND LOWER(email) = ?").get(ADMIN_EMAIL) as { c: number }
  ).c;
  if (existingCount > 0) {
    res.status(403).json({ error: 'Administrator account already exists. Please sign in.' });
    return;
  }

  const schema = z.object({
    fullName: z.string().trim().min(2, 'Full name is required.').max(120),
    email: z.string().trim().email('Valid email is required.').max(180),
    password: z.string().min(10, 'Password must be at least 10 characters.').max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid setup fields.' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  if (!isAdminEmail(email)) {
    res.status(403).json({ error: `Administrator account must use ${ADMIN_EMAIL}.` });
    return;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const pwHash = hashPassword(parsed.data.password);

  const existingProfile = db.prepare('SELECT id FROM profiles WHERE LOWER(email) = ?').get(email) as { id: string } | undefined;
  const userId = existingProfile ? existingProfile.id : id;
  if (existingProfile) {
    db.prepare(`UPDATE profiles SET full_name = ?, password_hash = ?, role = 'super_admin', updated_at = ? WHERE id = ?`).run(
      parsed.data.fullName,
      pwHash,
      now,
      userId
    );
  } else {
    db.prepare(
      `INSERT INTO profiles (id, email, full_name, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'super_admin', ?, ?)`
    ).run(userId, email, parsed.data.fullName, pwHash, now, now);
  }

  logAudit(email, 'INITIAL_ADMIN_SETUP', 'profile', userId, 'Configured Administrator account', req.ip || '');

  await dispatchAdminNotification({
    eventType: 'user_login',
    actorEmail: email,
    actorName: parsed.data.fullName,
    subject: `Admin Login Alert: ${email}`,
    message: `${parsed.data.fullName} (${email}) configured and signed in as Administrator.`,
    ipAddress: req.ip || '',
    skipWeb3Forms: req.headers['x-web3forms-client-dispatched'] === '1',
  });

  const token = signSessionToken({ userId, email, role: 'super_admin' });
  res.setHeader('Set-Cookie', buildSessionCookieHeader(req, token));
  const user = { id: userId, email, fullName: parsed.data.fullName, role: 'super_admin' as const };
  res.status(201).json({ user, admin: user, sessionToken: token });
});

app.post('/api/auth/login', rateLimit('auth-login', 20, 15 * 60 * 1000), async (req, res) => {
  const schema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const row = db
    .prepare('SELECT id, firebase_uid, email, full_name, password_hash, role, photo_url FROM profiles WHERE LOWER(email) = ?')
    .get(email) as
    | {
        id: string;
        firebase_uid: string | null;
        email: string;
        full_name: string;
        password_hash: string;
        role: 'super_admin' | 'reader';
        photo_url: string | null;
      }
    | undefined;

  if (!row || !row.password_hash || !verifyPassword(parsed.data.password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials. Verify your email and password or sign in with Google.' });
    return;
  }

  const role = resolveRoleForEmail(row.email, true);
  logAudit(row.email, role === 'super_admin' ? 'ADMIN_LOGIN' : 'USER_LOGIN', 'profile', row.id, `${row.email} signed in`, req.ip || '');

  await dispatchAdminNotification({
    eventType: 'user_login',
    actorEmail: row.email,
    actorName: row.full_name,
    subject: `Login Alert: ${row.full_name} (${row.email})`,
    message: `${row.full_name} (${row.email}) signed into THE CONTINENTAL.`,
    ipAddress: req.ip || '',
    skipWeb3Forms: req.headers['x-web3forms-client-dispatched'] === '1',
  });

  const token = signSessionToken({ userId: row.id, email: row.email, role });
  res.setHeader('Set-Cookie', buildSessionCookieHeader(req, token));
  const user = { id: row.id, uid: row.firebase_uid, email: row.email, fullName: row.full_name, role, photoUrl: row.photo_url };
  res.json({ user, admin: role === 'super_admin' ? user : null, sessionToken: token });
});

app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
  const payload = verifySessionToken(extractSessionToken(req));
  if (payload) {
    logAudit(payload.email, 'USER_LOGOUT', 'profile', payload.userId, `${payload.email} signed out`, req.ip || '');
  }
  res.setHeader('Set-Cookie', buildSessionCookieHeader(req, '', 0));
  res.json({ ok: true });
});

app.post('/api/auth/change-password', requireAdmin, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(10, 'New password must be at least 10 characters.').max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid password input.' });
    return;
  }

  const row = db
    .prepare('SELECT password_hash FROM profiles WHERE id = ?')
    .get(req.admin!.id) as { password_hash: string } | undefined;

  if (!row || !verifyPassword(parsed.data.currentPassword, row.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  const nextHash = hashPassword(parsed.data.newPassword);
  db.prepare('UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    nextHash,
    new Date().toISOString(),
    req.admin!.id
  );
  logAudit(req.admin!.email, 'CHANGE_PASSWORD', 'profile', req.admin!.id, 'Updated administrator password', req.ip || '');
  res.json({ message: 'Password updated securely.' });
});

// ==================================================
// ADMIN DASHBOARD APIS (PROTECTED)
// ==================================================

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  runScheduledPublishingCycle();
  const totalArticles = (db.prepare('SELECT COUNT(*) as c FROM articles').get() as { c: number }).c;
  const publishedArticles = (db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'published'").get() as { c: number }).c;
  const draftArticles = (db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'draft'").get() as { c: number }).c;
  const scheduledArticles = (db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'scheduled'").get() as { c: number }).c;
  const pendingSubmissions = (
    db.prepare("SELECT COUNT(*) as c FROM submissions WHERE status IN ('Submitted', 'Under Review', 'Revision Requested')").get() as { c: number }
  ).c;
  const approvedSubmissions = (
    db.prepare("SELECT COUNT(*) as c FROM submissions WHERE status IN ('Approved', 'Published')").get() as { c: number }
  ).c;
  const magazineIssues = (db.prepare('SELECT COUNT(*) as c FROM magazines').get() as { c: number }).c;
  const epaperEditions = (db.prepare('SELECT COUNT(*) as c FROM epaper_editions').get() as { c: number }).c;
  const subscribers = (
    db.prepare("SELECT COUNT(*) as c FROM newsletter_subscribers WHERE status = 'active'").get() as { c: number }
  ).c;
  const unreadMessages = (
    db.prepare("SELECT COUNT(*) as c FROM contact_messages WHERE status = 'new'").get() as { c: number }
  ).c;
  const unreadNotifications = (
    db.prepare('SELECT COUNT(*) as c FROM admin_notifications WHERE is_read = 0').get() as { c: number }
  ).c;
  const recentActivity = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 12').all();

  res.json({
    counts: {
      totalArticles,
      publishedArticles,
      draftArticles,
      scheduledArticles,
      pendingSubmissions,
      approvedSubmissions,
      magazineIssues,
      epaperEditions,
      subscribers,
      unreadMessages,
      unreadNotifications,
    },
    recentActivity,
  });
});

// Articles CRUD
app.get('/api/admin/articles', requireAdmin, (_req, res) => {
  runScheduledPublishingCycle();
  const rows = db
    .prepare(`${ARTICLE_SELECT} ORDER BY a.created_at DESC`)
    .all() as Record<string, unknown>[];
  res.json({ articles: rows.map(mapArticleRow) });
});

app.post('/api/admin/articles', requireAdmin, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    title: z.string().trim().min(4).max(240),
    subheadline: z.string().trim().max(500).default(''),
    slug: z.string().trim().max(120).optional(),
    summary: z.string().trim().max(1000).default(''),
    content_html: z.string().trim().min(10),
    featured_image_url: z.string().trim().nullable().optional(),
    image_caption: z.string().trim().max(300).default(''),
    image_credit: z.string().trim().max(200).default(''),
    author_id: z.string().trim().min(1),
    category_id: z.string().trim().min(1),
    tags: z.array(z.string()).default([]),
    seo_title: z.string().trim().max(240).default(''),
    seo_description: z.string().trim().max(500).default(''),
    status: z.enum(['draft', 'scheduled', 'published', 'archived']).default('draft'),
    approval_status: z.enum(['pending', 'approved']).default('approved'),
    is_featured: z.boolean().default(false),
    featured_slot: z.enum(['lead', 'top_story', 'section_feature']).nullable().optional(),
    is_breaking: z.boolean().default(false),
    scheduled_at: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid article payload.' });
    return;
  }

  const d = parsed.data;
  const id = randomUUID();
  const now = new Date().toISOString();
  let slug = generateSlug(d.slug || d.title);
  const dup = db.prepare('SELECT id FROM articles WHERE slug = ?').get(slug);
  if (dup) slug = `${slug}-${id.slice(0, 5)}`;

  if (d.featured_slot === 'lead') {
    db.prepare(`UPDATE articles SET featured_slot = 'top_story' WHERE featured_slot = 'lead'`).run();
  }

  const publishedAt = d.status === 'published' ? now : null;
  const cleanHtml = sanitizeEditorialHtml(d.content_html);

  db.prepare(
    `INSERT INTO articles (
      id, title, subheadline, slug, summary, content_html, featured_image_url,
      image_caption, image_credit, author_id, category_id, tags_json,
      seo_title, seo_description, status, approval_status, is_featured,
      featured_slot, is_breaking, scheduled_at, published_at, updated_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    d.title,
    d.subheadline,
    slug,
    d.summary,
    cleanHtml,
    d.featured_image_url || null,
    d.image_caption,
    d.image_credit,
    d.author_id,
    d.category_id,
    JSON.stringify(d.tags),
    d.seo_title || `${d.title} | THE CONTINENTAL`,
    d.seo_description || d.summary,
    d.status,
    d.approval_status,
    d.is_featured ? 1 : 0,
    d.featured_slot || null,
    d.is_breaking ? 1 : 0,
    d.scheduled_at || null,
    publishedAt,
    now,
    now
  );

  if (d.status === 'published' && d.approval_status === 'approved') {
    bumpEditionLastUpdatedAt(now);
  }
  logAudit(req.admin!.email, 'CREATE_ARTICLE', 'article', id, `Created article (${d.status}): ${d.title}`, req.ip || '');
  const created = db.prepare(`${ARTICLE_SELECT} WHERE a.id = ?`).get(id) as Record<string, unknown>;
  res.status(201).json({ article: mapArticleRow(created), editionUpdatedAt: getEditionLastUpdatedAt() });
});

app.put('/api/admin/articles/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }

  const d = req.body;
  const now = new Date().toISOString();
  const nextStatus = d.status ?? existing.status;
  const nextApproval = d.approval_status ?? existing.approval_status;
  const nextFeaturedSlot = d.featured_slot !== undefined ? d.featured_slot : existing.featured_slot;

  if (nextFeaturedSlot === 'lead') {
    db.prepare(`UPDATE articles SET featured_slot = 'top_story' WHERE featured_slot = 'lead' AND id != ?`).run(req.params.id);
  }

  const publishedAt =
    nextStatus === 'published' ? existing.published_at || now : existing.published_at;

  const cleanHtml = d.content_html !== undefined ? sanitizeEditorialHtml(String(d.content_html)) : String(existing.content_html);

  db.prepare(
    `UPDATE articles SET
      title = ?, subheadline = ?, slug = ?, summary = ?, content_html = ?,
      featured_image_url = ?, image_caption = ?, image_credit = ?, author_id = ?,
      category_id = ?, tags_json = ?, seo_title = ?, seo_description = ?,
      status = ?, approval_status = ?, is_featured = ?, featured_slot = ?,
      is_breaking = ?, scheduled_at = ?, published_at = ?, updated_at = ?
    WHERE id = ?`
  ).run(
    String(d.title ?? existing.title),
    String(d.subheadline ?? existing.subheadline),
    d.slug ? generateSlug(String(d.slug)) : String(existing.slug),
    String(d.summary ?? existing.summary),
    cleanHtml,
    d.featured_image_url !== undefined ? (d.featured_image_url ? String(d.featured_image_url) : null) : (existing.featured_image_url ? String(existing.featured_image_url) : null),
    String(d.image_caption ?? existing.image_caption),
    String(d.image_credit ?? existing.image_credit),
    String(d.author_id ?? existing.author_id),
    String(d.category_id ?? existing.category_id),
    d.tags ? JSON.stringify(d.tags) : String(existing.tags_json),
    String(d.seo_title ?? existing.seo_title),
    String(d.seo_description ?? existing.seo_description),
    String(nextStatus),
    String(nextApproval),
    d.is_featured !== undefined ? (d.is_featured ? 1 : 0) : Number(existing.is_featured || 0),
    nextFeaturedSlot ? String(nextFeaturedSlot) : null,
    d.is_breaking !== undefined ? (d.is_breaking ? 1 : 0) : Number(existing.is_breaking || 0),
    d.scheduled_at !== undefined ? (d.scheduled_at ? String(d.scheduled_at) : null) : (existing.scheduled_at ? String(existing.scheduled_at) : null),
    publishedAt ? String(publishedAt) : null,
    now,
    req.params.id
  );

  if (nextStatus === 'published' || existing.status === 'published') {
    bumpEditionLastUpdatedAt(now);
  }

  logAudit(
    req.admin!.email,
    'UPDATE_ARTICLE',
    'article',
    req.params.id,
    `Updated article (${nextStatus}): ${d.title ?? existing.title}`,
    req.ip || ''
  );

  const updated = db.prepare(`${ARTICLE_SELECT} WHERE a.id = ?`).get(req.params.id) as Record<string, unknown>;
  res.json({ article: mapArticleRow(updated), editionUpdatedAt: getEditionLastUpdatedAt() });
});

app.post('/api/admin/sync-live-news', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await runLiveNewsSync({
      maxNewPerCycle: 14,
      triggeredBy: req.admin!.email,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Live news sync failed.' });
  }
});

app.delete('/api/admin/articles/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const existing = db.prepare('SELECT title, status FROM articles WHERE id = ?').get(req.params.id) as { title: string; status: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  if (existing.status === 'published') {
    bumpEditionLastUpdatedAt(new Date().toISOString());
  }
  logAudit(req.admin!.email, 'DELETE_ARTICLE', 'article', req.params.id, `Deleted article: ${existing.title}`, req.ip || '');
  res.json({ ok: true, editionUpdatedAt: getEditionLastUpdatedAt() });
});

// Submissions review
app.get('/api/admin/submissions', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, c.name as category_name
       FROM submissions s
       JOIN categories c ON c.id = s.category_id
       ORDER BY s.created_at DESC`
    )
    .all();
  res.json({ submissions: rows });
});

app.patch('/api/admin/submissions/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const existing = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }
  const status = String(req.body.status ?? existing.status);
  const internalNotes = String(req.body.internal_notes ?? existing.internal_notes);
  const title = String(req.body.title ?? existing.title);
  const shortDesc = String(req.body.short_description ?? existing.short_description);
  const contentHtml =
    req.body.content_html !== undefined ? sanitizeEditorialHtml(String(req.body.content_html)) : String(existing.content_html);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE submissions SET status = ?, internal_notes = ?, title = ?, short_description = ?, content_html = ?, updated_at = ? WHERE id = ?`
  ).run(status, internalNotes, title, shortDesc, contentHtml, now, req.params.id);

  logAudit(
    req.admin!.email,
    'REVIEW_SUBMISSION',
    'submission',
    req.params.id,
    `Updated submission ${existing.submission_code} to status "${status}"`,
    req.ip || ''
  );

  const updated = db
    .prepare(`SELECT s.*, c.name as category_name FROM submissions s JOIN categories c ON c.id = s.category_id WHERE s.id = ?`)
    .get(req.params.id);
  res.json({ submission: updated });
});

app.post('/api/admin/submissions/:id/publish', requireAdmin, (req: AuthenticatedRequest, res) => {
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!sub) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }

  const now = new Date().toISOString();
  const contributorEmail = String(sub.email).toLowerCase();
  let author = db.prepare('SELECT id FROM authors WHERE LOWER(email) = ?').get(contributorEmail) as { id: string } | undefined;
  if (!author) {
    const authorId = randomUUID();
    const authorSlug = `${generateSlug(String(sub.full_name))}-${authorId.slice(0, 4)}`;
    db.prepare(
      `INSERT INTO authors (id, name, slug, role_title, bio, avatar_url, email, created_at)
       VALUES (?, ?, ?, 'Independent Contributor', ?, NULL, ?, ?)`
    ).run(authorId, String(sub.full_name), authorSlug, String(sub.author_bio), contributorEmail, now);
    author = { id: authorId };
  }

  const articleId = randomUUID();
  const slug = `${generateSlug(String(sub.title))}-${articleId.slice(0, 5)}`;

  db.prepare(
    `INSERT INTO articles (
      id, title, subheadline, slug, summary, content_html, featured_image_url,
      image_caption, image_credit, author_id, category_id, tags_json,
      seo_title, seo_description, status, approval_status, is_featured,
      featured_slot, is_breaking, scheduled_at, published_at, updated_at, created_at
    ) VALUES (?, ?, '', ?, ?, ?, ?, '', ?, ?, ?, '["Contributor"]', ?, ?, 'published', 'approved', 0, NULL, 0, NULL, ?, ?, ?)`
  ).run(
    articleId,
    String(sub.title),
    slug,
    String(sub.short_description),
    sanitizeEditorialHtml(String(sub.content_html)),
    sub.featured_image_url ? String(sub.featured_image_url) : null,
    String(sub.full_name),
    author.id,
    String(sub.category_id),
    `${sub.title} | THE CONTINENTAL`,
    String(sub.short_description),
    now,
    now,
    now
  );

  db.prepare(`UPDATE submissions SET status = 'Published', published_article_id = ?, updated_at = ? WHERE id = ?`).run(
    articleId,
    now,
    req.params.id
  );

  bumpEditionLastUpdatedAt(now);

  logAudit(
    req.admin!.email,
    'PUBLISH_SUBMISSION',
    'submission',
    req.params.id,
    `Approved & published submission ${sub.submission_code} as article ${slug}`,
    req.ip || ''
  );

  res.status(201).json({ articleId, slug, editionUpdatedAt: getEditionLastUpdatedAt() });
});

// Magazines CRUD
app.get('/api/admin/magazines', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM magazines ORDER BY year DESC, month ASC').all() as Record<string, unknown>[];
  const magazines = rows.map((m) => ({
    ...m,
    approved_by_admin: Boolean(m.approved_by_admin),
    articles: db.prepare('SELECT * FROM magazine_articles WHERE magazine_id = ? ORDER BY sort_order ASC').all(String(m.id)),
  }));
  res.json({ magazines });
});

app.post('/api/admin/magazines', requireAdmin, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    title: z.string().trim().min(3).max(220),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2026).max(2040),
    cover_image_url: z.string().trim().nullable().optional(),
    editors_note: z.string().trim().default(''),
    pdf_url: z.string().trim().nullable().optional(),
    status: z.enum(['upcoming', 'draft', 'scheduled', 'published', 'archived']).default('draft'),
    approved_by_admin: z.boolean().default(false),
    scheduled_at: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid magazine issue payload.' });
    return;
  }
  const d = parsed.data;
  if (d.status === 'published' && !canPublishEdition(d.pdf_url, d.approved_by_admin)) {
    res.status(400).json({ error: 'Magazine issue cannot be published without an uploaded PDF and explicit admin approval.' });
    return;
  }

  const id = randomUUID();
  const issueCode = `TC-MAG-${d.year}-${String(d.month).padStart(2, '0')}`;
  const now = new Date().toISOString();

  try {
    db.prepare(
      `INSERT INTO magazines (id, issue_code, title, month, year, cover_image_url, editors_note, pdf_url, status, approved_by_admin, scheduled_at, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      issueCode,
      d.title,
      d.month,
      d.year,
      d.cover_image_url || null,
      d.editors_note,
      d.pdf_url || null,
      d.status,
      d.approved_by_admin ? 1 : 0,
      d.scheduled_at || null,
      d.status === 'published' ? now : null,
      now
    );
  } catch (err) {
    res.status(409).json({ error: `A magazine edition for ${d.month}/${d.year} already exists.` });
    return;
  }

  logAudit(req.admin!.email, 'CREATE_MAGAZINE', 'magazine', id, `Created magazine issue ${issueCode}`, req.ip || '');
  res.status(201).json({ id, issue_code: issueCode });
});

app.put('/api/admin/magazines/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const existing = db.prepare('SELECT * FROM magazines WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Magazine issue not found.' });
    return;
  }
  const d = req.body;
  const nextStatus = d.status ?? existing.status;
  const nextPdf = d.pdf_url !== undefined ? d.pdf_url : existing.pdf_url;
  const nextApproved = d.approved_by_admin !== undefined ? Boolean(d.approved_by_admin) : Boolean(existing.approved_by_admin);

  if (nextStatus === 'published' && !canPublishEdition(nextPdf ? String(nextPdf) : null, nextApproved)) {
    res.status(400).json({ error: 'Upload the final PDF and check Admin Approval before publishing this magazine issue.' });
    return;
  }

  db.prepare(
    `UPDATE magazines SET title = ?, cover_image_url = ?, editors_note = ?, pdf_url = ?, status = ?, approved_by_admin = ?, scheduled_at = ?, published_at = ? WHERE id = ?`
  ).run(
    String(d.title ?? existing.title),
    d.cover_image_url !== undefined ? (d.cover_image_url ? String(d.cover_image_url) : null) : (existing.cover_image_url ? String(existing.cover_image_url) : null),
    String(d.editors_note ?? existing.editors_note),
    nextPdf ? String(nextPdf) : null,
    String(nextStatus),
    nextApproved ? 1 : 0,
    d.scheduled_at !== undefined ? (d.scheduled_at ? String(d.scheduled_at) : null) : (existing.scheduled_at ? String(existing.scheduled_at) : null),
    nextStatus === 'published' ? String(existing.published_at || new Date().toISOString()) : (existing.published_at ? String(existing.published_at) : null),
    req.params.id
  );

  logAudit(req.admin!.email, 'UPDATE_MAGAZINE', 'magazine', req.params.id, `Updated magazine ${existing.issue_code} (${nextStatus})`, req.ip || '');
  res.json({ ok: true });
});

app.post('/api/admin/magazines/:id/articles', requireAdmin, (req: AuthenticatedRequest, res) => {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO magazine_articles (id, magazine_id, title, author_name, category_name, summary, content_html, sort_order, is_featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.params.id,
    String(req.body.title || 'Untitled Essay'),
    String(req.body.author_name || 'Staff Contributor'),
    String(req.body.category_name || 'World Affairs'),
    String(req.body.summary || ''),
    sanitizeEditorialHtml(String(req.body.content_html || `<p>${req.body.summary || ''}</p>`)),
    Number(req.body.sort_order || 1),
    req.body.is_featured ? 1 : 0
  );
  logAudit(req.admin!.email, 'ADD_MAGAZINE_ARTICLE', 'magazine_article', id, `Added essay to magazine ${req.params.id}`, req.ip || '');
  res.status(201).json({ id });
});

app.delete('/api/admin/magazines/:id/articles/:articleId', requireAdmin, (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM magazine_articles WHERE id = ? AND magazine_id = ?').run(req.params.articleId, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/magazines/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM magazines WHERE id = ?').run(req.params.id);
  logAudit(req.admin!.email, 'DELETE_MAGAZINE', 'magazine', req.params.id, 'Deleted magazine issue', req.ip || '');
  res.json({ ok: true });
});

// E-Paper CRUD
app.get('/api/admin/epaper', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM epaper_editions ORDER BY edition_date DESC').all() as Record<string, unknown>[];
  res.json({ editions: rows.map((e) => ({ ...e, approved_by_admin: Boolean(e.approved_by_admin) })) });
});

app.post('/api/admin/epaper', requireAdmin, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    edition_number: z.string().trim().min(2).max(60),
    edition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Edition date must be YYYY-MM-DD.'),
    title: z.string().trim().min(4).max(240),
    pdf_url: z.string().trim().nullable().optional(),
    status: z.enum(['upcoming', 'draft', 'scheduled', 'published', 'archived']).default('draft'),
    approved_by_admin: z.boolean().default(false),
    scheduled_at: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid E-Paper edition payload.' });
    return;
  }
  const d = parsed.data;
  if (d.status === 'published' && !canPublishEdition(d.pdf_url, d.approved_by_admin)) {
    res.status(400).json({ error: 'E-Paper edition cannot be published until the final PDF is uploaded and approved.' });
    return;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO epaper_editions (id, edition_number, edition_date, title, pdf_url, status, approved_by_admin, scheduled_at, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      d.edition_number,
      d.edition_date,
      d.title,
      d.pdf_url || null,
      d.status,
      d.approved_by_admin ? 1 : 0,
      d.scheduled_at || null,
      d.status === 'published' ? now : null,
      now
    );
  } catch {
    res.status(409).json({ error: 'An edition with that edition number or date already exists.' });
    return;
  }

  logAudit(req.admin!.email, 'CREATE_EPAPER', 'epaper', id, `Created E-Paper ${d.edition_number} (${d.edition_date})`, req.ip || '');
  res.status(201).json({ id });
});

app.put('/api/admin/epaper/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const existing = db.prepare('SELECT * FROM epaper_editions WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'E-Paper edition not found.' });
    return;
  }
  const d = req.body;
  const nextStatus = d.status ?? existing.status;
  const nextPdf = d.pdf_url !== undefined ? d.pdf_url : existing.pdf_url;
  const nextApproved = d.approved_by_admin !== undefined ? Boolean(d.approved_by_admin) : Boolean(existing.approved_by_admin);

  if (nextStatus === 'published' && !canPublishEdition(nextPdf ? String(nextPdf) : null, nextApproved)) {
    res.status(400).json({ error: 'Upload the newspaper PDF and check Admin Approval before publishing.' });
    return;
  }

  db.prepare(
    `UPDATE epaper_editions SET edition_number = ?, edition_date = ?, title = ?, pdf_url = ?, status = ?, approved_by_admin = ?, scheduled_at = ?, published_at = ? WHERE id = ?`
  ).run(
    String(d.edition_number ?? existing.edition_number),
    String(d.edition_date ?? existing.edition_date),
    String(d.title ?? existing.title),
    nextPdf ? String(nextPdf) : null,
    String(nextStatus),
    nextApproved ? 1 : 0,
    d.scheduled_at !== undefined ? (d.scheduled_at ? String(d.scheduled_at) : null) : (existing.scheduled_at ? String(existing.scheduled_at) : null),
    nextStatus === 'published' ? String(existing.published_at || new Date().toISOString()) : (existing.published_at ? String(existing.published_at) : null),
    req.params.id
  );

  logAudit(req.admin!.email, 'UPDATE_EPAPER', 'epaper', req.params.id, `Updated E-Paper ${existing.edition_number} (${nextStatus})`, req.ip || '');
  res.json({ ok: true });
});

app.delete('/api/admin/epaper/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM epaper_editions WHERE id = ?').run(req.params.id);
  logAudit(req.admin!.email, 'DELETE_EPAPER', 'epaper', req.params.id, 'Deleted E-Paper edition', req.ip || '');
  res.json({ ok: true });
});

// Categories & Authors
app.get('/api/admin/categories', requireAdmin, (_req, res) => {
  res.json({ categories: db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all() });
});

app.post('/api/admin/categories', requireAdmin, (req: AuthenticatedRequest, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }
  const id = randomUUID();
  const slug = generateSlug(String(req.body.slug || name));
  db.prepare(
    `INSERT INTO categories (id, name, slug, description, sort_order, show_in_nav, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`
  ).run(id, name, slug, String(req.body.description || ''), Number(req.body.sort_order || 99), new Date().toISOString());
  logAudit(req.admin!.email, 'CREATE_CATEGORY', 'category', id, `Created category: ${name}`, req.ip || '');
  res.status(201).json({ id, name, slug });
});

app.delete('/api/admin/categories/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const used = (db.prepare('SELECT COUNT(*) as c FROM articles WHERE category_id = ?').get(req.params.id) as { c: number }).c;
  if (used > 0) {
    res.status(400).json({ error: 'Cannot delete a category that still contains articles.' });
    return;
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  logAudit(req.admin!.email, 'DELETE_CATEGORY', 'category', req.params.id, 'Deleted category', req.ip || '');
  res.json({ ok: true });
});

app.get('/api/admin/authors', requireAdmin, (_req, res) => {
  res.json({ authors: db.prepare('SELECT * FROM authors ORDER BY name ASC').all() });
});

app.post('/api/admin/authors', requireAdmin, (req: AuthenticatedRequest, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    res.status(400).json({ error: 'Author name is required.' });
    return;
  }
  const id = randomUUID();
  const slug = `${generateSlug(name)}-${id.slice(0, 4)}`;
  db.prepare(
    `INSERT INTO authors (id, name, slug, role_title, bio, avatar_url, email, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
  ).run(
    id,
    name,
    slug,
    String(req.body.role_title || 'Staff Correspondent'),
    String(req.body.bio || ''),
    req.body.email ? String(req.body.email) : null,
    new Date().toISOString()
  );
  logAudit(req.admin!.email, 'CREATE_AUTHOR', 'author', id, `Added author: ${name}`, req.ip || '');
  res.status(201).json({ id, name, slug });
});

app.delete('/api/admin/authors/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const used = (db.prepare('SELECT COUNT(*) as c FROM articles WHERE author_id = ?').get(req.params.id) as { c: number }).c;
  if (used > 0) {
    res.status(400).json({ error: 'Cannot delete an author assigned to existing articles.' });
    return;
  }
  db.prepare('DELETE FROM authors WHERE id = ?').run(req.params.id);
  logAudit(req.admin!.email, 'DELETE_AUTHOR', 'author', req.params.id, 'Removed author', req.ip || '');
  res.json({ ok: true });
});

// Media Library
app.get('/api/admin/media', requireAdmin, (_req, res) => {
  res.json({ assets: db.prepare('SELECT * FROM media_assets ORDER BY created_at DESC').all() });
});

app.post('/api/admin/media/upload', requireAdmin, uploadMedia.single('file'), (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded.' });
    return;
  }
  const id = randomUUID();
  const url = `/uploads/${req.file.filename}`;
  db.prepare(
    `INSERT INTO media_assets (id, filename, original_name, mime_type, size_bytes, url, alt_text, credit, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.file.filename,
    req.file.originalname,
    req.file.mimetype,
    req.file.size,
    url,
    String(req.body.alt_text || req.file.originalname),
    String(req.body.credit || 'THE CONTINENTAL'),
    req.admin!.email,
    new Date().toISOString()
  );
  logAudit(req.admin!.email, 'UPLOAD_MEDIA', 'media', id, `Uploaded ${req.file.originalname} (${req.file.mimetype})`, req.ip || '');
  res.status(201).json({ id, url, originalName: req.file.originalname, mimeType: req.file.mimetype });
});

app.delete('/api/admin/media/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const asset = db.prepare('SELECT filename, url FROM media_assets WHERE id = ?').get(req.params.id) as
    | { filename: string; url: string }
    | undefined;
  if (!asset) {
    res.status(404).json({ error: 'Asset not found.' });
    return;
  }
  if (asset.url.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, path.basename(asset.filename));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  db.prepare('DELETE FROM media_assets WHERE id = ?').run(req.params.id);
  logAudit(req.admin!.email, 'DELETE_MEDIA', 'media', req.params.id, `Deleted media asset: ${asset.filename}`, req.ip || '');
  res.json({ ok: true });
});

// Newsletter, Contact, Settings, Audit Logs
app.get('/api/admin/newsletter', requireAdmin, (_req, res) => {
  res.json({ subscribers: db.prepare('SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC').all() });
});

app.delete('/api/admin/newsletter/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').run(req.params.id);
  logAudit(req.admin!.email, 'DELETE_SUBSCRIBER', 'newsletter', req.params.id, 'Removed subscriber record', req.ip || '');
  res.json({ ok: true });
});

app.get('/api/admin/contact', requireAdmin, (_req, res) => {
  res.json({ messages: db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all() });
});

app.patch('/api/admin/contact/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  db.prepare('UPDATE contact_messages SET status = ?, admin_notes = ? WHERE id = ?').run(
    String(req.body.status || 'read'),
    String(req.body.admin_notes || ''),
    req.params.id
  );
  logAudit(req.admin!.email, 'UPDATE_CONTACT', 'contact', req.params.id, `Marked contact message as ${req.body.status}`, req.ip || '');
  res.json({ ok: true });
});

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  res.json({ settings: getAllSettings() });
});

app.put('/api/admin/settings', requireAdmin, (req: AuthenticatedRequest, res) => {
  const updates = req.body as Record<string, unknown>;
  const now = new Date().toISOString();
  const upsert = db.prepare(
    `INSERT INTO site_settings (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
  );
  for (const [k, v] of Object.entries(updates)) {
    upsert.run(k, JSON.stringify(v), now);
  }
  logAudit(req.admin!.email, 'UPDATE_SETTINGS', 'settings', 'site', `Updated settings keys: ${Object.keys(updates).join(', ')}`, req.ip || '');
  res.json({ settings: getAllSettings() });
});

app.get('/api/admin/audit-logs', requireAdmin, (_req, res) => {
  res.json({ logs: db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200').all() });
});

app.get('/api/admin/notifications', requireAdminOrNotificationRecipient, (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 200')
    .all() as Array<Record<string, unknown>>;
  res.json({
    recipientEmail: NOTIFICATION_EMAIL,
    notifications: rows.map((n) => ({
      ...n,
      is_read: Boolean(n.is_read),
    })),
  });
});

app.patch('/api/admin/notifications/:id/read', requireAdminOrNotificationRecipient, (req, res) => {
  db.prepare('UPDATE admin_notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/notifications/deliver-gmail', requireAdminOrNotificationRecipient, async (req: AuthenticatedRequest, res) => {
  const authHeader = req.headers.authorization || '';
  const gmailToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!gmailToken) {
    res.status(401).json({ error: 'Gmail authorization Bearer token is required. Connect Gmail first.' });
    return;
  }

  const verified = await verifyGmailBearerToken(gmailToken);
  if (!verified.valid) {
    res.status(401).json({ error: verified.error || 'Invalid or expired Gmail authorization token.' });
    return;
  }

  const mode = req.body?.mode === 'test' ? 'test' : 'pending';
  const requestedIds = Array.isArray(req.body?.notificationIds)
    ? req.body.notificationIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (mode === 'test') {
    const now = new Date().toISOString();
    const content = buildNotificationEmailContent({
      eventType: 'user_login',
      subject: 'THE CONTINENTAL — Gmail Inbox Notification Test',
      message: `This test confirms that reader registrations, logins, newsletter subscriptions, contact messages, and article submissions are configured to arrive directly in ${NOTIFICATION_EMAIL}.`,
      actorName: req.user?.fullName || 'THE CONTINENTAL Owner',
      actorEmail: verified.emailAddress || NOTIFICATION_EMAIL,
      createdAt: now,
      recipientEmail: NOTIFICATION_EMAIL,
    });

    const sent = await sendNotificationViaGmailApi({
      accessToken: gmailToken,
      senderEmail: verified.emailAddress,
      to: NOTIFICATION_EMAIL,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    if (!sent.ok) {
      res.status(502).json({ error: sent.error || 'Failed to send test email via Gmail API.' });
      return;
    }

    logAudit(
      req.user?.email || NOTIFICATION_EMAIL,
      'GMAIL_TEST_DELIVERED',
      'notification',
      sent.messageId || 'test',
      `Delivered test notification to ${NOTIFICATION_EMAIL} via Gmail API (${verified.emailAddress})`,
      req.ip || ''
    );

    res.json({
      sentCount: 1,
      failedCount: 0,
      recipientEmail: NOTIFICATION_EMAIL,
      senderEmail: verified.emailAddress,
      messageId: sent.messageId,
    });
    return;
  }

  let rows: Array<{
    id: string;
    event_type: string;
    recipient_email: string;
    actor_email: string;
    actor_name: string;
    subject: string;
    message: string;
    delivery_status: string;
    created_at: string;
  }> = [];

  if (requestedIds.length > 0) {
    const placeholders = requestedIds.map(() => '?').join(',');
    rows = db
      .prepare(`SELECT * FROM admin_notifications WHERE id IN (${placeholders}) ORDER BY created_at DESC`)
      .all(...requestedIds) as typeof rows;
  } else {
    rows = db
      .prepare(
        `SELECT * FROM admin_notifications
         WHERE delivery_status NOT IN ('emailed_to_inbox', 'emailed_to_gmail_inbox', 'emailed_to_admin')
         ORDER BY created_at DESC LIMIT 25`
      )
      .all() as typeof rows;
  }

  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  const markSent = db.prepare(
    `UPDATE admin_notifications SET recipient_email = ?, delivery_status = 'emailed_to_gmail_inbox' WHERE id = ?`
  );

  for (const row of rows) {
    const content = buildNotificationEmailContent({
      eventType: row.event_type,
      subject: row.subject,
      message: row.message,
      actorName: row.actor_name || row.actor_email,
      actorEmail: row.actor_email,
      createdAt: row.created_at,
      recipientEmail: NOTIFICATION_EMAIL,
    });

    const sent = await sendNotificationViaGmailApi({
      accessToken: gmailToken,
      senderEmail: verified.emailAddress,
      to: NOTIFICATION_EMAIL,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    if (sent.ok) {
      markSent.run(NOTIFICATION_EMAIL, row.id);
      sentCount++;
    } else {
      failedCount++;
      if (sent.error) errors.push(sent.error);
    }
  }

  logAudit(
    req.user?.email || NOTIFICATION_EMAIL,
    'GMAIL_BATCH_DELIVERY',
    'notification',
    'batch',
    `Dispatched ${sentCount} alert(s) to ${NOTIFICATION_EMAIL} via Gmail API (${failedCount} failed)`,
    req.ip || ''
  );

  res.json({
    sentCount,
    failedCount,
    recipientEmail: NOTIFICATION_EMAIL,
    senderEmail: verified.emailAddress,
    errors: errors.slice(0, 3),
  });
});

// ==================================================
// SEO: SITEMAP.XML & ROBOTS.TXT
// ==================================================

app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${baseUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const staticPaths = [
    '/',
    '/world',
    '/india',
    '/regional',
    '/politics',
    '/business',
    '/economy',
    '/education',
    '/science-technology',
    '/environment',
    '/sports',
    '/opinion',
    '/editorial',
    '/magazine',
    '/epaper',
    '/publish-your-writing',
    '/about',
    '/contact',
    '/search',
    '/editorial-policy',
    '/corrections-policy',
    '/privacy-policy',
    '/terms',
  ];

  const articles = db
    .prepare("SELECT slug, updated_at FROM articles WHERE status = 'published' AND approval_status = 'approved'")
    .all() as Array<{ slug: string; updated_at: string }>;

  const urls = [
    ...staticPaths.map((p) => `<url><loc>${baseUrl}${p}</loc></url>`),
    ...articles.map(
      (a) => `<url><loc>${baseUrl}/article/${a.slug}</loc><lastmod>${a.updated_at.slice(0, 10)}</lastmod></url>`
    ),
  ];

  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
  );
});

// Error handler for Multer / API errors
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: err.message || 'Request error.' });
});

// ==================================================
// VITE DEV / STATIC PROD SERVING
// ==================================================

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`THE CONTINENTAL server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
