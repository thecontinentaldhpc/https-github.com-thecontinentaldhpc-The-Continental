import { useState } from 'react';
import { BrandLogo } from './BrandLogo';

interface EditorialImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  aspectClass?: string;
}

export function EditorialImage({ src, alt, className = '', aspectClass = 'aspect-[4/3]' }: EditorialImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center bg-neutral-100 dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 select-none ${aspectClass} ${className}`}
        role="img"
        aria-label={alt}
      >
        <BrandLogo decorative className="h-8 w-auto opacity-35 mb-2" />
        <span className="text-[11px] uppercase tracking-widest text-neutral-400 dark:text-neutral-500 px-4 text-center line-clamp-2">
          {alt || 'THE CONTINENTAL'}
        </span>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-neutral-100 dark:bg-[#1e1e1e] ${aspectClass} ${className}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
      />
    </div>
  );
}
