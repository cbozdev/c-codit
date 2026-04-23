import { clsx } from 'clsx';

export function Logo({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <span
        className={clsx(
          'flex h-8 w-8 items-center justify-center rounded-lg',
          dark ? 'bg-brand-500' : 'bg-ink-900',
        )}
      >
        <svg viewBox="0 0 24 24" className={clsx('h-5 w-5', dark ? 'text-ink-950' : 'text-brand-400')}>
          <path d="M16 8a6 6 0 1 0 0 8" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="15" cy="12" r="1.6" fill="currentColor" />
        </svg>
      </span>
      <span className={clsx('text-lg font-semibold tracking-tight', dark ? 'text-white' : 'text-ink-900')}>
        C-codit
      </span>
    </div>
  );
}
