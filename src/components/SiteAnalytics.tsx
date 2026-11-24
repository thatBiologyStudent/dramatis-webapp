import { Analytics } from '@vercel/analytics/react';
import { withBase } from '../utils/base';

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

/**
 * Vercel Web Analytics (cookieless page views, no personal data, nothing from your characters).
 * Script and endpoint follow the base path, so when Dramatis is shown inside another site
 * (/tools/dramatis/ on thatbio.vercel.app via a rewrite) the views count for this project,
 * not the host site. Off on local copies (Start Dramatis.bat).
 */
export function SiteAnalytics() {
  if (isLocal) return null;
  return (
    <Analytics
      mode="production"
      scriptSrc={withBase('/_vercel/insights/script.js')}
      endpoint={withBase('/_vercel/insights')}
    />
  );
}
