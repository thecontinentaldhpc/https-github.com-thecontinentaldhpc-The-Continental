import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THEME_STORAGE_KEY,
  applyThemeToRoot,
  getNextTheme,
  isValidThemeMode,
  resolveInitialTheme,
} from './theme';

test('isValidThemeMode accepts only light and dark', () => {
  assert.equal(isValidThemeMode('light'), true);
  assert.equal(isValidThemeMode('dark'), true);
  assert.equal(isValidThemeMode('sepia'), false);
  assert.equal(isValidThemeMode(null), false);
  assert.equal(isValidThemeMode(undefined), false);
});

test('resolveInitialTheme honors valid stored preference over system preference', () => {
  assert.equal(THEME_STORAGE_KEY, 'tc_theme');
  assert.equal(resolveInitialTheme('dark', false), 'dark');
  assert.equal(resolveInitialTheme('light', true), 'light');
});

test('resolveInitialTheme falls back to system preference when stored value is missing or invalid', () => {
  assert.equal(resolveInitialTheme(null, false), 'light');
  assert.equal(resolveInitialTheme(null, true), 'dark');
  assert.equal(resolveInitialTheme('invalid-mode', true), 'dark');
  assert.equal(resolveInitialTheme('', false), 'light');
});

test('getNextTheme alternates between light and dark', () => {
  assert.equal(getNextTheme('light'), 'dark');
  assert.equal(getNextTheme('dark'), 'light');
});

test('applyThemeToRoot toggles dark class and updates colorScheme', () => {
  const toggles: Array<{ token: string; force?: boolean }> = [];
  const mockRoot = {
    classList: {
      toggle(token: string, force?: boolean) {
        toggles.push({ token, force });
      },
    },
    style: { colorScheme: 'light' },
  };

  applyThemeToRoot(mockRoot, 'dark');
  assert.deepEqual(toggles[0], { token: 'dark', force: true });
  assert.equal(mockRoot.style.colorScheme, 'dark');

  applyThemeToRoot(mockRoot, 'light');
  assert.deepEqual(toggles[1], { token: 'dark', force: false });
  assert.equal(mockRoot.style.colorScheme, 'light');
});
