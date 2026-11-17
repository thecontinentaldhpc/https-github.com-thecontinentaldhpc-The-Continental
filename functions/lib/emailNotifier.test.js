"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const emailNotifier_1 = require("./emailNotifier");
(0, node_test_1.default)('buildUserRegisteredEmail targets artifex.alexx@gmail.com and escapes HTML content', () => {
    const payload = (0, emailNotifier_1.buildUserRegisteredEmail)({
        uid: 'uid-123',
        email: 'writer@example.com',
        displayName: '<script>alert("xss")</script> Meera',
        providerIds: ['google.com'],
        createdAt: '2026-11-16T08:45:00.000Z',
    });
    strict_1.default.equal(payload.to, 'artifex.alexx@gmail.com');
    strict_1.default.equal(payload.to, emailNotifier_1.NOTIFICATION_RECIPIENT_EMAIL);
    strict_1.default.notEqual(payload.to, 'thecontinental.dhpc@gmail.com');
    strict_1.default.match(payload.subject, /New User Registration:/);
    strict_1.default.match(payload.text, /writer@example\.com/);
    strict_1.default.ok(!payload.html.includes('<script>alert'));
    strict_1.default.ok(payload.html.includes((0, emailNotifier_1.escapeHtml)('<script>alert("xss")</script>')));
});
(0, node_test_1.default)('buildUserRegisteredEmail supports phone-number registration without email', () => {
    const payload = (0, emailNotifier_1.buildUserRegisteredEmail)({
        uid: 'uid-phone-1',
        phoneNumber: '+919876543210',
        displayName: 'Phone Reader',
        providerIds: ['phone'],
        createdAt: '2026-11-16T08:45:00.000Z',
    });
    strict_1.default.equal(payload.to, 'artifex.alexx@gmail.com');
    strict_1.default.equal(payload.actorEmail, '+919876543210');
    strict_1.default.match(payload.subject, /\+919876543210/);
    strict_1.default.match(payload.text, /Phone: \+919876543210/);
});
(0, node_test_1.default)('buildNewsletterSubscribedEmail targets artifex.alexx@gmail.com with no subscription fee', () => {
    const payload = (0, emailNotifier_1.buildNewsletterSubscribedEmail)({
        subscriberId: 'sub-abc',
        email: 'Reader@Example.com',
        source: 'sidebar_form',
        subscribedAt: '2026-11-16T08:50:00.000Z',
    });
    strict_1.default.equal(payload.to, 'artifex.alexx@gmail.com');
    strict_1.default.equal(payload.actorEmail, 'reader@example.com');
    strict_1.default.equal(payload.subject, 'New Newsletter Subscriber: reader@example.com');
    strict_1.default.ok(!payload.text.includes('Fee'));
    strict_1.default.ok(!payload.text.includes('₹1'));
    strict_1.default.ok(!payload.html.includes('Subscription Fee'));
    strict_1.default.match(payload.text, /sidebar_form/);
});
(0, node_test_1.default)('buildSubmissionReceivedEmail targets artifex.alexx@gmail.com and escapes manuscript HTML', () => {
    const payload = (0, emailNotifier_1.buildSubmissionReceivedEmail)({
        submissionId: 'TC-SUB-20261116-9999',
        title: 'Parliamentary Oversight & <b>Public</b> Finance',
        authorName: 'Ananya Sharma',
        authorEmail: 'Ananya@Example.com',
        categoryId: 'cat-politics',
        createdAt: '2026-11-16T09:00:00.000Z',
    });
    strict_1.default.equal(payload.to, 'artifex.alexx@gmail.com');
    strict_1.default.equal(payload.actorEmail, 'ananya@example.com');
    strict_1.default.match(payload.subject, /TC-SUB-20261116-9999/);
    strict_1.default.match(payload.text, /Ananya Sharma/);
    strict_1.default.ok(!payload.html.includes('<b>Public</b>'));
    strict_1.default.ok(payload.html.includes((0, emailNotifier_1.escapeHtml)('<b>Public</b>')));
});
(0, node_test_1.default)('deliverAdminEmailNotification sends once to artifex.alexx@gmail.com and skips duplicate retries', async () => {
    const store = new Map();
    const sentEmails = [];
    const mockDb = {
        collection: (name) => ({
            doc: (id) => ({ key: `${name}/${id}` }),
        }),
        runTransaction: async (fn) => {
            const tx = {
                get: async (ref) => ({ exists: store.has(ref.key) }),
                set: (ref, data) => {
                    store.set(ref.key, data);
                },
            };
            return fn(tx);
        },
    };
    const emailPayload = (0, emailNotifier_1.buildNewsletterSubscribedEmail)({
        subscriberId: 'sub-1',
        email: 'reader@example.com',
    });
    const first = await (0, emailNotifier_1.deliverAdminEmailNotification)({
        db: mockDb,
        notificationId: 'fn_newsletter_sub-1_evt1',
        eventType: 'newsletter_subscribe',
        actorUid: 'newsletter_sub-1',
        actorEmail: emailPayload.actorEmail,
        actorName: emailPayload.actorName,
        subject: emailPayload.subject,
        summaryMessage: emailPayload.summaryMessage,
        emailPayload,
        sender: async (p) => {
            sentEmails.push(p);
            return { sent: true, provider: 'smtp', status: 'emailed_via_smtp' };
        },
    });
    strict_1.default.equal(first.skippedDuplicate, false);
    strict_1.default.equal(first.delivery.sent, true);
    strict_1.default.equal(sentEmails.length, 1);
    strict_1.default.equal(sentEmails[0].to, 'artifex.alexx@gmail.com');
    const second = await (0, emailNotifier_1.deliverAdminEmailNotification)({
        db: mockDb,
        notificationId: 'fn_newsletter_sub-1_evt1',
        eventType: 'newsletter_subscribe',
        actorUid: 'newsletter_sub-1',
        actorEmail: emailPayload.actorEmail,
        actorName: emailPayload.actorName,
        subject: emailPayload.subject,
        summaryMessage: emailPayload.summaryMessage,
        emailPayload,
        sender: async (p) => {
            sentEmails.push(p);
            return { sent: true, provider: 'smtp', status: 'emailed_via_smtp' };
        },
    });
    strict_1.default.equal(second.skippedDuplicate, true);
    strict_1.default.equal(second.delivery.status, 'duplicate_skipped');
    strict_1.default.equal(sentEmails.length, 1);
});
//# sourceMappingURL=emailNotifier.test.js.map