export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tc_theme';

export function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function resolveInitialTheme(
  storedValue: string | null | undefined,
  prefersDarkSystem: boolean
): ThemeMode {
  if (isValidThemeMode(storedValue)) {
    return storedValue;
  }
  return prefersDarkSystem ? 'dark' : 'light';
}

export function getNextTheme(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}

export function applyThemeToRoot(
  root: { classList: { toggle: (token: string, force?: boolean) => void }; style?: { colorScheme: string } } | null | undefined,
  theme: ThemeMode
): void {
  if (!root) return;
  root.classList.toggle('dark', theme === 'dark');
  if (root.style) {
    root.style.colorScheme = theme;
  }
}

export function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    stored = null;
  }
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return resolveInitialTheme(stored, prefersDark);
}

export function persistTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage restrictions (private mode / sandboxed iframe)
  }
}
