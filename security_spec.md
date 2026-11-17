# Security Specification — THE CONTINENTAL Firestore Rules

## 1. Data Invariants
1. **Default Deny**: All unmatched paths deny read and write access (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Administrator Privilege Gate**: `isAdmin()` evaluates strictly to `isSignedIn() && request.auth.token.email_verified == true && request.auth.token.email == 'thecontinental.dhpc@gmail.com'` (or an explicit `/admins/$(request.auth.uid)` record). Non-admin users can never self-assign `role: 'super_admin'`.
4. **PII Isolation**: User email addresses are stored in `/users/{userId}/private/info` and are readable only by the document owner (`request.auth.uid == userId`) or `isAdmin()`.
5. **Writer Submission Ownership**: Authenticated users may only create submissions where `authorUid == request.auth.uid`, initial `status == 'Submitted'`, and may only read/list their own submissions (`resource.data.authorUid == request.auth.uid`) unless `isAdmin()`.
6. **Notification Inbox Isolation**: Authenticated users may create alerts addressed strictly to `recipientEmail == 'thecontinental.dhpc@gmail.com'` with `actorUid == request.auth.uid` and `isRead == false`; only `isAdmin()` or `isNotificationRecipient()` (`thecontinental.dhpc@gmail.com`) can read, list, or mark read alerts, and only `isAdmin()` can delete them.
7. **Temporal & Immutable Integrity**: `createdAt` is locked to `request.time` on create and immutable on update (`incoming().createdAt == existing().createdAt`); `updatedAt` is locked to `request.time` on update.
8. **Saved Articles / Reading List Ownership**: Under `/users/{userId}/saved_articles/{articleId}`, only the verified owner (`isOwner(userId)`) with an existing `/users/{userId}` profile document may create saved article references (`id == articleId`, `userId == userId`, `savedAt == request.time`), and only the owner or `isAdmin()` may read or delete them.

## 2. Adversarial Payloads Guarded Against ("Dirty Dozen")
1. Unauthenticated read/write on `/users/{userId}` -> `PERMISSION_DENIED`
2. Non-admin reading another user's `/users/{otherId}/private/info` -> `PERMISSION_DENIED`
3. User self-assigning `role: 'super_admin'` without verified `thecontinental.dhpc@gmail.com` token -> `PERMISSION_DENIED`
4. Shadow field injection (`{ isVerified: true }`) on `/users/{userId}` -> `PERMISSION_DENIED` (blocked by `hasOnly`)
5. Spoofed `authorUid` on `/submissions/{id}` create -> `PERMISSION_DENIED`
6. Submission status shortcutting (`status: 'Published'`) on create by contributor -> `PERMISSION_DENIED`
7. Oversized ID poisoning (`> 128` chars or non-alphanumeric chars) -> `PERMISSION_DENIED` (`isValidId`)
8. Unverified email (`email_verified == false`) attempting admin read -> `PERMISSION_DENIED`
9. Client timestamp tampering (`createdAt` or `savedAt` backdated) -> `PERMISSION_DENIED` (`== request.time`)
10. Non-admin / non-owner listing `/admin_notifications` -> `PERMISSION_DENIED`
11. Mutating immutable `owner`/`actorUid`/`createdAt`/`savedAt` during update -> `PERMISSION_DENIED`
12. Redirecting `recipientEmail` away from `thecontinental.dhpc@gmail.com` -> `PERMISSION_DENIED`
13. Reading, writing, or deleting another user's `/users/{otherId}/saved_articles/{articleId}` or spoofing `userId` -> `PERMISSION_DENIED`
14. Shadow field injection or oversized `title` (`> 300` chars) on `/users/{userId}/saved_articles/{articleId}` -> `PERMISSION_DENIED`
