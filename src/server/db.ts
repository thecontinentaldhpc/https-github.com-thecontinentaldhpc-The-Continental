import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { applyNov16NewsEdition } from './nov16Edition';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'the_continental.db');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone_number TEXT UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('super_admin', 'reader')),
      firebase_uid TEXT,
      photo_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      show_in_nav INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS authors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      role_title TEXT NOT NULL DEFAULT 'Staff Correspondent',
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      email TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subheadline TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL DEFAULT '',
      content_html TEXT NOT NULL,
      featured_image_url TEXT,
      image_caption TEXT NOT NULL DEFAULT '',
      image_credit TEXT NOT NULL DEFAULT '',
      author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      seo_title TEXT NOT NULL DEFAULT '',
      seo_description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
      approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved')),
      is_featured INTEGER NOT NULL DEFAULT 0,
      featured_slot TEXT CHECK (featured_slot IN ('lead', 'top_story', 'section_feature') OR featured_slot IS NULL),
      is_breaking INTEGER NOT NULL DEFAULT 0,
      scheduled_at TEXT,
      published_at TEXT,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
    CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      submission_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      title TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      short_description TEXT NOT NULL,
      content_html TEXT NOT NULL,
      featured_image_url TEXT,
      author_bio TEXT NOT NULL,
      originality_confirmed INTEGER NOT NULL DEFAULT 0,
      terms_accepted INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Revision Requested', 'Approved', 'Rejected', 'Published')),
      internal_notes TEXT NOT NULL DEFAULT '',
      published_article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS magazines (
      id TEXT PRIMARY KEY,
      issue_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      year INTEGER NOT NULL,
      cover_image_url TEXT,
      editors_note TEXT NOT NULL DEFAULT '',
      pdf_url TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'draft', 'scheduled', 'published', 'archived')),
      approved_by_admin INTEGER NOT NULL DEFAULT 0,
      scheduled_at TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(year, month)
    );

    CREATE TABLE IF NOT EXISTS magazine_articles (
      id TEXT PRIMARY KEY,
      magazine_id TEXT NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      author_name TEXT NOT NULL,
      category_name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      content_html TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_featured INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS epaper_editions (
      id TEXT PRIMARY KEY,
      edition_number TEXT NOT NULL UNIQUE,
      edition_date TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      pdf_url TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'draft', 'scheduled', 'published', 'archived')),
      approved_by_admin INTEGER NOT NULL DEFAULT 0,
      scheduled_at TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      url TEXT NOT NULL,
      alt_text TEXT NOT NULL DEFAULT '',
      credit TEXT NOT NULL DEFAULT '',
      uploaded_by TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      consent_given INTEGER NOT NULL DEFAULT 1,
      fee_inr INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
      subscribed_at TEXT NOT NULL,
      unsubscribed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),
      admin_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS admin_notifications (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL CHECK (event_type IN ('user_login', 'user_registered', 'newsletter_subscribe', 'submission_received', 'contact_message')),
      recipient_email TEXT NOT NULL DEFAULT 'thecontinental.dhpc@gmail.com',
      actor_email TEXT NOT NULL,
      actor_name TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      delivery_status TEXT NOT NULL DEFAULT 'queued_for_inbox_delivery',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);

    CREATE TABLE IF NOT EXISTS saved_articles (
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      category_name TEXT NOT NULL DEFAULT 'News',
      category_slug TEXT NOT NULL DEFAULT 'world',
      author_name TEXT NOT NULL DEFAULT 'THE CONTINENTAL Staff',
      featured_image_url TEXT,
      published_at TEXT NOT NULL DEFAULT '',
      saved_at TEXT NOT NULL,
      PRIMARY KEY (user_id, article_id)
    );

    CREATE INDEX IF NOT EXISTS idx_saved_articles_user_saved_at ON saved_articles(user_id, saved_at DESC);
  `);

  // Idempotent migration if profiles lacks reader role, phone_number column, or nullable email
  const profTable = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'profiles'")
    .get() as { sql: string } | undefined;
  const profCols = db.prepare('PRAGMA table_info(profiles)').all() as Array<{ name: string; notnull: number }>;
  const hasPhoneCol = profCols.some((c) => c.name === 'phone_number');
  const emailColNotNull = profCols.some((c) => c.name === 'email' && c.notnull === 1);
  if (profTable && (!profTable.sql.includes("'reader'") || !hasPhoneCol || emailColNotNull)) {
    db.exec(`
      BEGIN;
      CREATE TABLE profiles_migrated (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        phone_number TEXT UNIQUE,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('super_admin', 'reader')),
        firebase_uid TEXT,
        photo_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO profiles_migrated (id, email, phone_number, full_name, password_hash, role, firebase_uid, photo_url, created_at, updated_at)
      SELECT
        id,
        NULLIF(TRIM(email), ''),
        ${hasPhoneCol ? "NULLIF(TRIM(phone_number), '')" : 'NULL'},
        full_name,
        password_hash,
        role,
        firebase_uid,
        photo_url,
        created_at,
        updated_at
      FROM profiles;
      DROP TABLE profiles;
      ALTER TABLE profiles_migrated RENAME TO profiles;
      COMMIT;
    `);
  }

  // Idempotent migration for admin_notifications event_type CHECK constraint & thecontinental.dhpc@gmail.com recipient
  const notifTable = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'admin_notifications'")
    .get() as { sql: string } | undefined;
  if (
    notifTable &&
    (!notifTable.sql.includes("'submission_received'") ||
      !notifTable.sql.includes("'contact_message'") ||
      notifTable.sql.includes('artifex.alexx@gmail.com'))
  ) {
    db.exec(`
      BEGIN;
      CREATE TABLE admin_notifications_migrated (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL CHECK (event_type IN ('user_login', 'user_registered', 'newsletter_subscribe', 'submission_received', 'contact_message')),
        recipient_email TEXT NOT NULL DEFAULT 'thecontinental.dhpc@gmail.com',
        actor_email TEXT NOT NULL,
        actor_name TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        delivery_status TEXT NOT NULL DEFAULT 'queued_for_inbox_delivery',
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      INSERT INTO admin_notifications_migrated (id, event_type, recipient_email, actor_email, actor_name, subject, message, delivery_status, is_read, created_at)
      SELECT
        id,
        event_type,
        CASE WHEN LOWER(recipient_email) = 'artifex.alexx@gmail.com' THEN 'thecontinental.dhpc@gmail.com' ELSE recipient_email END,
        actor_email,
        actor_name,
        subject,
        message,
        CASE WHEN delivery_status = 'recorded_for_admin_mail' THEN 'queued_for_inbox_delivery' ELSE delivery_status END,
        is_read,
        created_at
      FROM admin_notifications;
      DROP TABLE admin_notifications;
      ALTER TABLE admin_notifications_migrated RENAME TO admin_notifications;
      CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);
      COMMIT;
    `);
  } else {
    db.prepare(
      "UPDATE admin_notifications SET recipient_email = 'thecontinental.dhpc@gmail.com' WHERE LOWER(recipient_email) = 'artifex.alexx@gmail.com'"
    ).run();
  }

  // Idempotent migration for newsletter_subscribers fee_inr column
  const subCols = db.prepare('PRAGMA table_info(newsletter_subscribers)').all() as Array<{ name: string }>;
  if (!subCols.some((col) => col.name === 'fee_inr')) {
    db.exec('ALTER TABLE newsletter_subscribers ADD COLUMN fee_inr INTEGER NOT NULL DEFAULT 0;');
  }

  // Idempotent migration for live news ingestion metadata on articles
  const artCols = db.prepare('PRAGMA table_info(articles)').all() as Array<{ name: string }>;
  if (!artCols.some((col) => col.name === 'source_guid')) {
    db.exec("ALTER TABLE articles ADD COLUMN source_guid TEXT;");
  }
  if (!artCols.some((col) => col.name === 'source_url')) {
    db.exec("ALTER TABLE articles ADD COLUMN source_url TEXT;");
  }
  if (!artCols.some((col) => col.name === 'source_name')) {
    db.exec("ALTER TABLE articles ADD COLUMN source_name TEXT NOT NULL DEFAULT '';");
  }
  if (!artCols.some((col) => col.name === 'topic_signature')) {
    db.exec("ALTER TABLE articles ADD COLUMN topic_signature TEXT NOT NULL DEFAULT '';");
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_articles_source_guid ON articles(source_guid);');

  seedInitialData();
  applyNov16NewsEdition(db);
}

export function bumpEditionLastUpdatedAt(isoTimestamp: string = new Date().toISOString()): string {
  db.prepare(
    `INSERT INTO site_settings (key, value_json, updated_at) VALUES ('edition_last_updated_at', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
  ).run(JSON.stringify(isoTimestamp), isoTimestamp);
  return isoTimestamp;
}

