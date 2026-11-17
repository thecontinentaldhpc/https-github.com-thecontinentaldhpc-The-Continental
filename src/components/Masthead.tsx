import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { formatNewsUpdatedLabel } from '../lib/dateIst';
import { BrandLogo } from './BrandLogo';

const PRIMARY_SECTIONS = [
  { label: 'Home', to: '/' },
  { label: 'World', to: '/world' },
  { label: 'India', to: '/india' },
  { label: 'Regional', to: '/regional' },
  { label: 'Politics', to: '/politics' },
  { label: 'Business', to: '/business' },
  { label: 'Economy', to: '/economy' },
  { label: 'Education', to: '/education' },
  { label: 'Science & Tech', to: '/science-technology' },
  { label: 'Environment', to: '/environment' },
  { label: 'Sports', to: '/sports' },
  { label: 'Opinion', to: '/opinion' },
  { label: 'Editorial', to: '/editorial' },
];

const MORE_LINKS = [
  { label: 'Saved Reading List', to: '/reading-list' },
  { label: 'Monthly Magazine', to: '/magazine' },
  { label: 'Digital E-Paper', to: '/epaper' },
  { label: 'Publish Your Writing', to: '/publish-your-writing' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact Us', to: '/contact' },
  { label: 'Editorial Policy', to: '/editorial-policy' },
  { label: 'Corrections Policy', to: '/corrections-policy' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Terms & Conditions', to: '/terms' },
];

export function Masthead() {
  const { settings, istDate, editionUpdatedAt, user, isAdmin, readingList, signOutUser, openLoginModal, theme, toggleTheme } =
    useSite();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const isDark = theme === 'dark';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    setSearchOpen(false);
    setMobileMenuOpen(false);
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  const handleSignOut = async () => {
    await signOutUser();
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="bg-white dark:bg-[#121212] border-b border-neutral-200 dark:border-neutral-800 no-print transition-colors duration-150">
      {/* Launch Notice Strip (Admin-controlled) */}
      {settings.launch_notice_enabled && settings.launch_notice_text && (
        <div className="bg-[#111111] dark:bg-[#1b1b1b] text-neutral-100 text-xs py-1.5 px-4 text-center tracking-wide border-b border-transparent dark:border-neutral-800">
          <span className="font-medium text-[#e6b8bb] dark:text-[#eb7a80] uppercase tracking-widest mr-2">
            Publication Notice
          </span>
          <span>{settings.launch_notice_text}</span>
        </div>
      )}

      {/* Top Date & Utility Bar */}
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">
          <div className="flex items-center gap-x-2.5 gap-y-0.5 flex-wrap tabular-nums">
            <time dateTime={istDate.isoDate} className="font-semibold tracking-wider text-neutral-900 dark:text-neutral-100 uppercase">
              {istDate.formattedMasthead}
            </time>
            <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">·</span>
            <span className="font-medium text-neutral-700 dark:text-neutral-300" data-testid="masthead-ist-time">
              {istDate.currentTimeIst}
            </span>
            {editionUpdatedAt && (
              <>
                <span aria-hidden="true" className="hidden md:inline text-neutral-300 dark:text-neutral-700">·</span>
                <span
                  data-testid="masthead-news-updated"
                  className="hidden md:inline text-[11px] font-medium text-neutral-600 dark:text-neutral-400"
                >
                  Updated {formatNewsUpdatedLabel(editionUpdatedAt, new Date(istDate.nowMs)).combined}
                </span>
              </>
            )}
            {settings.location_label && (
              <>
                <span aria-hidden="true" className="hidden xl:inline text-neutral-300 dark:text-neutral-700">·</span>
                <span className="hidden xl:inline uppercase tracking-wider text-[11px] text-neutral-500 dark:text-neutral-400">
                  {settings.location_label}
                </span>
              </>
            )}
          </div>

          <div className="flex md:hidden items-center gap-3 text-xs font-medium text-neutral-700 dark:text-neutral-300 shrink-0">
            {user ? (
              isAdmin ? (
                <Link to="/admin" className="font-semibold text-[#8C1D24] dark:text-[#eb7a80] hover:underline">
                  Admin
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openLoginModal()}
                  className="font-semibold text-neutral-900 dark:text-neutral-100 hover:text-[#8C1D24] dark:hover:text-[#eb7a80]"
                >
                  {user.fullName.split(' ')[0]}
                </button>
              )
            ) : (
              <button
                type="button"
                data-testid="mobile-topbar-login-btn"
                onClick={() => openLoginModal()}
                className="font-semibold text-neutral-900 dark:text-neutral-100 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] underline underline-offset-4"
              >
                Login
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center gap-5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
            <Link to="/epaper" className="hover:text-[#8C1D24] dark:hover:text-[#eb7a80] transition-colors whitespace-nowrap shrink-0">
              E-Paper
            </Link>
            <Link to="/magazine" className="hover:text-[#8C1D24] dark:hover:text-[#eb7a80] transition-colors whitespace-nowrap shrink-0">
              Magazine
            </Link>
            <Link
              to="/publish-your-writing"
              className="text-[#8C1D24] dark:text-[#eb7a80] font-semibold hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Publish Your Writing
            </Link>
            <Link to="/about" className="hover:text-[#8C1D24] dark:hover:text-[#eb7a80] transition-colors whitespace-nowrap shrink-0">
              About
            </Link>
            {user ? (
              <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
                <Link
                  to="/reading-list"
                  data-testid="masthead-reading-list-link"
                  className="text-neutral-800 dark:text-neutral-200 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] font-semibold transition-colors"
                >
                  Reading List{readingList.length > 0 ? ` (${readingList.length})` : ''}
                </Link>
                {isAdmin ? (
                  <Link
                    to="/admin"
                    className="font-semibold text-[#8C1D24] dark:text-[#eb7a80] hover:underline underline-offset-4"
                  >
                    Admin Console
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => openLoginModal()}
                    className="text-neutral-700 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white font-medium"
                    title={user.email || user.phoneNumber || ''}
                  >
                    {user.fullName}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="masthead-login-btn"
                onClick={() => openLoginModal()}
                className="text-neutral-800 dark:text-neutral-200 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Monumental Masthead */}
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-4 md:py-5">
        <div className="grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          {/* Left: Mobile Menu Trigger */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-neutral-800 dark:text-neutral-200 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] focus-visible:outline-2 focus-visible:outline-[#8C1D24]"
              aria-label="Open navigation menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Center: Masthead Logo, Tagline & Motto */}
          <div className="flex flex-col items-center text-center min-w-0">
            <Link
              to="/"
              aria-label={settings.publication_name}
              className="inline-flex items-center justify-center group focus-visible:outline-2 focus-visible:outline-[#8C1D24]"
            >
              <BrandLogo
                alt={settings.publication_name}
                className="h-12 sm:h-16 lg:h-[76px] w-auto max-w-[170px] sm:max-w-[260px] lg:max-w-[300px]"
              />
            </Link>
            <p className="mt-1.5 text-[10px] sm:text-xs tracking-[0.2em] uppercase text-neutral-600 dark:text-neutral-400 font-medium">
              {settings.tagline}
            </p>
            <p className="mt-1 font-serif italic text-xs sm:text-[13px] text-neutral-800 dark:text-neutral-300">
              {settings.motto}
            </p>
          </div>

          {/* Right: Theme Toggle & Search Trigger */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5">
            <button
              type="button"
              data-testid="theme-toggle-btn"
              onClick={toggleTheme}
              aria-pressed={isDark}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 dark:hover:border-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-neutral-700" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Toggle search bar"
              aria-expanded={searchOpen}
              className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 dark:hover:border-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </div>

        {/* Inline Expandable Search Bar */}
        {searchOpen && (
          <form onSubmit={handleSearchSubmit} className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2 max-w-2xl mx-auto">
            <label htmlFor="masthead-search-input" className="sr-only">
              Search articles, magazine issues, and e-paper editions
            </label>
            <input
              id="masthead-search-input"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search headlines, topics, authors, magazine, or e-paper..."
              className="flex-1 bg-white dark:bg-[#1a1a1a] border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-300"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#8C1D24] text-white text-sm font-semibold hover:bg-[#70151b] transition-colors whitespace-nowrap shrink-0"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search bar"
              className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* Broadsheet Horizontal Section Bar (Desktop) */}
      <nav aria-label="Primary Sections" className="hidden lg:block border-t border-b border-neutral-900 dark:border-neutral-700 bg-white dark:bg-[#141414]">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            {PRIMARY_SECTIONS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-2.5 py-1 text-[13px] font-semibold tracking-wide transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#8C1D24] dark:text-[#eb7a80] underline decoration-2 underline-offset-8'
                      : 'text-neutral-800 dark:text-neutral-200 hover:text-[#8C1D24] dark:hover:text-[#eb7a80]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMoreOpen((p) => !p)}
              aria-expanded={moreOpen}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[13px] font-semibold text-neutral-800 dark:text-neutral-200 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] whitespace-nowrap shrink-0"
            >
              <span>Editions & Policies</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {moreOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-60 bg-white dark:bg-[#1a1a1a] border border-neutral-300 dark:border-neutral-700 shadow-lg z-50 py-1.5"
                onMouseLeave={() => setMoreOpen(false)}
              >
                {MORE_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMoreOpen(false)}
                    className="block px-4 py-2 text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#262626] hover:text-[#8C1D24] dark:hover:text-[#eb7a80]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Slide-Out Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            aria-label="Mobile Navigation"
            className="relative w-80 max-w-[85vw] bg-white dark:bg-[#151515] h-full overflow-y-auto shadow-xl flex flex-col border-r border-neutral-200 dark:border-neutral-800"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                aria-label={settings.publication_name}
                className="inline-flex items-center"
              >
                <BrandLogo alt={settings.publication_name} className="h-9 w-auto" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex gap-2">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search publication..."
                aria-label="Search publication"
                className="flex-1 bg-white dark:bg-[#1e1e1e] border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
              />
              <button type="submit" className="px-3 py-2 bg-[#8C1D24] text-white text-xs font-semibold">
                Go
              </button>
            </form>

            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Appearance
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#1f1f1f] text-xs font-semibold text-neutral-900 dark:text-neutral-100"
              >
                {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>

            <div className="px-4 py-3 space-y-1 border-b border-neutral-200 dark:border-neutral-800">
              <p className="text-[11px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 pb-1">Sections</p>
              {PRIMARY_SECTIONS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] border-b border-neutral-100 dark:border-neutral-800 last:border-0"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="px-4 py-3 space-y-1">
              <p className="text-[11px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 pb-1">
                Publications & Desk
              </p>
              {MORE_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:text-[#8C1D24] dark:hover:text-[#eb7a80]"
                >
                  {link.label}
                </Link>
              ))}
              {user ? (
                <div className="pt-2 mt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-1">
                  <p className="py-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Signed in as <strong className="text-neutral-900 dark:text-neutral-100">{user.fullName}</strong>
                  </p>
                  <Link
                    to="/reading-list"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100 hover:text-[#8C1D24] dark:hover:text-[#eb7a80]"
                  >
                    Reading List{readingList.length > 0 ? ` (${readingList.length})` : ''}
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-2 text-sm font-semibold text-[#8C1D24] dark:text-[#eb7a80] hover:underline"
                    >
                      Admin Console
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="block py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white text-left w-full"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="mobile-login-btn"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openLoginModal();
                  }}
                  className="block py-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] text-left w-full"
                >
                  Login
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
