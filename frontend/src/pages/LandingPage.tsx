import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { ArrowRight, Shield, Smartphone, CreditCard, Globe, Bitcoin, Receipt, Zap } from 'lucide-react';

const FEATURES = [
  { icon: Smartphone, title: 'Virtual Numbers',     desc: 'Disposable numbers from 5sim & sms-activate, billed to one wallet.' },
  { icon: Globe,      title: 'eSIM',                desc: 'Travel-ready data plans for 200+ countries.' },
  { icon: Receipt,    title: 'Utility Bills',       desc: 'Airtime, data, and bills via Flutterwave — paid in seconds.' },
  { icon: CreditCard, title: 'Gift Cards',          desc: 'Top-up codes for the platforms you actually use.' },
  { icon: Bitcoin,    title: 'Crypto Top-ups',      desc: 'Fund your wallet with USDT, BTC, ETH and more via NowPayments.' },
  { icon: Shield,     title: 'Ledger-grade safety', desc: 'Double-entry accounting and signed webhooks. Your money stays exactly where it should.' },
];

export default function LandingPage() {
  return (
    <div className="bg-aurora min-h-screen">
      {/* Nav */}
      <header className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-1">
          <a href="#features" className="px-3 py-2 text-sm text-ink-700 hover:text-ink-900">Features</a>
          <a href="#how"      className="px-3 py-2 text-sm text-ink-700 hover:text-ink-900">How it works</a>
          <a href="#trust"    className="px-3 py-2 text-sm text-ink-700 hover:text-ink-900">Trust</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login"    className="btn-ghost">Sign in</Link>
          <Link to="/register" className="btn-brand">Create account <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-12 lg:pt-20 pb-16 lg:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span className="badge-success mb-6">
              <Zap className="h-3.5 w-3.5" /> Now live — wallet, virtual numbers, more shipping weekly
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-ink-950 leading-[1.05]">
              Digital services,<br />
              <span className="text-brand-600">one wallet.</span>
            </h1>
            <p className="mt-6 text-lg text-ink-700 max-w-xl">
              Buy virtual numbers, eSIM, gift cards and pay bills from a single funded wallet.
              Top up by card or crypto. Built like a real bank, not a wrapper.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/register" className="btn-brand text-base px-6 py-3">
                Open free account <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#features" className="btn-outline text-base px-6 py-3">See what you can do</a>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-ink-500">
              <span>✓ No setup fee</span>
              <span>✓ Refund on failed delivery</span>
              <span>✓ 24/7 service</span>
            </div>
          </div>

          {/* Mock wallet card */}
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-brand-500/30 via-transparent to-brand-300/20 blur-3xl rounded-[3rem]" />
            <div className="relative card-pad max-w-md ml-auto">
              <div className="flex items-center justify-between text-sm text-ink-500">
                <span>Your wallet</span>
                <span className="badge-success">Active</span>
              </div>
              <div className="mt-3 text-4xl font-semibold tracking-tight text-ink-950">$2,418.50</div>
              <div className="text-sm text-ink-500 mt-1">USD · primary balance</div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-ink-50 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wide text-ink-500">Today</div>
                  <div className="font-medium">+$120.00</div>
                </div>
                <div className="rounded-lg bg-ink-50 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wide text-ink-500">Pending</div>
                  <div className="font-medium">$0.00</div>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                {[
                  { label: 'Virtual number — Telegram',    amount: '-$0.85', tag: 'success' },
                  { label: 'Wallet funding — Card',         amount: '+$50.00', tag: 'success' },
                  { label: 'Virtual number — WhatsApp',     amount: '-$1.10', tag: 'success' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-ink-100 pb-2 last:border-b-0">
                    <span className="text-ink-700">{row.label}</span>
                    <span className="font-mono font-medium">{row.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink-950">Everything in one place</h2>
          <p className="mt-3 text-ink-600">A wallet that powers every digital service you actually need.</p>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card-pad hover:shadow-glow transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-ink-900">{title}</h3>
              <p className="mt-1.5 text-sm text-ink-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How */}
      <section id="how" className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <h2 className="text-3xl font-semibold text-ink-950">How it works</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          {[
            { n: '01', t: 'Create your account', d: 'Sign up in 30 seconds. Email verification, no paperwork.' },
            { n: '02', t: 'Top up your wallet',  d: 'Card via Flutterwave, or crypto via NowPayments — both verified end-to-end.' },
            { n: '03', t: 'Use any service',     d: 'Buy a virtual number, an eSIM, a gift card. Failed delivery is auto-refunded.' },
          ].map((s) => (
            <div key={s.n} className="card-pad">
              <div className="text-xs font-mono text-brand-600">{s.n}</div>
              <h3 className="mt-2 font-semibold text-ink-900">{s.t}</h3>
              <p className="mt-2 text-sm text-ink-600">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="card-pad bg-ink-950 text-white border-ink-950">
          <div className="grid md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <h2 className="text-3xl font-semibold tracking-tight">Built like financial infrastructure</h2>
              <p className="mt-3 text-ink-200">
                Every cent moves through a double-entry ledger with database-enforced invariants.
                Webhooks are signature-verified and re-checked against provider APIs before crediting.
                Idempotency keys make duplicate charges impossible.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm"><Shield className="h-5 w-5 text-brand-400" /> Double-entry ledger</div>
              <div className="flex items-center gap-3 text-sm"><Shield className="h-5 w-5 text-brand-400" /> Idempotent transactions</div>
              <div className="flex items-center gap-3 text-sm"><Shield className="h-5 w-5 text-brand-400" /> Auto-refund on failure</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 text-center">
        <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-ink-950">Ready when you are.</h2>
        <p className="mt-4 text-ink-600 max-w-xl mx-auto">It takes thirty seconds to start.</p>
        <Link to="/register" className="btn-brand mt-8 inline-flex text-base px-6 py-3">
          Create your account <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="border-t border-ink-100 mt-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo />
          <div className="text-sm text-ink-500 flex items-center gap-5">
            <Link to="/legal/privacy">Privacy</Link>
            <Link to="/legal/terms">Terms</Link>
            <span>© {new Date().getFullYear()} C-codit</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
