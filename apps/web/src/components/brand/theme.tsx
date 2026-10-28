import { Role } from '@telesales/shared';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

/**
 * Look of the app. 「さくら」 is the pink theme with the girl MoraBot, asked for by the
 * telemarketing team at the 10/27 test; it is their default and anyone can switch.
 */
export type Theme = 'standard' | 'sakura';

const LAST_KEY = 'telesales.theme.last';
const userKey = (userId: string) => `telesales.theme.${userId}`;

function read(key: string): Theme | null {
  try {
    const value = localStorage.getItem(key);
    return value === 'sakura' || value === 'standard' ? value : null;
  } catch {
    return null;
  }
}

function write(key: string, theme: Theme) {
  try {
    localStorage.setItem(key, theme);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

/** Telemarketing starts in sakura; everyone else in the standard look. */
export function defaultTheme(roles: readonly Role[]): Theme {
  return roles.includes(Role.Telema) || roles.includes(Role.TelemaLead) ? 'sakura' : 'standard';
}

/** Before login (sign-in page): the look last used in this browser. */
export function lastTheme(): Theme {
  return read(LAST_KEY) ?? 'standard';
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/** Outside a provider (or before login) the theme cannot be changed. */
const keep = (): void => undefined;

const ThemeContext = createContext<ThemeState>({ theme: 'standard', setTheme: keep });

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}

/** For signed-in screens: the person's saved choice, else the default for their roles. */
export function ThemeProvider({
  userId,
  roles,
  children,
}: {
  userId: string;
  roles: readonly Role[];
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(
    () => read(userKey(userId)) ?? defaultTheme(roles),
  );
  useEffect(() => {
    apply(theme);
    write(LAST_KEY, theme);
  }, [theme]);
  const setTheme = (next: Theme) => {
    write(userKey(userId), next);
    setThemeState(next);
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

/** For the sign-in screens: shows the last look, without a way to change it. */
export function LastThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useState(lastTheme);
  useEffect(() => apply(theme), [theme]);
  return (
    <ThemeContext.Provider value={{ theme, setTheme: keep }}>{children}</ThemeContext.Provider>
  );
}
