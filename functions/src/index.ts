import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import * as functionsV1 from 'firebase-functions/v1';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import {
  NOTIFICATION_RECIPIENT_EMAIL,
  buildNewsletterSubscribedEmail,
  buildSubmissionReceivedEmail,
  buildUserRegisteredEmail,
  deliverAdminEmailNotification,
  FIRESTORE_DATABASE_ID,
} from './emailNotifier';

initializeApp();
const db = getFirestore(FIRESTORE_DATABASE_ID);

const FUNCTION_REGION = 'asia-southeast1';

/**
 * Trigger 1: Firebase Authentication user registration trigger.
 * Fires whenever a new user account is created in Firebase Auth and sends an email
 * notification to thecontinental.dhpc@gmail.com.
 */
export const notifyAdminOnUserRegister = functionsV1
  .region(FUNCTION_REGION)
  .auth.user()
  .onCreate(async (user) => {
    const email = (user.email || '').trim().toLowerCase();
    const phoneNumber = (user.phoneNumber || '').trim();
    if (!email && !phoneNumber) {
      logger.info('Skipping registration email notification because user record has no email or phone', { uid: user.uid });
      return;
    }

    const emailContent = buildUserRegisteredEmail({
      uid: user.uid,
      email,
      phoneNumber,
      displayName: user.displayName,
      providerIds: user.providerData?.map((p) => p.providerId).filter(Boolean) || [],
      createdAt: user.metadata?.creationTime || new Date().toISOString(),
    });

    const result = await deliverAdminEmailNotification({
      db,
      notificationId: `fn_user_reg_${user.uid}`,
      eventType: 'user_registered',
      actorUid: user.uid,
      actorEmail: emailContent.actorEmail,
      actorName: emailContent.actorName,
      subject: emailContent.subject,
      summaryMessage: emailContent.summaryMessage,
      emailPayload: emailContent,
    });

    logger.info('Processed Firebase Auth user registration notification', {
      recipient: NOTIFICATION_RECIPIENT_EMAIL,
      uid: user.uid,
      skippedDuplicate: result.skippedDuplicate,
      deliveryStatus: result.delivery.status,
      provider: result.delivery.provider,
      error: result.delivery.error || null,
    });
  });

/**
 * Trigger 2: Firestore backup trigger for newly created user private PII documents.
 * Uses the same deterministic notification ID (`fn_user_reg_<uid>`) so users registering
 * via Auth + Firestore never generate duplicate emails, while direct Firestore profile
 * registrations still trigger an email alert to thecontinental.dhpc@gmail.com.
 */
export const notifyAdminOnUserProfileCreated = onDocumentCreated(
  {
    document: 'users/{userId}/private/{docId}',
    database: FIRESTORE_DATABASE_ID,
    region: FUNCTION_REGION,
  },
  async (event) => {
    if (event.params.docId !== 'info') {
      return;
    }

    const data = event.data?.data();
    const hasEmail = data && typeof data.email === 'string' && data.email.trim().length > 0;
    const hasPhone = data && typeof data.phoneNumber === 'string' && data.phoneNumber.trim().length > 0;
    if (!data || (!hasEmail && !hasPhone)) {
      return;
    }

    const userId = event.params.userId;
    let displayName: string | undefined;
    try {
      const publicSnap = await db.collection('users').doc(userId).get();
      const publicData = publicSnap.data();
      if (publicData && typeof publicData.displayName === 'string') {
        displayName = publicData.displayName;
      }
    } catch {
      // Non-fatal; fallback to identifier
    }

    const emailContent = buildUserRegisteredEmail({
      uid: userId,
      email: hasEmail ? data.email : undefined,
      phoneNumber: hasPhone ? data.phoneNumber : undefined,
      displayName,
      providerIds: ['firestore_profile'],
    });

    const result = await deliverAdminEmailNotification({
      db,
      notificationId: `fn_user_reg_${userId}`,
      eventType: 'user_registered',
      actorUid: userId,
      actorEmail: emailContent.actorEmail,
      actorName: emailContent.actorName,
      subject: emailContent.subject,
      summaryMessage: emailContent.summaryMessage,
      emailPayload: emailContent,
    });

    logger.info('Processed Firestore user profile registration notification', {
      recipient: NOTIFICATION_RECIPIENT_EMAIL,
      userId,
      skippedDuplicate: result.skippedDuplicate,
      deliveryStatus: result.delivery.status,
    });
  }
);

