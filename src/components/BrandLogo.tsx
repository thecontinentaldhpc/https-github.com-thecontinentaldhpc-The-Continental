export const LOGO_SRC = '/assets/aistudio/THEAA_5329c333.png';

export interface BrandLogoProps {
  alt?: string;
  tone?: 'auto' | 'light' | 'dark';
  className?: string;
  decorative?: boolean;
}

export function BrandLogo({
  alt = 'THE CONTINENTAL',
  tone = 'auto',
  className = 'h-12 w-auto',
  decorative = false,
}: BrandLogoProps) {
  const toneClass =
    tone === 'light'
      ? 'brightness-0 invert'
      : tone === 'dark'
        ? ''
        : 'dark:brightness-0 dark:invert';

  return (
    <img
      src={LOGO_SRC}
      alt={decorative ? '' : alt}
      aria-hidden={decorative ? true : undefined}
      width={4856}
      height={1672}
      decoding="async"
      className={`object-contain select-none shrink-0 transition-[filter] duration-150 ${toneClass} ${className}`}
    />
  );
}
