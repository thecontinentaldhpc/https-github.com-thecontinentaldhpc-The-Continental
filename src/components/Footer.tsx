import { Link } from 'react-router-dom';
import { useSite } from '../context/SiteContext';
import { BrandLogo } from './BrandLogo';

export function Footer() {
  const { settings, istDate, openLoginModal } = useSite();

  return (
    <footer className="bg-[#111111] dark:bg-[#0c0c0c] text-neutral-300 border-t-4 border-[#8C1D24] mt-16 no-print">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-10 border-b border-neutral-800">
          {/* Identity */}
          <div>
            <Link to="/" aria-label={settings.publication_name} className="inline-block">
              <BrandLogo alt={settings.publication_name} tone="light" className="h-12 sm:h-14 w-auto" />
            </Link>
            <p className="text-xs uppercase tracking-widest text-neutral-400 mt-3">{settings.tagline}</p>
            <p className="font-serif italic text-sm text-neutral-200 mt-2">“{settings.motto}”</p>
            <p className="text-xs text-neutral-400 mt-4 leading-relaxed">
              Official Website: https://thecontinental.dhpc.in
              <br />
              First Newspaper Edition: 1 January 2027
              <br />
              First Monthly Magazine: January 2027
            </p>
          </div>

          {/* News Sections */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white mb-4">
              News & Coverage
            </h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <li><Link to="/world" className="hover:text-white transition-colors">World</Link></li>
              <li><Link to="/india" className="hover:text-white transition-colors">India</Link></li>
              <li><Link to="/regional" className="hover:text-white transition-colors">Regional</Link></li>
              <li><Link to="/politics" className="hover:text-white transition-colors">Politics</Link></li>
              <li><Link to="/business" className="hover:text-white transition-colors">Business</Link></li>
              <li><Link to="/economy" className="hover:text-white transition-colors">Economy</Link></li>
              <li><Link to="/education" className="hover:text-white transition-colors">Education</Link></li>
              <li><Link to="/science-technology" className="hover:text-white transition-colors">Science & Tech</Link></li>
              <li><Link to="/environment" className="hover:text-white transition-colors">Environment</Link></li>
              <li><Link to="/sports" className="hover:text-white transition-colors">Sports</Link></li>
              <li><Link to="/opinion" className="hover:text-white transition-colors">Opinion</Link></li>
              <li><Link to="/editorial" className="hover:text-white transition-colors">Editorial</Link></li>
            </ul>
          </div>

          {/* Publications & Participation */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white mb-4">
              Publications & Desk
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/epaper" className="hover:text-white transition-colors">Digital Newspaper / E-Paper</Link></li>
              <li><Link to="/magazine" className="hover:text-white transition-colors">The Continental Magazine</Link></li>
              <li><Link to="/reading-list" className="hover:text-white transition-colors">Saved Reading List</Link></li>
              <li><Link to="/publish-your-writing" className="text-[#e6b8bb] hover:text-white transition-colors font-medium">Publish Your Writing</Link></li>
              <li><Link to="/search" className="hover:text-white transition-colors">Search Archives</Link></li>
              <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Editorial Standards & Governance */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white mb-4">
              Standards & Policies
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/editorial-policy" className="hover:text-white transition-colors">Editorial Policy</Link></li>
              <li><Link to="/corrections-policy" className="hover:text-white transition-colors">Corrections Policy</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms and Conditions</Link></li>
              <li>
                <button
                  type="button"
                  onClick={() => openLoginModal()}
                  className="hover:text-white transition-colors text-left"
                >
                  Login
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <p>© {istDate.year} THE CONTINENTAL. All rights reserved.</p>
          <p className="tabular-nums">
            Edition Clock: Asia/Kolkata (IST) · {istDate.formattedDateOnly} · {istDate.currentTimeIst}
          </p>
        </div>
      </div>
    </footer>
  );
}
