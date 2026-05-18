import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 px-6 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute top-1/4 -left-16 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

      <div className="relative text-center max-w-md">
        <div className="mb-6">
          <Logo />
        </div>

        <div className="text-[120px] sm:text-[160px] font-bold leading-none text-white/5 select-none tracking-tighter">
          404
        </div>
        <div className="-mt-8 sm:-mt-12">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">Page not found</h1>
          <p className="mt-3 text-ink-400 text-sm sm:text-base">
            We couldn't find what you were looking for. It may have been moved or removed.
          </p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition">
            <Home className="h-4 w-4" /> Go home
          </Link>
          <button onClick={() => history.back()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/10 transition">
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
        </div>
      </div>
    </div>
  );
}
