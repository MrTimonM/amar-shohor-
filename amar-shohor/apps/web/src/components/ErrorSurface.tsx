import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * A blank white page is the worst failure mode a web app has: it tells the
 * person nothing and it tells the developer nothing. Anything that throws
 * during render lands here and gets printed, with the component stack.
 *
 * Paired with the window-level handlers in main.tsx, which catch the errors
 * that happen before React ever mounts — the case an error boundary cannot
 * reach.
 */
interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorSurface extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    // Keep the console copy: the stack there is clickable in devtools.
    console.error('Amar Shohor crashed while rendering', error, info.componentStack);
  }

  override render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={S.wrap}>
        <div style={S.card}>
          <span style={S.eyebrow}>Amar Shohor — render error</span>
          <h1 style={S.title}>{error.name}: {error.message}</h1>
          <p style={S.lede}>
            Something threw while drawing the page. The stack below points at the cause; the
            component stack under it shows where in the tree it happened.
          </p>

          <pre style={S.pre}>{error.stack ?? '(no stack)'}</pre>
          {info?.componentStack && (
            <>
              <span style={S.eyebrow}>Component stack</span>
              <pre style={S.pre}>{info.componentStack}</pre>
            </>
          )}

          <button type="button" style={S.btn} onClick={() => this.setState({ error: null, info: null })}>
            Try rendering again
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Inline styles on purpose: if the stylesheet is what failed, a class-based
 * error screen would be invisible too.
 */
const S: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100%',
    background: '#f5f6f4',
    color: '#16211c',
    padding: 24,
    font: "15px/1.55 'Archivo', system-ui, sans-serif",
  },
  card: {
    maxWidth: 880,
    margin: '0 auto',
    background: '#fff',
    border: '1px solid #dfe4e0',
    borderLeft: '3px solid #b3261e',
    borderRadius: 10,
    padding: '20px 24px 24px',
  },
  eyebrow: {
    display: 'block',
    font: "600 10.5px/1 'IBM Plex Mono', ui-monospace, monospace",
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#74847b',
    margin: '14px 0 8px',
  },
  title: { fontSize: 20, fontWeight: 650, letterSpacing: '-0.015em', margin: '0 0 8px' },
  lede: { color: '#4a5a52', margin: '0 0 4px', maxWidth: '68ch' },
  pre: {
    font: "12px/1.7 'IBM Plex Mono', ui-monospace, monospace",
    background: '#16211c',
    color: '#b9c8de',
    padding: '14px 16px',
    borderRadius: 8,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
  },
  btn: {
    marginTop: 18,
    padding: '10px 18px',
    borderRadius: 6,
    border: '1px solid #00694c',
    background: '#00694c',
    color: '#fff',
    font: "600 14.5px 'Archivo', system-ui, sans-serif",
    cursor: 'pointer',
  },
};
