export type MobileTabId = 'home' | 'dashboard' | 'console' | 'plugins' | 'menu';

const ROUTE_MATCHERS: ReadonlyArray<{ id: Exclude<MobileTabId, 'menu'>; prefixes: string[] }> = [
  { id: 'home', prefixes: ['/home'] },
  { id: 'dashboard', prefixes: ['/dashboard'] },
  { id: 'console', prefixes: ['/console'] },
  { id: 'plugins', prefixes: ['/plugins', '/plugin-view'] },
];

export function resolveMobileTabId(pathname: string, isMenuOpen = false): MobileTabId {
  if (isMenuOpen) {
    return 'menu';
  }
  for (const matcher of ROUTE_MATCHERS) {
    if (
      matcher.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ) {
      return matcher.id;
    }
  }
  return 'menu';
}
