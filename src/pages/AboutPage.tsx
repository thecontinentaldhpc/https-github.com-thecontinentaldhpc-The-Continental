import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../context/SiteContext';
import { BrandLogo } from '../components/BrandLogo';

const PRINCIPLES = [
  'Accuracy',
  'Independence',
  'Fairness',
  'Transparency',
  'Accountability',
  'Responsible reporting',
  'Respect for different perspectives',
];

const PUBLICATIONS = [
  { title: 'Digital Newspaper (E-Paper)', desc: 'Full broadsheet daily edition launching 1 January 2027.' },
  { title: 'Daily News', desc: 'International, National, and Regional reporting verified by our editorial desk.' },
  { title: 'Monthly Magazine', desc: 'Long-form essays, special reports, culture, and interviews launching January 2027.' },
  { title: 'Editorials', desc: 'The institutional stance of THE CONTINENTAL on matters of public importance.' },
  { title: 'Opinion', desc: 'Reasoned analysis and diverse perspectives from independent scholars and observers.' },
  { title: 'Independent Contributions', desc: 'Original submissions welcomed via Publish Your Writing and subject to editorial review.' },
];

export function AboutPage() {
  const { settings } = useSite();

  useEffect(() => {
    document.title = 'About Us | THE CONTINENTAL';
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      <div className="border-b-2 border-neutral-950 dark:border-neutral-200 pb-5">
        <BrandLogo className="h-14 sm:h-16 w-auto mb-4" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8C1D24] dark:text-[#eb7a80]">Institutional Charter</p>
        <h1 className="font-serif text-4xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">About THE CONTINENTAL</h1>
        <p className="font-serif italic text-xl text-neutral-700 dark:text-neutral-300 mt-3">“{settings.motto}”</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">Our Story</h2>
        <p className="font-prose text-lg text-neutral-900 dark:text-neutral-200 leading-relaxed">{settings.about_story}</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-y border-neutral-300 dark:border-neutral-800 py-8">
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">Our Mission</h2>
          <p className="font-prose text-base text-neutral-800 dark:text-neutral-300 leading-relaxed">{settings.about_mission}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">Our Vision</h2>
          <p className="font-prose text-base text-neutral-800 dark:text-neutral-300 leading-relaxed">{settings.about_vision}</p>
        </section>
      </div>

      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">Our Editorial Principles</h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRINCIPLES.map((p, idx) => (
            <li key={p} className="border border-neutral-200 dark:border-neutral-800 px-4 py-3 flex items-center gap-3">
              <span className="font-mono text-xs text-[#8C1D24] dark:text-[#eb7a80] font-semibold">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span className="font-serif font-semibold text-neutral-900 dark:text-neutral-100">{p}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="border border-neutral-950 dark:border-neutral-600 bg-[#FAF9F6] dark:bg-[#181818] p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8C1D24] dark:text-[#eb7a80]">Our Motto</p>
        <p className="font-serif text-2xl sm:text-3xl font-bold text-neutral-950 dark:text-neutral-50 mt-2">
          “Truth Without Fear. Facts Without Favour.”
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">Our Publications</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PUBLICATIONS.map((pub) => (
            <div key={pub.title} className="border border-neutral-200 dark:border-neutral-800 p-5 bg-white dark:bg-[#181818]">
              <h3 className="font-serif text-lg font-bold text-neutral-950 dark:text-neutral-50">{pub.title}</h3>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1.5 leading-relaxed">{pub.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-wider">
        <Link to="/editorial-policy" className="text-[#8C1D24] dark:text-[#eb7a80] hover:underline">Editorial Policy</Link>
        <Link to="/corrections-policy" className="text-[#8C1D24] dark:text-[#eb7a80] hover:underline">Corrections Policy</Link>
        <Link to="/publish-your-writing" className="text-[#8C1D24] dark:text-[#eb7a80] hover:underline">Publish Your Writing</Link>
        <Link to="/contact" className="text-[#8C1D24] dark:text-[#eb7a80] hover:underline">Contact Us</Link>
      </div>
    </main>
  );
}
