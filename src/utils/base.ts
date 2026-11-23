/** Path the app is served under: "/" locally, e.g. "/tools/dramatis/" on thatbio.vercel.app (set by APP_BASE at build time). */
export const BASE: string = import.meta.env.BASE_URL;

/** Prefixes a root-relative path like "/assets/x.png" or "/api/..." with the base path. Other URLs pass through. */
export function withBase(path: string): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return path;
  return BASE + path.slice(1);
}
