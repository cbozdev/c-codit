import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import axios from 'axios';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const link = params.get('link');
  const [state, setState] = useState<'pending' | 'success' | 'failed'>('pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!link) {
      setState('failed');
      setMessage('Missing verification link.');
      return;
    }
    axios.get(link)
      .then((res) => {
        setState('success');
        setMessage(res.data?.message ?? 'Email verified.');
      })
      .catch((err) => {
        setState('failed');
        setMessage(err.response?.data?.message ?? 'Verification failed.');
      });
  }, [link]);

  return (
    <div className="min-h-screen grid place-items-center bg-aurora p-6">
      <div className="card-pad max-w-md w-full text-center">
        <Logo className="mx-auto" />
        {state === 'pending' && (
          <>
            <Loader2 className="h-10 w-10 mx-auto mt-6 animate-spin text-brand-500" />
            <h1 className="mt-4 text-lg font-bold text-ink-900">Verifying your email…</h1>
          </>
        )}
        {state === 'success' && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto mt-6 text-brand-500" />
            <h1 className="mt-4 text-lg font-bold text-ink-900">Email verified</h1>
            <p className="mt-2 text-sm text-ink-600">{message}</p>
            <Link to="/dashboard" className="btn-brand mt-6">Go to dashboard</Link>
          </>
        )}
        {state === 'failed' && (
          <>
            <XCircle className="h-10 w-10 mx-auto mt-6 text-rose-500" />
            <h1 className="mt-4 text-lg font-bold text-ink-900">Verification failed</h1>
            <p className="mt-2 text-sm text-ink-600">{message}</p>
            <Link to="/login" className="btn-outline mt-6">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
