"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyAdminOnSubmissionCreated = exports.notifyAdminOnNewsletterSubscribe = exports.notifyAdminOnUserProfileCreated = exports.notifyAdminOnUserRegister = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const functionsV1 = __importStar(require("firebase-functions/v1"));
const firestore_2 = require("firebase-functions/v2/firestore");
const emailNotifier_1 = require("./emailNotifier");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)(emailNotifier_1.FIRESTORE_DATABASE_ID);
const FUNCTION_REGION = 'asia-southeast1';
/**
 * Trigger 1: Firebase Authentication user registration trigger.
 * Fires whenever a new user account is created in Firebase Auth and sends an email
 * notification to artifex.alexx@gmail.com.
 */
exports.notifyAdminOnUserRegister = functionsV1
    .region(FUNCTION_REGION)
    .auth.user()
    .onCreate(async (user) => {
    const email = (user.email || '').trim().toLowerCase();
    const phoneNumber = (user.phoneNumber || '').trim();
    if (!email && !phoneNumber) {
        logger.info('Skipping registration email notification because user record has no email or phone', { uid: user.uid });
        return;
    }
    const emailContent = (0, emailNotifier_1.buildUserRegisteredEmail)({
        uid: user.uid,
        email,
        phoneNumber,
        displayName: user.displayName,
        providerIds: user.providerData?.map((p) => p.providerId).filter(Boolean) || [],
        createdAt: user.metadata?.creationTime || new Date().toISOString(),
    });
    const result = await (0, emailNotifier_1.deliverAdminEmailNotification)({
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
        recipient: emailNotifier_1.NOTIFICATION_RECIPIENT_EMAIL,
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
 * registrations still trigger an email alert to artifex.alexx@gmail.com.
 */
exports.notifyAdminOnUserProfileCreated = (0, firestore_2.onDocumentCreated)({
    document: 'users/{userId}/private/{docId}',
    database: emailNotifier_1.FIRESTORE_DATABASE_ID,
    region: FUNCTION_REGION,
}, async (event) => {
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
    let displayName;
    try {
        const publicSnap = await db.collection('users').doc(userId).get();
        const publicData = publicSnap.data();
        if (publicData && typeof publicData.displayName === 'string') {
            displayName = publicData.displayName;
        }
    }
    catch {
        // Non-fatal; fallback to identifier
    }
    const emailContent = (0, emailNotifier_1.buildUserRegisteredEmail)({
        uid: userId,
        email: hasEmail ? data.email : undefined,
        phoneNumber: hasPhone ? data.phoneNumber : undefined,
        displayName,
        providerIds: ['firestore_profile'],
    });
    const result = await (0, emailNotifier_1.deliverAdminEmailNotification)({
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
        recipient: emailNotifier_1.NOTIFICATION_RECIPIENT_EMAIL,
        userId,
        skippedDuplicate: result.skippedDuplicate,
        deliveryStatus: result.delivery.status,
    });
});
/**
 * Trigger 3: Firestore trigger for newsletter subscriptions.
 * Fires whenever a reader subscribes (document created with status='active') or
 * re-subscribes (status transitions from non-active to 'active'), sending an email
 * notification to artifex.alexx@gmail.com.
 */
exports.notifyAdminOnNewsletterSubscribe = (0, firestore_2.onDocumentWritten)({
    document: 'newsletter_subscribers/{subscriberId}',
    database: emailNotifier_1.FIRESTORE_DATABASE_ID,
    region: FUNCTION_REGION,
}, async (event) => {
    const after = event.data?.after?.data();
    if (!after || after.status !== 'active' || typeof after.email !== 'string') {
        return;
    }
    const before = event.data?.before?.data();
    if (before && before.status === 'active') {
        return;
    }
    const subscriberId = event.params.subscriberId;
    const subscribedAt = after.subscribedAt && typeof after.subscribedAt.toDate === 'function'
        ? after.subscribedAt.toDate().toISOString()
        : new Date().toISOString();
    const emailContent = (0, emailNotifier_1.buildNewsletterSubscribedEmail)({
        subscriberId,
        email: after.email,
        source: typeof after.source === 'string' ? after.source : 'web_signup',
        subscribedAt,
    });
    const result = await (0, emailNotifier_1.deliverAdminEmailNotification)({
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
        recipient: emailNotifier_1.NOTIFICATION_RECIPIENT_EMAIL,
        subscriberId,
        skippedDuplicate: result.skippedDuplicate,
        deliveryStatus: result.delivery.status,
        provider: result.delivery.provider,
        error: result.delivery.error || null,
    });
});
/**
 * Trigger 4: Firestore trigger for article manuscript submissions ("Publish Your Writing").
 * Fires whenever a submission document is created in `submissions/{submissionId}` and
 * sends an email notification to artifex.alexx@gmail.com.
 */
exports.notifyAdminOnSubmissionCreated = (0, firestore_2.onDocumentCreated)({
    document: 'submissions/{submissionId}',
    database: emailNotifier_1.FIRESTORE_DATABASE_ID,
    region: FUNCTION_REGION,
}, async (event) => {
    const data = event.data?.data();
    if (!data || typeof data.title !== 'string' || typeof data.authorEmail !== 'string') {
        return;
    }
    const submissionId = event.params.submissionId;
    const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString();
    const emailContent = (0, emailNotifier_1.buildSubmissionReceivedEmail)({
        submissionId,
        submissionCode: typeof data.submissionCode === 'string' ? data.submissionCode : submissionId,
        title: data.title,
        authorName: typeof data.authorName === 'string' ? data.authorName : 'Contributor',
        authorEmail: data.authorEmail,
        categoryId: typeof data.categoryId === 'string' ? data.categoryId : 'general',
        createdAt,
    });
    const result = await (0, emailNotifier_1.deliverAdminEmailNotification)({
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
        recipient: emailNotifier_1.NOTIFICATION_RECIPIENT_EMAIL,
        submissionId,
        skippedDuplicate: result.skippedDuplicate,
        deliveryStatus: result.delivery.status,
        provider: result.delivery.provider,
        error: result.delivery.error || null,
    });
});
//# sourceMappingURL=index.js.map