export function getEditionLastUpdatedAt(): string {
  const row = db
    .prepare(
      `SELECT MAX(COALESCE(updated_at, published_at, created_at)) as latest_ts
       FROM articles
       WHERE status = 'published' AND approval_status = 'approved'`
    )
    .get() as { latest_ts: string | null } | undefined;

  const settingRow = db
    .prepare("SELECT value_json FROM site_settings WHERE key = 'edition_last_updated_at'")
    .get() as { value_json: string } | undefined;

  let settingTs = '';
  if (settingRow) {
    try {
      const parsed = JSON.parse(settingRow.value_json);
      if (typeof parsed === 'string') settingTs = parsed;
    } catch {
      settingTs = settingRow.value_json;
    }
  }

  const articleTs = row?.latest_ts || '';
  if (settingTs && articleTs) {
    return Date.parse(settingTs) >= Date.parse(articleTs) ? settingTs : articleTs;
  }
  return articleTs || settingTs || new Date().toISOString();
}

function seedInitialData(): void {
  const catCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c;
  if (catCount > 0) return;

  const now = new Date().toISOString();

  const categories = [
    { id: randomUUID(), name: 'World', slug: 'world', description: 'International diplomacy, global security, and cross-border affairs.', sort_order: 1 },
    { id: randomUUID(), name: 'India', slug: 'india', description: 'National governance, Parliament, judiciary, and public institutions.', sort_order: 2 },
    { id: randomUUID(), name: 'Regional', slug: 'regional', description: 'State policy, civic infrastructure, and local reporting across regions.', sort_order: 3 },
    { id: randomUUID(), name: 'Politics', slug: 'politics', description: 'Electoral dynamics, legislative debates, and constitutional governance.', sort_order: 4 },
    { id: randomUUID(), name: 'Business', slug: 'business', description: 'Corporate governance, trade corridors, and industrial strategy.', sort_order: 5 },
    { id: randomUUID(), name: 'Economy', slug: 'economy', description: 'Macroeconomics, central banking, fiscal policy, and public finance.', sort_order: 6 },
    { id: randomUUID(), name: 'Education', slug: 'education', description: 'Universities, public schooling, research policy, and academic equity.', sort_order: 7 },
    { id: randomUUID(), name: 'Science & Technology', slug: 'science-technology', description: 'Scientific research, clean energy, computing, and space.', sort_order: 8 },
    { id: randomUUID(), name: 'Environment', slug: 'environment', description: 'Climate resilience, biodiversity, water systems, and energy transition.', sort_order: 9 },
    { id: randomUUID(), name: 'Sports', slug: 'sports', description: 'Cricket, athletics, chess, and international sporting governance.', sort_order: 10 },
    { id: randomUUID(), name: 'Opinion', slug: 'opinion', description: 'Columns, essays, and informed debate from independent voices.', sort_order: 11 },
    { id: randomUUID(), name: 'Editorial', slug: 'editorial', description: 'The official editorial stance of THE CONTINENTAL.', sort_order: 12 },
  ];

  const insertCat = db.prepare(
    'INSERT INTO categories (id, name, slug, description, sort_order, show_in_nav, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
  );
  for (const c of categories) {
    insertCat.run(c.id, c.name, c.slug, c.description, c.sort_order, now);
  }
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  const authors = [
    {
      id: randomUUID(),
      name: 'Meera Raghavan',
      slug: 'meera-raghavan',
      role_title: 'Diplomatic & International Affairs Editor',
      bio: 'Meera Raghavan covers multilateral negotiations, treaty frameworks, and geopolitical shifts across Geneva, New Delhi, and Brussels.',
      email: 'diplomatic@thecontinental.dhpc.in',
    },
    {
      id: randomUUID(),
      name: 'Arjun Deshmukh',
      slug: 'arjun-deshmukh',
      role_title: 'Chief Political & Parliamentary Correspondent',
      bio: 'Arjun Deshmukh reports on constitutional law, parliamentary committees, and federal governance from New Delhi.',
      email: 'parliament@thecontinental.dhpc.in',
    },
    {
      id: randomUUID(),
      name: 'Dr. Kavita Subramanian',
      slug: 'kavita-subramanian',
      role_title: 'Science, Climate & Energy Correspondent',
      bio: 'Dr. Kavita Subramanian writes on grid decarbonisation, atmospheric science, and public research institutions.',
      email: 'science@thecontinental.dhpc.in',
    },
    {
      id: randomUUID(),
      name: 'Vikramaditya Sen',
      slug: 'vikramaditya-sen',
      role_title: 'Economics & Maritime Trade Editor',
      bio: 'Vikramaditya Sen analyses global supply chains, sovereign debt frameworks, and central bank policy.',
      email: 'economy@thecontinental.dhpc.in',
    },
    {
      id: randomUUID(),
      name: 'The Continental Editorial Board',
      slug: 'editorial-board',
      role_title: 'Editorial Desk',
      bio: 'Unsigned editorials represent the institutional view of THE CONTINENTAL editorial board.',
      email: 'editorial@thecontinental.dhpc.in',
    },
  ];

  const insertAuthor = db.prepare(
    'INSERT INTO authors (id, name, slug, role_title, bio, avatar_url, email, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)'
  );
  for (const a of authors) {
    insertAuthor.run(a.id, a.name, a.slug, a.role_title, a.bio, a.email, now);
  }
  const authorBySlug = Object.fromEntries(authors.map((a) => [a.slug, a.id]));

  const imgSummit = '/src/assets/images/hero_diplomacy_summit_1794838988380.jpg';
  const imgParliament = '/src/assets/images/india_parliament_corridor_1794838966996.jpg';
  const imgEnergy = '/src/assets/images/science_clean_energy_grid_1794838968003.jpg';
  const imgPort = '/src/assets/images/economy_maritime_port_1794838966887.jpg';
  const imgLibrary = '/src/assets/images/university_library_research_1794838986975.jpg';
  const imgMagazine = '/src/assets/images/magazine_january_cover_1794838967274.jpg';

  const mediaItems = [
    { name: 'hero_diplomacy_summit.jpg', url: imgSummit, alt: 'Delegates at international diplomatic summit conference hall', credit: 'THE CONTINENTAL Archive' },
    { name: 'india_parliament_corridor.jpg', url: imgParliament, alt: 'Sandstone colonnade of parliamentary complex in New Delhi', credit: 'THE CONTINENTAL Archive' },
    { name: 'science_clean_energy_grid.jpg', url: imgEnergy, alt: 'Concentrated solar thermal array and high-voltage grid lines', credit: 'THE CONTINENTAL Archive' },
    { name: 'economy_maritime_port.jpg', url: imgPort, alt: 'Container vessel docked beneath gantry cranes at twilight', credit: 'THE CONTINENTAL Archive' },
    { name: 'university_library_research.jpg', url: imgLibrary, alt: 'Scholars studying in a wood-panelled university reading hall', credit: 'THE CONTINENTAL Archive' },
    { name: 'magazine_january_cover.jpg', url: imgMagazine, alt: 'Letterpress blocks, compass, and broadsheet paper', credit: 'THE CONTINENTAL Archive' },
  ];
  const insertMedia = db.prepare(
    'INSERT INTO media_assets (id, filename, original_name, mime_type, size_bytes, url, alt_text, credit, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const m of mediaItems) {
    insertMedia.run(randomUUID(), m.name, m.name, 'image/jpeg', 180000, m.url, m.alt, m.credit, 'system', now);
  }

  // Historical / recent published articles
  const seededArticles = [
    {
      title: 'Geneva Maritime and Climate Accord Reaches Binding Verification Framework After Marathon Talks',
      subheadline: 'Forty-eight coastal and landlocked nations agree to shared satellite emissions monitoring and port decarbonisation benchmarks ahead of 2027 implementation.',
      slug: 'geneva-maritime-climate-accord-verification-framework',
      summary: 'After six days of intensive ministerial drafting in Geneva, negotiators finalised an enforceable inspection protocol linking sovereign green-shipping credits to verified port infrastructure upgrades.',
      content_html: `<p>GENEVA — Negotiators from forty-eight countries concluded marathon deliberations late Wednesday by adopting a binding verification annex to the Geneva Maritime and Climate Accord, establishing independent satellite and port-side audits for transoceanic freight corridors.</p>
<p>The agreement resolves a two-year deadlock between major manufacturing exporters and small island states over how transitional bunker-fuel reductions should be measured and financed. Under the compromise text, port authorities will publish quarterly vessel-intensity ledgers audited by an international technical secretariat.</p>
<h2>A Shift From Pledges to Auditable Ledgers</h2>
<p>Unlike earlier non-binding declarations, the 2027 compliance schedule ties preferential port tariffs directly to verifiable Shore-Power readiness and green-methanol bunkering capacity. Delegations from India, Brazil, and the Nordic bloc played a pivotal role in drafting the technology-transfer clause.</p>
<blockquote>"Credibility in international diplomacy no longer rests on lofty preambles; it rests on instruments that can be inspected at the berth and reconciled in public ledgers."</blockquote>
<p>Trade ministries in New Delhi and Singapore welcomed the tiered compliance window for developing maritime hubs, noting that predictable standards reduce fragmentation for global shipping lines while accelerating domestic port electrification.</p>
<h3>Next Steps Before Ratification</h3>
<p>National legislatures have ninety days to deposit ratification instruments before the Joint Maritime Commission convenes its inaugural statutory session in early 2027.</p>`,
      featured_image_url: imgSummit,
      image_caption: 'Delegations confer beside the main plenary hall during the concluding session of the Geneva Maritime and Climate Accord.',
      image_credit: 'THE CONTINENTAL / Geneva Desk',
      author_id: authorBySlug['meera-raghavan'],
      category_id: catBySlug['world'],
      tags: ['Diplomacy', 'Maritime Trade', 'Climate Governance'],
      featured_slot: 'lead',
      is_featured: 1,
      is_breaking: 1,
      published_at: '2026-11-16T03:00:00.000Z',
    },
    {
      title: 'Parliamentary Panel Calls for Unified Statutory Audit of Digital Public Infrastructure',
      subheadline: 'Bipartisan committee urges clear statutory guardrails on algorithmic grievance redressal and state data interoperability.',
      slug: 'parliamentary-panel-unified-audit-digital-public-infrastructure',
      summary: 'A standing parliamentary committee has recommended an independent annual compliance audit covering civic payment rails, welfare registries, and citizen appeal timelines.',
      content_html: `<p>NEW DELHI — A bipartisan parliamentary standing committee tabled a comprehensive review on Monday calling for statutory audit standards across public digital registries, warning that rapid administrative digitisation must be matched by accessible offline grievance mechanisms.</p>
<p>The 142-page report examines citizen experiences across municipal portals, rural employment ledgers, and health-identity networks. While acknowledging substantial reductions in disbursal delays, lawmakers stressed that biometric or connectivity failures must never result in the denial of statutory entitlements.</p>
<h2>Accountability at the Last Mile</h2>
<p>The committee recommended mandatory thirty-day resolution clocks for disputed beneficiary records, alongside plain-language audit summaries published in regional languages. Legal scholars testifying before the panel emphasised that constitutional accountability requires transparent administrative trails.</p>`,
      featured_image_url: imgParliament,
      image_caption: 'The sandstone colonnade of the parliamentary complex in New Delhi ahead of the winter committee sittings.',
      image_credit: 'THE CONTINENTAL / New Delhi Bureau',
      author_id: authorBySlug['arjun-deshmukh'],
      category_id: catBySlug['india'],
      tags: ['Parliament', 'Governance', 'Digital Policy'],
      featured_slot: 'top_story',
      is_featured: 1,
      is_breaking: 1,
      published_at: '2026-11-16T02:15:00.000Z',
    },
    {
      title: 'Grid Operators Expand Molten-Salt Storage Trials to Stabilise Evening Peak Demand',
      subheadline: 'High-capacity thermal reserves aim to bridge solar sunset troughs without expanding coal-fired spinning capacity.',
      slug: 'grid-operators-expand-molten-salt-storage-trials',
      summary: 'Regional transmission planners have commissioned two new concentrated solar-thermal storage blocks designed to dispatch steady baseload power for eight hours after dusk.',
      content_html: `<p>JODHPUR — Grid engineers overseeing western regional transmission corridors have synchronised two high-capacity molten-salt thermal storage units, marking a practical test of dispatchable renewable baseload during evening peak hours.</p>
<p>While photovoltaic costs have fallen sharply over the past decade, system operators face steep evening ramps once solar generation drops after 5:30 p.m. Concentrated solar-thermal plants store heat in insulated nitrate salt tanks at temperatures exceeding 550 degrees Celsius, driving steam turbines well into the night.</p>
<h2>Engineering Lessons for Industrial Corridors</h2>
<p>Preliminary telemetry indicates round-trip thermal retention exceeding 91 percent across forty-eight-hour cycles, offering manufacturing clusters a predictable clean-power complement to lithium-ion battery banks.</p>`,
      featured_image_url: imgEnergy,
      image_caption: 'Parabolic collector rows and high-voltage transmission towers at a desert solar-thermal facility.',
      image_credit: 'THE CONTINENTAL / Science Desk',
      author_id: authorBySlug['kavita-subramanian'],
      category_id: catBySlug['science-technology'],
      tags: ['Clean Energy', 'Grid Engineering', 'Power Sector'],
      featured_slot: 'top_story',
      is_featured: 1,
      is_breaking: 0,
      published_at: '2026-11-15T11:30:00.000Z',
    },
    {
      title: 'Deep-Water Container Hubs Reconfigure Red Sea and Indian Ocean Feeder Routes',
      subheadline: 'Port authorities invest in automated rail spurs and customs digitisation as carriers consolidate long-haul loops.',
      slug: 'deep-water-container-hubs-reconfigure-indian-ocean-routes',
      summary: 'Shipping alliances are shifting transshipment calls toward deep-draft Indian Ocean ports equipped with rapid rail turnaround and consolidated customs clearance.',
      content_html: `<p>MUMBAI — Major container shipping alliances are recalibrating Indian Ocean transshipment schedules, directing ultra-large vessels toward deep-water terminals with dedicated freight-rail connectivity.</p>
<p>Port economists note that dwell-time predictability—rather than headline crane speeds alone—now determines whether exporters capture time-sensitive seasonal orders across European and East Asian retail corridors.</p>`,
      featured_image_url: imgPort,
      image_caption: 'Gantry cranes illuminate a container vessel during night-shift loading operations.',
      image_credit: 'THE CONTINENTAL / Maritime Desk',
      author_id: authorBySlug['vikramaditya-sen'],
      category_id: catBySlug['economy'],
      tags: ['Trade', 'Shipping', 'Macroeconomy'],
      featured_slot: 'top_story',
      is_featured: 1,
      is_breaking: 0,
      published_at: '2026-11-15T09:00:00.000Z',
    },
    {
      title: 'Public Universities Form Open Archival Consortium to Digitise Regional Manuscripts',
      subheadline: 'Twelve state universities pool conservation laboratories and open-access cataloguing standards for scholars.',
      slug: 'public-universities-open-archival-consortium-regional-manuscripts',
      summary: 'History and linguistics departments across twelve public universities have launched a shared non-commercial repository preserving fragile nineteenth- and twentieth-century periodicals.',
      content_html: `<p>CHENNAI — Librarians and historians from twelve public universities signed an inter-institutional charter this week to digitise and freely index rare regional periodicals, municipal gazettes, and vernacular pamphlets.</p>
<p>Researchers note that high-resolution non-destructive scanning preserves fragile acid-paper editions while enabling cross-disciplinary scholarship for students outside metropolitan centres.</p>`,
      featured_image_url: imgLibrary,
      image_caption: 'Scholars consult archival volumes inside a sunlit university reading room.',
      image_credit: 'THE CONTINENTAL / Education Desk',
      author_id: authorBySlug['arjun-deshmukh'],
      category_id: catBySlug['education'],
      tags: ['Higher Education', 'Archives', 'Research'],
      featured_slot: 'section_feature',
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-15T06:45:00.000Z',
    },
    {
      title: 'Truth Without Fear: Why Independent Digital Broadsheets Matter in an Era of Algorithmic Noise',
      subheadline: 'Ahead of our 1 January 2027 inaugural newspaper edition, THE CONTINENTAL sets out its editorial charter.',
      slug: 'truth-without-fear-independent-digital-broadsheets-editorial',
      summary: 'Information abundance has not automatically produced civic clarity. Rigorous verification, patient reporting, and transparent accountability remain indispensable.',
      content_html: `<p>Readers today navigate an unprecedented volume of instant commentary, yet genuinely verified reporting on public institutions, scientific policy, and regional communities has grown scarcer. Speed is routinely rewarded over accuracy; outrage travels faster than context.</p>
<p>THE CONTINENTAL has been established to affirm an older, enduring standard of journalism: facts gathered through direct verification, analysis grounded in evidence, and an explicit separation between news reporting and opinion.</p>
<blockquote>"Independent journalism is neither a luxury nor a partisan instrument; it is civic infrastructure for an informed world."</blockquote>
<p>As we prepare for our inaugural daily e-paper edition on 1 January 2027 and our monthly magazine in January 2027, every article published on this platform—whether filed by our correspondents or contributed by independent writers—undergoes deliberate editorial scrutiny before reaching readers.</p>`,
      featured_image_url: null,
      image_caption: '',
      image_credit: '',
      author_id: authorBySlug['editorial-board'],
      category_id: catBySlug['editorial'],
      tags: ['Editorial Charter', 'Journalism', 'Public Interest'],
      featured_slot: 'section_feature',
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-14T18:30:00.000Z',
    },
    {
      title: 'The Quiet Crisis in Municipal Bond Markets and Urban Water Financing',
      subheadline: 'Cities need transparent balance sheets before long-term infrastructure debt can scale sustainably.',
      slug: 'quiet-crisis-municipal-bond-markets-urban-water',
      summary: 'Without standardised accrual accounting and ring-fenced water utility revenues, mid-sized cities face punitive borrowing spreads.',
      content_html: `<p>Across rapidly expanding urban agglomerations, piped water reliability and stormwater drainage remain chronically underfunded. While municipal bonds are frequently prescribed as a remedy, institutional investors remain cautious where city corporations lack audited, multi-year financial statements.</p>
<p>Reforming urban finance requires strengthening local accounting capacity rather than relying solely on central grants.</p>`,
      featured_image_url: null,
      image_caption: '',
      image_credit: '',
      author_id: authorBySlug['vikramaditya-sen'],
      category_id: catBySlug['opinion'],
      tags: ['Urban Policy', 'Municipal Finance', 'Opinion'],
      featured_slot: null,
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-14T12:00:00.000Z',
    },
    {
      title: 'State Capitals Expand Suburban Electric Rail Integration Under Unified Ticketing',
      subheadline: 'Commuter corridors in southern and western metropolitan regions test single-card transfers between metro and suburban rail.',
      slug: 'state-capitals-expand-suburban-electric-rail-integration',
      summary: 'Joint transport authorities report early gains in off-peak ridership where bus feeder schedules match suburban train arrivals.',
      content_html: `<p>BENGALURU — Regional transport planners have rolled out unified fare clearing across suburban electric rail and city bus feeders, cutting daily interchange penalties for industrial-belt commuters.</p>
<p>Transport researchers noted that timetable synchronisation mattered as much as fare discounts in persuading two-wheeler commuters to shift onto public rail.</p>`,
      featured_image_url: null,
      image_caption: '',
      image_credit: '',
      author_id: authorBySlug['arjun-deshmukh'],
      category_id: catBySlug['regional'],
      tags: ['Transit', 'Regional Infrastructure', 'Cities'],
      featured_slot: null,
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-14T08:30:00.000Z',
    },
    {
      title: 'Constitutional Bench Clarifies Scope of Fiscal Federalism in Inter-State Cess Disputes',
      subheadline: 'Ruling underscores transparency obligations in revenue-sharing formulas between Union and State treasuries.',
      slug: 'constitutional-bench-clarifies-fiscal-federalism-cess-disputes',
      summary: 'Legal observers say the judgment reinforces structured consultation inside federal fiscal councils.',
      content_html: `<p>NEW DELHI — In a closely watched constitutional ruling, judges reiterated that earmarked statutory surcharges must remain time-bound and subject to transparent legislative accounting.</p>
<p>State finance ministries welcomed the clarification ahead of upcoming federal budget consultations.</p>`,
      featured_image_url: null,
      image_caption: '',
      image_credit: '',
      author_id: authorBySlug['arjun-deshmukh'],
      category_id: catBySlug['politics'],
      tags: ['Federalism', 'Law', 'Politics'],
      featured_slot: null,
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-13T16:00:00.000Z',
    },
    {
      title: 'Precision Semiconductor Packaging Plants Seek Long-Term Renewable Power Contracts',
      subheadline: 'Industrial estates adopt captive solar-plus-storage procurement to meet international supply-chain mandates.',
      slug: 'semiconductor-packaging-plants-long-term-renewable-contracts',
      summary: 'Electronics assembly consortia are locking in twenty-year green power purchase agreements to insulate margins from grid volatility.',
      content_html: `<p>HYDERABAD — Electronics and semiconductor assembly firms expanding in southern industrial parks are increasingly tying capital expenditure to dedicated clean-energy wheeling agreements.</p>
<p>Corporate sustainability audits from global equipment buyers now treat verifiable Scope 2 emissions reductions as a baseline supplier condition.</p>`,
      featured_image_url: null,
      image_caption: '',
      image_credit: '',
      author_id: authorBySlug['vikramaditya-sen'],
      category_id: catBySlug['business'],
      tags: ['Manufacturing', 'Semiconductors', 'Business'],
      featured_slot: null,
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-13T10:15:00.000Z',
    },
    {
      title: 'Wetland Restoration Corridors Cut Urban Flood Peaks Across Coastal River Deltas',
      subheadline: 'Hydrological gauges show restored floodplain marshes absorbed over a third of monsoon surge volumes.',
      slug: 'wetland-restoration-corridors-cut-urban-flood-peaks',
      summary: 'Ecologists and civil engineers argue green-buffer zones outperform concrete embankments alone during extreme rainfall.',
      content_html: `<p>KOCHI — Five-year hydrological monitoring across restored estuarine marshes confirms that reconnecting tidal creeks dramatically slows peak storm runoff before it reaches dense residential wards.</p>
<p>Municipal engineers are incorporating sponge-basin zoning into updated coastal master plans.</p>`,
      featured_image_url: null,
      image_caption: '',
      image_credit: '',
      author_id: authorBySlug['kavita-subramanian'],
      category_id: catBySlug['environment'],
      tags: ['Wetlands', 'Climate Adaptation', 'Monsoon'],
      featured_slot: null,
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-12T14:20:00.000Z',
    },
    {
      title: 'Domestic Red-Ball Cricket Revives Emphasis on Four-Day Bowling Discipline',
      subheadline: 'Selectors and state academies credit longer spell tolerances and Dukes-seam experimentation for sharper pace depth.',
      slug: 'domestic-red-ball-cricket-revives-four-day-bowling-discipline',
      summary: 'Opening rounds of the first-class season saw lower scoring rates and genuine contest between bat and ball across neutral pitches.',
      content_html: `<p>MUMBAI — Coaches across premier domestic cricket associations report measurable gains in seam movement and middle-order patience following turf preparation reforms aimed at rewarding four-day temperament.</p>
<p>Former international captains noted that rigorous multi-day competition remains the surest foundation for overseas Test tours.</p>`,
      featured_image_url: null,
      image_caption: '',
      image_credit: '',
      author_id: authorBySlug['arjun-deshmukh'],
      category_id: catBySlug['sports'],
      tags: ['Cricket', 'Domestic Sport', 'Athletics'],
      featured_slot: null,
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-12T07:00:00.000Z',
    },
    {
      title: 'European Central Banks Weigh Synchronised Digital Euro Liquidity Safeguards',
      subheadline: 'Cross-border settlement working groups publish draft holding-cap proposals to protect commercial bank deposits.',
      slug: 'european-central-banks-digital-euro-liquidity-safeguards',
      summary: 'Monetary policymakers outlined technical ceilings designed to preserve financial stability while modernising retail cross-border clearing.',
      content_html: `<p>FRANKFURT — Senior monetary officials across the euro area released a technical paper Tuesday detailing tiered liquidity safeguards for retail digital currency accounts.</p><p>The framework aims to balance instant pan-European settlement with predictable commercial credit intermediation during periods of market stress.</p>`,
      featured_image_url: imgPort,
      image_caption: 'European trade and settlement corridors are preparing for next-generation clearing rules.',
      image_credit: 'THE CONTINENTAL / Frankfurt Desk',
      author_id: authorBySlug['meera-raghavan'],
      category_id: catBySlug['world'],
      tags: ['Europe', 'Central Banking', 'World'],
      featured_slot: null,
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-15T14:00:00.000Z',
    },
    {
      title: 'Pacific Island Nations Formalise Regional Cable Resilience Pact',
      subheadline: 'Joint subsea repair vessel fund aims to cut telecommunications outage durations after seismic events.',
      slug: 'pacific-island-nations-regional-cable-resilience-pact',
      summary: 'Twelve island governments signed a shared maintenance charter ensuring rapid deployment of repair ships for critical subsea fibre links.',
      content_html: `<p>SUVA — Communications ministers from twelve Pacific Island states endorsed a pooled subsea cable maintenance reserve on Monday, reducing reliance on distant commercial repair charters.</p><p>Regional planners noted that redundant satellite backhaul will complement undersea trunks for hospitals and emergency weather stations.</p>`,
      featured_image_url: null,
      image_caption: '',
      image_credit: '',
      author_id: authorBySlug['meera-raghavan'],
      category_id: catBySlug['world'],
      tags: ['Pacific', 'Infrastructure', 'Diplomacy'],
      featured_slot: null,
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-14T20:00:00.000Z',
    },
    {
      title: 'East African Rail Corridor Cuts Inland Freight Transit Times by Thirty Percent',
      subheadline: 'Integrated customs pre-clearance at border depots removes multi-day bottlenecks for agricultural exports.',
      slug: 'east-african-rail-corridor-cuts-freight-transit-times',
      summary: 'Unified digital manifests between inland dry ports and coastal terminals have reduced spoilage for regional horticulture shipments.',
      content_html: `<p>NAIROBI — Freight operators along the standard-gauge regional corridor reported record quarterly tonnage following the adoption of single-window customs inspection prior to train departure.</p><p>Exporters said predictable rail scheduling has opened new cold-chain contracts across Gulf and South Asian markets.</p>`,
      featured_image_url: null,
      image_caption: '',
      image_credit: '',
      author_id: authorBySlug['vikramaditya-sen'],
      category_id: catBySlug['world'],
      tags: ['Africa', 'Trade', 'Railways'],
      featured_slot: null,
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-13T18:00:00.000Z',
    },
    {
      title: 'Supreme Court Reaffirms Open-Court Transcript Standards for Constitutional Hearings',
      subheadline: 'Expanded digital archive ensures public access to live-transcribed constitutional arguments across benches.',
      slug: 'supreme-court-reaffirms-open-court-transcript-standards',
      summary: 'Lawyers and legal researchers welcomed the institutionalisation of searchable verbatim transcripts for landmark public-interest benches.',
      content_html: `<p>NEW DELHI — Judicial administration committees have expanded real-time verbatim transcription across major constitutional hearings, making argument records freely accessible within twenty-four hours.</p><p>Legal scholars noted the reform strengthens civic understanding of judicial reasoning.</p>`,
      featured_image_url: null,
      image_caption: '',
      image_credit: '',
      author_id: authorBySlug['arjun-deshmukh'],
      category_id: catBySlug['india'],
      tags: ['Judiciary', 'Transparency', 'India'],
      featured_slot: null,
      is_featured: 0,
      is_breaking: 0,
      published_at: '2026-11-14T11:00:00.000Z',
    },
  ];

  const insertArticle = db.prepare(`
    INSERT INTO articles (
      id, title, subheadline, slug, summary, content_html, featured_image_url,
      image_caption, image_credit, author_id, category_id, tags_json,
      seo_title, seo_description, status, approval_status, is_featured,
      featured_slot, is_breaking, scheduled_at, published_at, updated_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'approved', ?, ?, ?, NULL, ?, ?, ?)
  `);

  for (const a of seededArticles) {
    insertArticle.run(
      randomUUID(),
      a.title,
      a.subheadline,
      a.slug,
      a.summary,
      a.content_html,
      a.featured_image_url,
      a.image_caption,
      a.image_credit,
      a.author_id,
      a.category_id,
      JSON.stringify(a.tags),
      `${a.title} | THE CONTINENTAL`,
      a.summary,
      a.is_featured,
      a.featured_slot,
      a.is_breaking,
      a.published_at,
      now,
      now
    );
  }

  // Seed Monthly Magazine Issues (January 2027 inaugural + Feb-June 2027 upcoming planned issues)
  const janMagId = randomUUID();
  const insertMag = db.prepare(`
    INSERT INTO magazines (
      id, issue_code, title, month, year, cover_image_url, editors_note, pdf_url,
      status, approved_by_admin, scheduled_at, published_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?)
  `);

  insertMag.run(
    janMagId,
    'TC-MAG-2027-01',
    'The Inaugural Issue: Order, Energy & Accountability in 2027',
    1,
    2027,
    imgMagazine,
    'Welcome to the inaugural edition of THE CONTINENTAL MAGAZINE (January 2027). Each month, our long-form print and digital journal steps back from the hourly news cycle to examine the structural forces shaping diplomacy, constitutional governance, scientific inquiry, literature, and public life. Guided by our motto — Truth Without Fear. Facts Without Favour. — this issue opens with deep dispatches on maritime climate governance, energy storage economics, and civic archiving.',
    'upcoming',
    0,
    null,
    now
  );

  const upcomingMonths = [
    { m: 2, title: 'February 2027: Urban Futures & Water Security' },
    { m: 3, title: 'March 2027: Science, Universities & Public Research' },
    { m: 4, title: 'April 2027: Trade Corridors & Industrial Shifts' },
    { m: 5, title: 'May 2027: Literature, Press Freedom & Civil Society' },
    { m: 6, title: 'June 2027: Monsoon, Ecology & Climate Resilience' },
  ];
  for (const um of upcomingMonths) {
    insertMag.run(
      randomUUID(),
      `TC-MAG-2027-${String(um.m).padStart(2, '0')}`,
      um.title,
      um.m,
      2027,
      null,
      'Planned monthly edition. Editorial essays and final PDF will appear upon editorial completion and administrator approval.',
      'upcoming',
      0,
      null,
      now
    );
  }

  const insertMagArt = db.prepare(`
    INSERT INTO magazine_articles (id, magazine_id, title, author_name, category_name, summary, content_html, sort_order, is_featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const janArticles = [
    {
      title: 'The Architecture of Verification: Can Climate Diplomacy Outgrow Non-Binding Pledges?',
      author: 'Meera Raghavan',
      cat: 'World Affairs',
      summary: 'An in-depth examination of port-level emissions ledgers, sovereign accountability, and why treaty enforcement is moving from rhetoric to inspection.',
      order: 1,
      featured: 1,
    },
    {
      title: 'Federalism in the Age of Digital Registries',
      author: 'Arjun Deshmukh',
      cat: 'Politics',
      summary: 'How state capacity, statutory audits, and citizen grievance rights determine whether public technology empowers or excludes.',
      order: 2,
      featured: 1,
    },
    {
      title: 'Salt, Steam & Sunset: Inside the Next Decade of Baseload Renewables',
      author: 'Dr. Kavita Subramanian',
      cat: 'Science and Technology',
      summary: 'Field reporting from thermal storage facilities transforming intermittent solar arrays into round-the-clock industrial power.',
      order: 3,
      featured: 0,
    },
    {
      title: 'Letters from the Provincial Reading Rooms',
      author: 'R. K. Narayanan',
      cat: 'Literature',
      summary: 'A cultural essay on municipal libraries, vernacular print heritage, and why slow reading endures.',
      order: 4,
      featured: 0,
    },
    {
      title: 'Special Report: The New Geography of Indian Ocean Shipping',
      author: 'Vikramaditya Sen',
      cat: 'Special Reports',
      summary: 'Why deep-water rail-linked terminals are redrawing Asian maritime trade lines.',
      order: 5,
      featured: 0,
    },
  ];
  for (const ma of janArticles) {
    insertMagArt.run(
      randomUUID(),
      janMagId,
      ma.title,
      ma.author,
      ma.cat,
      ma.summary,
      `<p>${ma.summary}</p><p>Full long-form dispatch scheduled for the January 2027 edition of THE CONTINENTAL MAGAZINE.</p>`,
      ma.order,
      ma.featured
    );
  }

  // Seed E-Paper pre-launch edition record (1 January 2027) - unpublished until admin uploads PDF
  db.prepare(`
    INSERT INTO epaper_editions (
      id, edition_number, edition_date, title, pdf_url, status, approved_by_admin, scheduled_at, published_at, created_at
    ) VALUES (?, ?, ?, ?, NULL, 'upcoming', 0, NULL, NULL, ?)
  `).run(
    randomUUID(),
    'VOL. I · NO. 1',
    '2027-01-01',
    'THE CONTINENTAL — Inaugural Digital Newspaper Edition (1 January 2027)',
    now
  );

  // Seed Site Settings
  const defaultSettings: Record<string, unknown> = {
    publication_name: 'THE CONTINENTAL',
    tagline: 'Independent Journalism. Informed World.',
    motto: 'Truth Without Fear. Facts Without Favour.',
    location_label: 'INTERNATIONAL EDITION',
    launch_notice_enabled: true,
    launch_notice_text: 'Inaugural Daily E-Paper launches 1 January 2027 · Monthly Magazine Issue No. 1 arrives January 2027.',
    breaking_ticker_enabled: true,
    seo_default_title: 'THE CONTINENTAL — Independent Journalism. Informed World.',
    seo_default_description: 'Independent digital newspaper and monthly magazine. Truth Without Fear. Facts Without Favour.',
    about_story: 'THE CONTINENTAL is an independent digital newspaper and magazine committed to delivering credible, informative and accessible journalism.',
    about_mission: 'To inform readers through accurate reporting, thoughtful analysis and responsible journalism.',
    about_vision: 'To build a trusted independent publication connecting readers with important developments across the world.',
    editorial_policy: `THE CONTINENTAL operates under a strict commitment to factual accuracy, editorial independence, and public accountability.\n\n1. Verification Before Publication: Every report, data point, and quotation is corroborated through primary records or direct attribution prior to publication.\n2. Separation of News and Opinion: News dispatches adhere to neutral, evidence-led reporting. Opinion columns and contributed essays are clearly labelled and reflect informed perspectives without compromising factual integrity.\n3. Review of Public Contributions: All external writing submitted via Publish Your Writing undergoes formal editorial screening for originality, clarity, and adherence to our standards before approval.\n4. Independence From Undue Influence: Editorial decisions rest solely with the editorial desk and are insulated from commercial, partisan, or external pressure.`,
    corrections_policy: `Accuracy is central to THE CONTINENTAL's credibility. When an error of fact occurs, we correct it promptly, transparently, and visibly.\n\n1. Timely Corrections: Factual errors in headlines, figures, names, or context are updated immediately upon verification.\n2. Correction Notes: Substantive corrections include a dated editorial note at the foot of the article explaining what was amended and when (in Asia/Kolkata IST).\n3. Reader Submissions: Readers may report potential inaccuracies through our Contact Us desk for prompt editorial review.`,
    privacy_policy: `THE CONTINENTAL respects reader privacy and collects only the minimum information required to operate our publishing services.\n\n1. Newsletter Subscriptions: Email addresses submitted for newsletter updates are stored solely to deliver publication notices and may be unsubscribed at any time.\n2. Public Writing Submissions: Contributor contact details are used strictly for editorial correspondence and verification. Internal editorial notes are never published.\n3. Contact Messages: Messages sent via the Contact Us page are retained solely for editorial or administrative response.\n4. Security: Administrative sessions use encrypted password hashing and protected server-side authorization.`,
    terms_conditions: `By accessing THE CONTINENTAL (thecontinental.dhpc.in), you agree to the following terms of use.\n\n1. Intellectual Property: Published articles, e-paper editions, and monthly magazine issues remain the copyright of THE CONTINENTAL and respective credited contributors.\n2. Originality of Submissions: Contributors submitting via Publish Your Writing affirm that their work is original, unpublished elsewhere unless explicitly disclosed, and free of plagiarism or unlawful material.\n3. Editorial Discretion: Submission of an article does not guarantee publication. THE CONTINENTAL reserves the right to edit, request revisions, approve, or decline any submission.\n4. Responsible Use: Automated scraping, abusive traffic, or unauthorised redistribution of full editions is prohibited.`,
  };

  const insertSetting = db.prepare('INSERT INTO site_settings (key, value_json, updated_at) VALUES (?, ?, ?)');
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, JSON.stringify(v), now);
  }
}
