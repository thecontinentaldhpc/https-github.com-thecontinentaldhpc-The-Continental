export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type ApprovalStatus = 'pending' | 'approved';
export type FeaturedSlot = 'lead' | 'top_story' | 'section_feature' | null;

export type SubmissionStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Revision Requested'
  | 'Approved'
  | 'Rejected'
  | 'Published';

export type EditionStatus = 'upcoming' | 'draft' | 'scheduled' | 'published' | 'archived';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  show_in_nav: number;
}

export interface Author {
  id: string;
  name: string;
  slug: string;
  role_title: string;
  bio: string;
  avatar_url: string | null;
  email: string | null;
}

export interface Article {
  id: string;
  title: string;
  subheadline: string;
  slug: string;
  summary: string;
  content_html: string;
  featured_image_url: string | null;
  image_caption: string;
  image_credit: string;
  author_id: string;
  author_name?: string;
  author_role?: string;
  author_bio?: string;
  author_slug?: string;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
  status: ArticleStatus;
  approval_status: ApprovalStatus;
  is_featured: boolean;
  featured_slot: FeaturedSlot;
  is_breaking: boolean;
  scheduled_at: string | null;
  published_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface PublicSubmission {
  id: string;
  submission_code: string;
  full_name: string;
  email: string;
  title: string;
  category_id: string;
  category_name?: string;
  short_description: string;
  content_html: string;
  featured_image_url: string | null;
  author_bio: string;
  originality_confirmed: boolean;
  terms_accepted: boolean;
  status: SubmissionStatus;
  internal_notes: string;
  published_article_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MagazineArticleItem {
  id: string;
  magazine_id: string;
  title: string;
  author_name: string;
  category_name: string;
  summary: string;
  content_html: string;
  sort_order: number;
  is_featured: boolean;
}

export interface MagazineIssue {
  id: string;
  issue_code: string;
  title: string;
  month: number;
  year: number;
  cover_image_url: string | null;
  editors_note: string;
  pdf_url: string | null;
  status: EditionStatus;
  approved_by_admin: boolean;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  articles?: MagazineArticleItem[];
}

export interface EpaperEdition {
  id: string;
  edition_number: string;
  edition_date: string; // YYYY-MM-DD in IST
  title: string;
  pdf_url: string | null;
  status: EditionStatus;
  approved_by_admin: boolean;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  alt_text: string;
  credit: string;
  uploaded_by: string;
  created_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  consent_given: boolean;
  fee_inr?: number;
  status: 'active' | 'unsubscribed';
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  admin_notes: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export interface SiteSettings {
  publication_name: string;
  tagline: string;
  motto: string;
  location_label: string;
  launch_notice_enabled: boolean;
  launch_notice_text: string;
  breaking_ticker_enabled: boolean;
  seo_default_title: string;
  seo_default_description: string;
  about_story: string;
  about_mission: string;
  about_vision: string;
  editorial_policy: string;
  corrections_policy: string;
  privacy_policy: string;
  terms_conditions: string;
}

export type UserRole = 'reader' | 'super_admin';

export interface AuthUser {
  id: string;
  uid?: string | null;
  email: string;
  phoneNumber?: string | null;
  fullName: string;
  role: UserRole;
  photoUrl?: string | null;
}

export interface AdminNotification {
  id: string;
  event_type: 'user_login' | 'user_registered' | 'newsletter_subscribe' | 'submission_received' | 'contact_message';
  recipient_email: string;
  actor_email: string;
  actor_name: string;
  subject: string;
  message: string;
  delivery_status: string;
  is_read: boolean;
  created_at: string;
}

export interface SavedArticleItem {
  id: string;
  userId: string;
  articleId: string;
  slug: string;
  title: string;
  summary: string;
  categoryName: string;
  categorySlug: string;
  authorName: string;
  featuredImageUrl?: string | null;
  publishedAt: string;
  savedAt: string;
}
