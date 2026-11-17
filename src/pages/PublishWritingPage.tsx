import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Lock, Mail, Upload, X } from 'lucide-react';
import { api } from '../lib/api';
import { useSite } from '../context/SiteContext';
import { NOTIFICATION_EMAIL } from '../lib/editorialRules';
import { notifyViaWeb3FormsInBackground } from '../lib/web3forms';
import { BrandLogo } from '../components/BrandLogo';

type GateMode = 'register' | 'signin';

export function PublishWritingPage() {
  const {
    categories,
    user,
    authLoading,
    registerUser,
    loginWithPassword,
    signInWithGoogle,
    signOutUser,
    openLoginModal,
  } = useSite();

  // Inline writer authentication state when !user
  const [gateMode, setGateMode] = useState<GateMode>('register');
  const [gateName, setGateName] = useState('');
  const [gateEmail, setGateEmail] = useState('');
  const [gatePassword, setGatePassword] = useState('');
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // Article manuscript form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [content, setContent] = useState('');
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
  const [authorBio, setAuthorBio] = useState('');
  const [originalityConfirmed, setOriginalityConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Publish Your Writing | THE CONTINENTAL';
  }, []);

  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      const opinionCat = categories.find((c) => c.slug === 'opinion');
      setCategoryId(opinionCat ? opinionCat.id : categories[0].id);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setFullName((prev) => prev || user.fullName);
    }
  }, [user]);

  const handleGateGoogleLogin = async () => {
    setGateError(null);
    setSigningInGoogle(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in with Google.';
      setGateError(
        msg.includes('popup') || msg.includes('unauthorized-domain')
          ? 'Google Sign-In popup was blocked in this browser window. Create a writer account or sign in with your email below.'
          : msg
      );
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleGateEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);
    setGateSubmitting(true);
    try {
      if (gateMode === 'register') {
        await registerUser({
          fullName: gateName,
          email: gateEmail,
          password: gatePassword,
        });
      } else {
        await loginWithPassword({
          email: gateEmail,
          password: gatePassword,
        });
      }
    } catch (err) {
      setGateError(err instanceof Error ? err.message : 'Unable to authenticate contributor account.');
    } finally {
      setGateSubmitting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const res = await api.uploadPublicImage(file);
      setFeaturedImageUrl(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 6) {
      setError('Article title must be at least 6 characters.');
      return;
    }
    if (shortDescription.trim().length < 10) {
      setError('Short description must be at least 10 characters.');
      return;
    }
    if (content.trim().length < 50) {
      setError('Full article content must be at least 50 characters.');
      return;
    }
    if (authorBio.trim().length < 10) {
      setError('Author biography must be at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitWriting({
        full_name: fullName,
        email: user?.email || email,
        title,
        category_id: categoryId,
        short_description: shortDescription,
        content,
        featured_image_url: featuredImageUrl,
        author_bio: authorBio,
        originality_confirmed: originalityConfirmed,
        terms_accepted: termsAccepted,
        website_honeypot: honeypot,
      });

      const categoryName = categories.find((c) => c.id === categoryId)?.name || categoryId;
      notifyViaWeb3FormsInBackground({
        eventType: 'New Submission',
        userName: fullName,
        userEmail: user?.email || email,
        userPhone: user?.phoneNumber,
        subject: `[THE CONTINENTAL] New Submission (${res.submissionId}): ${title}`,
        message: `Title: ${title}\nCategory: ${categoryName}\n\nSummary:\n${shortDescription}\n\nAuthor Bio:\n${authorBio}`,
        metadata: {
          'Submission ID': res.submissionId,
          Category: categoryName,
        },
      });

      setSubmittedId(res.submissionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit article.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedId) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-14">
        <div className="border-2 border-neutral-950 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] p-8 sm:p-10">
          <BrandLogo className="h-10 sm:h-12 w-auto mb-5" />
          <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-400 mb-4">
            <CheckCircle2 className="w-7 h-7" />
            <span className="text-xs font-bold uppercase tracking-widest">Submission Recorded</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-neutral-950 dark:text-neutral-100">
            Your article has been successfully submitted to THE CONTINENTAL.
          </h1>
          <div className="mt-5 space-y-3 text-base text-neutral-800 dark:text-neutral-200 leading-relaxed">
            <p>Thank you for contributing.</p>
            <p>
              Our editorial team will review your submission. An editorial alert has been dispatched to{' '}
              <span className="font-mono text-sm font-semibold text-neutral-950 dark:text-neutral-100">{NOTIFICATION_EMAIL}</span>. If selected, your article will be published after editorial approval.
            </p>
            <p className="pt-3 border-t border-neutral-300 dark:border-neutral-700 font-mono text-sm font-semibold text-[#8C1D24] dark:text-[#eb7a80]">
              Submission ID: {submittedId}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setSubmittedId(null);
                setTitle('');
                setShortDescription('');
                setContent('');
                setFeaturedImageUrl(null);
                setOriginalityConfirmed(false);
                setTermsAccepted(false);
              }}
              className="px-5 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors"
            >
              Submit Another Article
            </button>
            <Link
              to="/"
              className="px-5 py-2.5 border border-neutral-900 dark:border-neutral-400 text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 transition-colors"
            >
              Return to Front Page
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="border-b-2 border-neutral-950 dark:border-neutral-700 pb-5 mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">Open Editorial Desk</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-neutral-950 dark:text-neutral-100 mt-1">
          PUBLISH YOUR WRITING
        </h1>
        <p className="font-prose text-lg text-neutral-700 dark:text-neutral-300 mt-3 leading-relaxed">
          Have a perspective, an idea or a story worth sharing? THE CONTINENTAL welcomes original contributions from writers, students, researchers and independent contributors.
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
          Contributor login required. Every submission triggers an editorial notification to {NOTIFICATION_EMAIL} and undergoes formal review prior to publication.
        </p>
      </div>

      {authLoading ? (
        <div className="border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] p-8 text-center text-sm text-neutral-600 dark:text-neutral-400">
          Checking contributor session...
        </div>
      ) : !user ? (
        <section
          data-testid="write-login-gate"
          className="border-2 border-neutral-950 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] p-6 sm:p-10 max-w-2xl"
        >
          <BrandLogo className="h-10 w-auto mb-4" />
          <div className="flex items-center gap-2.5 text-[#8C1D24] dark:text-[#eb7a80] mb-3">
            <Lock className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">Contributor Authentication</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-950 dark:text-neutral-100">
            Sign in or Register to Publish Your Writing
          </h2>
          <p className="font-prose text-base text-neutral-700 dark:text-neutral-300 mt-2.5 leading-relaxed">
            Sign in with Google, Email, or Phone Number to open the manuscript submission form immediately.
          </p>

          <div className="mt-4">
            <button
              type="button"
              data-testid="write-open-login-modal-btn"
              onClick={() => openLoginModal('/publish-your-writing')}
              className="px-5 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors"
            >
              Open Login Panel (Google, Email &amp; Phone)
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold">
            <button
              type="button"
              data-testid="gate-tab-register"
              onClick={() => {
                setGateMode('register');
                setGateError(null);
              }}
              className={`py-2.5 px-3 text-center transition-colors ${
                gateMode === 'register'
                  ? 'bg-[#8C1D24] text-white'
                  : 'bg-white dark:bg-[#1a1a1a] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#242424]'
              }`}
            >
              Create Writer Account
            </button>
            <button
              type="button"
              data-testid="gate-tab-signin"
              onClick={() => {
                setGateMode('signin');
                setGateError(null);
              }}
              className={`py-2.5 px-3 text-center border-l border-neutral-300 dark:border-neutral-700 transition-colors ${
                gateMode === 'signin'
                  ? 'bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950'
                  : 'bg-white dark:bg-[#1a1a1a] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#242424]'
              }`}
            >
              Writer Sign In
            </button>
          </div>

          <form onSubmit={handleGateEmailAuth} className="mt-4 bg-white dark:bg-[#141414] border border-neutral-300 dark:border-neutral-700 p-5 space-y-4">
            {gateMode === 'register' && (
              <div>
                <label htmlFor="gate-fullname" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                  Full Name *
                </label>
                <input
                  id="gate-fullname"
                  type="text"
                  required
                  minLength={2}
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  placeholder="e.g. Ananya Sharma"
                  className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="gate-email" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                  Email Address *
                </label>
                <input
                  id="gate-email"
                  type="email"
                  required
                  value={gateEmail}
                  onChange={(e) => setGateEmail(e.target.value)}
                  placeholder="writer@example.com"
                  className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
                />
              </div>
              <div>
                <label htmlFor="gate-password" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1">
                  Password *
                </label>
                <input
                  id="gate-password"
                  type="password"
                  required
                  minLength={gateMode === 'register' ? 6 : 1}
                  value={gatePassword}
                  onChange={(e) => setGatePassword(e.target.value)}
                  placeholder={gateMode === 'register' ? 'Minimum 6 characters' : 'Enter your password'}
                  className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
                />
              </div>
            </div>

            {gateError && (
              <p role="alert" className="text-xs font-medium text-[#8C1D24] dark:text-[#eb7a80]">
                {gateError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                data-testid="gate-submit-btn"
                disabled={gateSubmitting}
                className="px-6 py-2.5 bg-[#8C1D24] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#6e151a] transition-colors disabled:opacity-50"
              >
                {gateSubmitting
                  ? 'Please wait...'
                  : gateMode === 'register'
                    ? 'Register & Start Writing'
                    : 'Sign In to Write'}
              </button>

              <button
                type="button"
                disabled={signingInGoogle}
                onClick={handleGateGoogleLogin}
                className="px-5 py-2.5 border border-neutral-900 dark:border-neutral-400 bg-white dark:bg-transparent text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 transition-colors disabled:opacity-50"
              >
                {signingInGoogle ? 'Connecting...' : 'Continue with Google'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] px-4 py-3 text-xs">
            <span className="text-neutral-700 dark:text-neutral-300">
              Submitting as <strong className="text-neutral-950 dark:text-neutral-100">{user.fullName}</strong> ({user.email || user.phoneNumber})
            </span>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="text-[#8C1D24] dark:text-[#eb7a80] font-semibold hover:underline"
            >
              Switch Account / Logout
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Honeypot anti-spam field */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website_honeypot">Leave blank</label>
              <input
                id="website_honeypot"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="sub-name" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1.5">
                  1. Full Name *
                </label>
                <input
                  id="sub-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ananya Sharma"
                  className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3.5 py-2.5 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
                />
              </div>

              <div>
                <label htmlFor="sub-email" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1.5">
                  {user.email ? '2. Signed-in Email Address *' : '2. Contact Email Address *'}
                </label>
                <input
                  id="sub-email"
                  type="email"
                  required
                  readOnly={Boolean(user.email)}
                  value={user.email || email}
                  onChange={(e) => {
                    if (!user.email) setEmail(e.target.value);
                  }}
                  placeholder="contributor@example.com"
                  className={`w-full border border-neutral-300 dark:border-neutral-700 px-3.5 py-2.5 text-sm focus:outline-none ${
                    user.email
                      ? 'bg-neutral-100 dark:bg-[#1e1e1e] text-neutral-700 dark:text-neutral-300'
                      : 'bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:border-neutral-900 dark:focus:border-neutral-400'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="sm:col-span-2">
                <label htmlFor="sub-title" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1.5">
                  3. Article Title *
                </label>
                <input
                  id="sub-title"
                  type="text"
                  required
                  minLength={6}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Clear, accurate editorial headline (min 6 characters)"
                  className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3.5 py-2.5 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
                />
              </div>

              <div>
                <label htmlFor="sub-category" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1.5">
                  4. Article Category *
                </label>
                <select
                  id="sub-category"
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-neutral-300 dark:border-neutral-700 px-3.5 py-2.5 text-sm bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="sub-desc" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  5. Short Description / Standfirst *
                </label>
                <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                  {shortDescription.trim().length} / 10+ chars
                </span>
              </div>
              <textarea
                id="sub-desc"
                required
                minLength={10}
                rows={2}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="A concise summary of your argument or report (minimum 10 characters)."
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3.5 py-2.5 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="sub-content" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  6. Full Article Content *
                </label>
                <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                  {content.trim().length} / 50+ chars
                </span>
              </div>
              <textarea
                id="sub-content"
                required
                minLength={50}
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write or paste your full manuscript here (minimum 50 characters). Separate paragraphs with a blank line."
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3.5 py-3 text-sm font-prose leading-relaxed focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>

            <div>
              <label htmlFor="sub-image" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-1.5">
                7. Optional Featured Image (JPEG, PNG, or WebP, max 4 MB)
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <label
                  htmlFor="sub-image"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 dark:hover:border-neutral-400 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{uploadingImage ? 'Uploading...' : 'Choose Image File'}</span>
                </label>
                <input
                  id="sub-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  className="sr-only"
                />
                {featuredImageUrl && (
                  <div className="flex items-center gap-3 border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] p-2">
                    <img
                      src={featuredImageUrl}
                      alt="Uploaded article visual preview"
                      referrerPolicy="no-referrer"
                      className="w-16 h-12 object-cover border border-neutral-200 dark:border-neutral-700"
                    />
                    <span className="text-xs text-emerald-800 dark:text-emerald-400 font-medium">Image attached</span>
                    <button
                      type="button"
                      onClick={() => setFeaturedImageUrl(null)}
                      aria-label="Remove uploaded image"
                      className="text-neutral-600 dark:text-neutral-400 hover:text-[#8C1D24] dark:hover:text-[#eb7a80]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="sub-bio" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  8. Author Biography *
                </label>
                <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                  {authorBio.trim().length} / 10+ chars
                </span>
              </div>
              <textarea
                id="sub-bio"
                required
                minLength={10}
                rows={2}
                value={authorBio}
                onChange={(e) => setAuthorBio(e.target.value)}
                placeholder="Briefly state your background, affiliation, or areas of research (minimum 10 characters)."
                className="w-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 px-3.5 py-2.5 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>

            <div className="border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] p-5 space-y-3">
              <label className="flex items-start gap-2.5 text-sm text-neutral-800 dark:text-neutral-200 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={originalityConfirmed}
                  onChange={(e) => setOriginalityConfirmed(e.target.checked)}
                  className="mt-1 accent-[#8C1D24]"
                />
                <span>
                  9. <strong>Originality Confirmation:</strong> I confirm this manuscript is my original work, does not infringe copyright, and factual assertions are accurately verified.
                </span>
              </label>

              <label className="flex items-start gap-2.5 text-sm text-neutral-800 dark:text-neutral-200 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 accent-[#8C1D24]"
                />
                <span>
                  10. <strong>Submission Terms:</strong> I agree to THE CONTINENTAL’s{' '}
                  <Link to="/editorial-policy" className="underline text-[#8C1D24] dark:text-[#eb7a80]">
                    Editorial Policy
                  </Link>{' '}
                  and{' '}
                  <Link to="/terms" className="underline text-[#8C1D24] dark:text-[#eb7a80]">
                    Terms and Conditions
                  </Link>
                  . I understand publication is subject to editorial approval.
                </span>
              </label>

              <p className="pt-2 border-t border-neutral-200 dark:border-neutral-700 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                <Mail className="w-3.5 h-3.5 text-[#8C1D24] dark:text-[#eb7a80] shrink-0" />
                <span>
                  On submission, an automated notification email is sent directly to{' '}
                  <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">{NOTIFICATION_EMAIL}</span>.
                </span>
              </p>
            </div>

            {error && (
              <p role="alert" className="text-sm font-medium text-[#8C1D24] dark:text-[#eb7a80]">
                {error}
              </p>
            )}

            <button
              type="submit"
              data-testid="submit-article-btn"
              disabled={submitting}
              className="px-8 py-3 bg-[#8C1D24] text-white text-sm font-semibold uppercase tracking-wider hover:bg-[#6d141a] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting Manuscript...' : 'Submit Article for Editorial Review'}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
