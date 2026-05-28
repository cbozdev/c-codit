import { useState, useEffect } from 'react';
import { Cookie, X, Shield } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Types & constants ────────────────────────────────────────────────────────

export type CookieChoice = 'all' | 'essential';

const STORAGE_KEY  = 'cookie_consent';
const EXPIRES_DAYS = 365;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Read saved preference. Returns null when no decision has been made yet. */
export function getCookieConsent(): CookieChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'all' || raw === 'essential') return raw;
  } catch {}
  return null;
}

/** Persist the choice and stamp an expiry so we don't re-prompt for a year. */
function saveConsent(choice: CookieChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
    const expires = new Date();
    expires.setDate(expires.getDate() + EXPIRES_DAYS);
    localStorage.setItem(STORAGE_KEY + '_expires', expires.toISOString());
  } catch {}
}

/** True when the stored consent has expired (after EXPIRES_DAYS days). */
function isExpired(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + '_expires');
    if (!raw) return false;
    return new Date(raw) < new Date();
  } catch {}
  return false;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(false);

  useEffect(() => {
    // Show banner if no valid consent is stored
    const existing = getCookieConsent();
    if (!existing || isExpired()) {
      // Small delay so it doesn't flash during hydration
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function accept(choice: CookieChoice) {
    saveConsent(choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop blur on mobile only */}
      <div className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-sm lg:hidden" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cookie preferences"
        className={clsx(
          // Position: bottom-fixed, full width on mobile; bottom-right card on desktop
          'fixed z-[100] w-full lg:w-[420px]',
          'bottom-0 left-0 lg:bottom-6 lg:left-6',
          // Card style
          'bg-white dark:bg-ink-900 shadow-2xl',
          'rounded-t-2xl lg:rounded-2xl',
          'border border-ink-100 dark:border-ink-800',
          'p-5 space-y-4',
          // Animation
          'animate-in slide-in-from-bottom-4 duration-300',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-50 dark:bg-brand-950/50 border border-brand-100 dark:border-brand-900 flex items-center justify-center">
              <Cookie className="h-4.5 w-4.5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="font-semibold text-sm dark:text-white">Cookie Preferences</h2>
              <p className="text-xs text-ink-500">We respect your privacy</p>
            </div>
          </div>
          {/* Dismiss without choosing = essential only */}
          <button
            onClick={() => accept('essential')}
            aria-label="Dismiss — use essential cookies only"
            className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <p className="text-xs text-ink-600 dark:text-ink-400 leading-relaxed">
          We use <strong className="text-ink-800 dark:text-white">essential cookies</strong> to keep you signed in and make the platform work. We do not sell your data or track you across other sites.
        </p>

        {/* Details toggle */}
        <div>
          <button
            onClick={() => setDetails((d) => !d)}
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
          >
            {details ? 'Hide details ↑' : 'Show cookie details ↓'}
          </button>

          {details && (
            <div className="mt-3 space-y-2">
              {[
                {
                  name: 'Essential (always on)',
                  desc: 'Login session, security tokens, dark-mode preference. Cannot be disabled.',
                  required: true,
                },
                {
                  name: 'Analytics (optional)',
                  desc: 'Anonymous page-view stats to help us improve the app. No personal data is shared.',
                  required: false,
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-start gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700"
                >
                  <Shield
                    className={clsx(
                      'h-4 w-4 mt-0.5 shrink-0',
                      item.required ? 'text-brand-500' : 'text-ink-400',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium dark:text-white">{item.name}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">{item.desc}</p>
                  </div>
                  <div
                    className={clsx(
                      'shrink-0 text-xs font-medium px-2 py-0.5 rounded-full',
                      item.required
                        ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300'
                        : 'bg-ink-200 dark:bg-ink-700 text-ink-500 dark:text-ink-400',
                    )}
                  >
                    {item.required ? 'Required' : 'Optional'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => accept('essential')}
            className="flex-1 rounded-xl border border-ink-200 dark:border-ink-700 py-2.5 text-sm font-medium text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800 transition"
          >
            Essential only
          </button>
          <button
            onClick={() => accept('all')}
            className="flex-1 btn-brand py-2.5 text-sm"
          >
            Accept all
          </button>
        </div>

        {/* Privacy link */}
        <p className="text-center text-[10px] text-ink-400 dark:text-ink-500">
          By using this platform you agree to our{' '}
          <a href="/legal/privacy" className="underline hover:text-ink-600 dark:hover:text-ink-300">
            Privacy Policy
          </a>{' '}
          and{' '}
          <a href="/legal/terms" className="underline hover:text-ink-600 dark:hover:text-ink-300">
            Terms of Service
          </a>.
        </p>
      </div>
    </>
  );
}
