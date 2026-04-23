import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-aurora p-6">
      <div className="text-center max-w-md">
        <Logo className="mx-auto" />
        <h1 className="mt-8 text-6xl font-bold text-ink-900">404</h1>
        <p className="mt-2 text-ink-600">We couldn't find that page.</p>
        <Link to="/" className="btn-brand mt-6">Back home</Link>
      </div>
    </div>
  );
}
