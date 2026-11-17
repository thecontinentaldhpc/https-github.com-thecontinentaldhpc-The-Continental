import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db';
import { isAdminEmail, isNotificationRecipientEmail } from '../lib/editorialRules';

const SECRET_FILE = path.resolve(process.cwd(), 'data', '.session_secret');

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  }
  const generated = randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
  fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  return generated;
}

const SESSION_SECRET = getSessionSecret();
export const SESSION_COOKIE_NAME = 'tc_admin_session';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const actualBuf = scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}

interface SessionPayload {
  userId: string;
  email: string;
  phoneNumber?: string | null;
  role: 'super_admin' | 'reader';
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  const expectedSig = createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');

  const bufA = Buffer.from(providedSig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    if (parsed.role !== 'super_admin' && parsed.role !== 'reader') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

export interface SessionUser {
  id: string;
  uid?: string | null;
  email: string;
  phoneNumber?: string | null;
  fullName: string;
  role: 'super_admin' | 'reader';
  photoUrl?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: SessionUser;
  admin?: SessionUser;
}

export function extractSessionToken(req: Request): string | undefined {
  const xSessionToken = req.headers['x-session-token'];
  if (typeof xSessionToken === 'string' && xSessionToken.trim()) {
    return xSessionToken.trim();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
}

export function buildSessionCookieHeader(req: Request, token: string, maxAgeSeconds: number = 60 * 60 * 24 * 7): string {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const sameSiteAttr = isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${sameSiteAttr}; Max-Age=${maxAgeSeconds}`;
}

function resolveAuthenticatedUser(req: Request): SessionUser | null {
  const token = extractSessionToken(req);
  const payload = verifySessionToken(token);
  if (!payload) return null;

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

  if (!row) return null;

  const email = row.email || '';
  const effectiveRole: 'super_admin' | 'reader' =
    row.role === 'super_admin' && isAdminEmail(email) ? 'super_admin' : 'reader';

  return {
    id: row.id,
    uid: row.firebase_uid,
    email,
    phoneNumber: row.phone_number || null,
    fullName: row.full_name,
    role: effectiveRole,
    photoUrl: row.photo_url,
  };
}

export function requireUser(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const user = resolveAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Please log in first to continue.' });
    return;
  }
  req.user = user;
  if (user.role === 'super_admin') {
    req.admin = user;
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const user = resolveAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }
  if (user.role !== 'super_admin' || !isAdminEmail(user.email)) {
    res.status(403).json({
      error: 'Administrator access is restricted to thecontinental.dhpc@gmail.com.',
    });
    return;
  }

  req.user = user;
  req.admin = user;
  next();
}

export function requireAdminOrNotificationRecipient(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const user = resolveAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required to access mail notifications.' });
    return;
  }
  const allowedAdmin = user.role === 'super_admin' && isAdminEmail(user.email);
  const allowedInboxOwner = isNotificationRecipientEmail(user.email);
  if (!allowedAdmin && !allowedInboxOwner) {
    res.status(403).json({
      error: 'Notification inbox access is restricted to thecontinental.dhpc@gmail.com.',
    });
    return;
  }

  req.user = user;
  if (allowedAdmin) {
    req.admin = user;
  }
  next();
}

export function logAudit(
  actorEmail: string,
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  ipAddress: string = ''
): void {
  db.prepare(
    'INSERT INTO audit_logs (id, actor_email, action, entity_type, entity_id, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(randomUUID(), actorEmail, action, entityType, entityId, details, ipAddress, new Date().toISOString());
}

// Simple in-memory sliding window rate limiter
const rateBuckets = new Map<string, number[]>();

export function rateLimit(keyPrefix: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const history = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (history.length >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
      });
      return;
    }
    history.push(now);
    rateBuckets.set(key, history);
    next();
  };
}