/**
 * Trigger 3: Firestore trigger for newsletter subscriptions.
 * Fires whenever a reader subscribes (document created with status='active') or
 * re-subscribes (status transitions from non-active to 'active'), sending an email
 * notification to thecontinental.dhpc@gmail.com.
 */
export const notifyAdminOnNewsletterSubscribe = onDocumentWritten(
  {
    document: 'newsletter_subscribers/{subscriberId}',
    database: FIRESTORE_DATABASE_ID,
    region: FUNCTION_REGION,
  },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after || after.status !== 'active' || typeof after.email !== 'string') {
      return;
    }

    const before = event.data?.before?.data();
    if (before && before.status === 'active') {
      return;
    }

    const subscriberId = event.params.subscriberId;
    const subscribedAt =
      after.subscribedAt && typeof after.subscribedAt.toDate === 'function'
        ? after.subscribedAt.toDate().toISOString()
        : new Date().toISOString();

    const emailContent = buildNewsletterSubscribedEmail({
      subscriberId,
      email: after.email,
      source: typeof after.source === 'string' ? after.source : 'web_signup',
      subscribedAt,
    });

    const result = await deliverAdminEmailNotification({
      db,
      notificationId: `fn_newsletter_${subscriberId}_${event.id}`,
      eventType: 'newsletter_subscribe',
      actorUid: `newsletter_${subscriberId}`,
      actorEmail: emailContent.actorEmail,
      actorName: emailContent.actorName,
      subject: emailContent.subject,
      summaryMessage: emailContent.summaryMessage,
      emailPayload: emailContent,
    });

    logger.info('Processed newsletter subscription email notification', {
      recipient: NOTIFICATION_RECIPIENT_EMAIL,
      subscriberId,
      skippedDuplicate: result.skippedDuplicate,
      deliveryStatus: result.delivery.status,
      provider: result.delivery.provider,
      error: result.delivery.error || null,
    });
  }
);

/**
 * Trigger 4: Firestore trigger for article manuscript submissions ("Publish Your Writing").
 * Fires whenever a submission document is created in `submissions/{submissionId}` and
 * sends an email notification to thecontinental.dhpc@gmail.com.
 */
export const notifyAdminOnSubmissionCreated = onDocumentCreated(
  {
    document: 'submissions/{submissionId}',
    database: FIRESTORE_DATABASE_ID,
    region: FUNCTION_REGION,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || typeof data.title !== 'string' || typeof data.authorEmail !== 'string') {
      return;
    }

    const submissionId = event.params.submissionId;
    const createdAt =
      data.createdAt && typeof data.createdAt.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString();

    const emailContent = buildSubmissionReceivedEmail({
      submissionId,
      submissionCode: typeof data.submissionCode === 'string' ? data.submissionCode : submissionId,
      title: data.title,
      authorName: typeof data.authorName === 'string' ? data.authorName : 'Contributor',
      authorEmail: data.authorEmail,
      categoryId: typeof data.categoryId === 'string' ? data.categoryId : 'general',
      createdAt,
    });

    const result = await deliverAdminEmailNotification({
      db,
      notificationId: `fn_sub_${submissionId}`,
      eventType: 'submission_received',
      actorUid: typeof data.authorUid === 'string' ? data.authorUid : `sub_${submissionId}`,
      actorEmail: emailContent.actorEmail,
      actorName: emailContent.actorName,
      subject: emailContent.subject,
      summaryMessage: emailContent.summaryMessage,
      emailPayload: emailContent,
    });

    logger.info('Processed article submission email notification', {
      recipient: NOTIFICATION_RECIPIENT_EMAIL,
      submissionId,
      skippedDuplicate: result.skippedDuplicate,
      deliveryStatus: result.delivery.status,
      provider: result.delivery.provider,
      error: result.delivery.error || null,
    });
  }
);
