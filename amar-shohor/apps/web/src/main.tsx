import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/map.css';
import './styles/home.css';

import { App } from './App';
import { ErrorSurface } from './components/ErrorSurface';
import { AuthProvider } from './lib/auth-context';
import { UiProvider } from './lib/ui-context';

/**
 * Errors thrown before React mounts — a bad import, a module touching a missing
 * global — cannot reach an error boundary, and the default outcome is a blank
 * white page that tells nobody anything.
 *
 * The report goes into an overlay appended to <body>, never into #root: wiping
 * the container React is rendering into makes React fail on its next commit
 * with "removeChild: node is not a child of this node", which then reports
 * itself here and buries the original error. Only the first error is shown,
 * for the same reason.
 */
let fatalShown = false;

function paintFatal(title: string, detail: string) {
  if (fatalShown) return;
  fatalShown = true;

  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'alert');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:99999;overflow:auto;background:#f5f6f4;color:#16211c;' +
    "padding:24px;font:15px/1.55 'Archivo',system-ui,sans-serif";

  const card = document.createElement('div');
  card.style.cssText =
    'max-width:880px;margin:0 auto;background:#fff;border:1px solid #dfe4e0;' +
    'border-left:3px solid #b3261e;border-radius:10px;padding:20px 24px 24px';

  const eyebrow = document.createElement('span');
  eyebrow.style.cssText =
    "display:block;font:600 10.5px/1 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.1em;" +
    'text-transform:uppercase;color:#74847b;margin-bottom:8px';
  eyebrow.textContent = 'Amar Shohor — startup error';

  const heading = document.createElement('h1');
  heading.style.cssText = 'font-size:20px;font-weight:650;letter-spacing:-.015em;margin:0 0 10px';
  // textContent throughout, so an error message containing markup cannot
  // inject anything into the page.
  heading.textContent = title;

  const stack = document.createElement('pre');
  stack.style.cssText =
    "font:12px/1.7 'IBM Plex Mono',ui-monospace,monospace;background:#16211c;color:#b9c8de;" +
    'padding:14px 16px;border-radius:8px;overflow-x:auto;white-space:pre-wrap;word-break:break-word;margin:0';
  stack.textContent = detail;

  card.append(eyebrow, heading, stack);
  overlay.append(card);
  document.body.append(overlay);
}

window.addEventListener('error', (event) => {
  const err = event.error as Error | undefined;
  paintFatal(
    err ? `${err.name}: ${err.message}` : event.message,
    err?.stack ?? `${event.filename}:${event.lineno}:${event.colno}`,
  );
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as Error | string;
  const err = reason instanceof Error ? reason : new Error(String(reason));
  paintFatal(`Unhandled promise rejection: ${err.message}`, err.stack ?? String(reason));
});

const client = new QueryClient({
  defaultOptions: {
    queries: {
      // Map data goes stale fast; a citizen refreshing should see new reports.
      staleTime: 20_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

try {
  const root = document.getElementById('root');
  if (!root) throw new Error('#root is missing from index.html');

  createRoot(root).render(
    <StrictMode>
      <ErrorSurface>
        <QueryClientProvider client={client}>
          <UiProvider>
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AuthProvider>
          </UiProvider>
        </QueryClientProvider>
      </ErrorSurface>
    </StrictMode>,
  );
} catch (err) {
  const e = err instanceof Error ? err : new Error(String(err));
  paintFatal(`${e.name}: ${e.message}`, e.stack ?? '(no stack)');
}
