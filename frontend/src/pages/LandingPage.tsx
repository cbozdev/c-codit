import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import {
  ArrowRight, Shield, Smartphone, CreditCard, Globe,
  Bitcoin, Receipt, Zap, CheckCircle2, Lock, RefreshCw,
} from 'lucide-react';

const FEATURES = [
  { icon: Smartphone, title: 'Virtual Numbers',     desc: 'Disposable numbers from 5sim & SMS-Man, billed to one wallet.',  color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-900/30' },
  { icon: Globe,      title: 'Proxies & eSIM',      desc: 'Residential & datacenter proxies. Travel data for 200+ countries.', color: 'text-teal-600',    bg: 'bg-teal-50 dark:bg-teal-900/30' },
  { icon: Receipt,    title: 'Utility Bills',        desc: 'Airtime, data, electricity and TV bills paid in seconds.',        color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/30' },
  { icon: CreditCard, title: 'Gift Cards',           desc: 'Top-up codes for Amazon, Google Play, Netflix and more.',         color: 'text-pink-600',    bg: 'bg-pink-50 dark:bg-pink-900/30' },
  { icon: Bitcoin,    title: 'Crypto Top-ups',       desc: 'Fund your wallet with USDT, BTC, ETH and 100+ coins.',           color: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-900/30' },
  { icon: Shield,     title: 'Ledger-grade safety',  desc: 'Double-entry accounting, signed webhooks, idempotent charges.',  color: 'text-brand-600',   bg: 'bg-brand-50 dark:bg-brand-900/30' },
];

const STEPS = [
  { n: '01', icon: Zap,        title: 'Create your account', desc: 'Sign up in 30 seconds. Email verification, no paperwork or ID required.' },
  { n: '02', icon: CreditCard, title: 'Top up your wallet',  desc: 'Card via Flutterwave, or crypto via NowPayments — both verified end-to-end.' },
  { n: '03', icon: CheckCircle2,title: 'Use any service',    desc: 'Virtual number, eSIM, gift card. Failed delivery is automatically refunded.' },
];

const TRUST_POINTS = [
  'Double-entry ledger — every cent is accounted for',
  'Webhook signatures verified against provider APIs',
  'Idempotency keys prevent duplicate charges',
  'Auto-refund on every failed delivery',
];

export default function LandingPage() {
  return (
    <div className="bg-white dark:bg-ink-950 min-h-screen">

      {/* ── Nav ── */}
      <header className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-1">
          <a href="#features" className="px-3 py-2 text-sm text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white transition">Features</a>
          <a href="#how"      className="px-3 py-2 text-sm text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white transition">How it works</a>
          <a href="#trust"    className="px-3 py-2 text-sm text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white transition">Security</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login"    className="px-4 py-2 text-sm font-medium text-ink-700 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white transition">Sign in</Link>
          <Link to="/register" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 text-sm font-semibold hover:opacity-90 transition">
            Get started <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 pointer-events-none" />
        <div className="absolute -top-20 left-1/4 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-20 lg:pb-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-white">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 px-3 py-1.5 rounded-full mb-6">
                <Zap className="h-3.5 w-3.5" /> Now live — wallet, virtual numbers & more
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
                Digital services,<br />
                <span className="text-brand-400">one wallet.</span>
              </h1>
              <p className="mt-6 text-lg text-ink-300 max-w-xl">
                Buy virtual numbers, eSIM, gift cards and pay bills from a single funded wallet.
                Top up by card or crypto. Built like a real bank, not a wrapper.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/register"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-white text-base font-semibold transition">
                  Open free account <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#features"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-base font-medium border border-white/10 transition">
                  See what you can do
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-ink-400">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand-400" /> No setup fee</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand-400" /> Refund on failed delivery</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand-400" /> 24/7 service</span>
              </div>
            </div>

            {/* Mock wallet card */}
            <div className="relative">
              <div className="absolute -inset-4 bg-brand-500/10 blur-2xl rounded-3xl pointer-events-none" />
              <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm p-6 max-w-md ml-auto">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-400">Your wallet</span>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active
                  </span>
                </div>
                <div className="mt-3 text-4xl font-semibold tracking-tight text-white">$2,418.50</div>
                <div className="text-sm text-ink-500 mt-1">USD · primary balance</div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                    <div className="text-[11px] uppercase tracking-wide text-ink-500">Today</div>
                    <div className="font-semibold text-emerald-400">+$120.00</div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                    <div className="text-[11px] uppercase tracking-wide text-ink-500">Pending</div>
                    <div className="font-semibold text-white">$0.00</div>
                  </div>
                </div>

                <div className="mt-5 space-y-2.5">
                  {[
                    { label: 'Virtual number — Telegram', amount: '-$0.85', credit: false },
                    { label: 'Wallet funding — Card',      amount: '+$50.00', credit: true  },
                    { label: 'Virtual number — WhatsApp',  amount: '-$1.10', credit: false },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
                      <span className="text-ink-400 truncate mr-2">{row.label}</span>
                      <span className={`font-mono font-semibold shrink-0 ${row.credit ? 'text-emerald-400' : 'text-white'}`}>{row.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink-950 dark:text-white">Everything in one place</h2>
          <p className="mt-3 text-ink-600 dark:text-ink-400 text-lg">A wallet that powers every digital service you actually need.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title}
              className="rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 hover:shadow-lg dark:hover:shadow-ink-950/50 hover:-translate-y-0.5 transition-all">
              <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <h3 className="mt-4 font-semibold text-ink-900 dark:text-white">{title}</h3>
              <p className="mt-1.5 text-sm text-ink-600 dark:text-ink-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="bg-ink-50 dark:bg-ink-900/50 py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink-950 dark:text-white mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map(({ n, icon: Icon, title, desc }) => (
              <div key={n}
                className="relative rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <span className="text-xs font-mono font-bold text-brand-500 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded">{n}</span>
                </div>
                <h3 className="font-semibold text-ink-900 dark:text-white text-lg">{title}</h3>
                <p className="mt-2 text-sm text-ink-600 dark:text-ink-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust / Security ── */}
      <section id="trust" className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 p-8 lg:p-12 relative">
          <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-brand-500/10 blur-2xl pointer-events-none" />
          <div className="relative grid md:grid-cols-5 gap-8 items-center">
            <div className="md:col-span-3">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-5 w-5 text-brand-400" />
                <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Security-first</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
                Built like financial<br />infrastructure.
              </h2>
              <p className="mt-4 text-ink-300 leading-relaxed">
                Every cent moves through a double-entry ledger with database-enforced invariants.
                Webhooks are signature-verified and re-checked against provider APIs before crediting.
              </p>
            </div>
            <div className="md:col-span-2 space-y-3">
              {TRUST_POINTS.map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-ink-300">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 px-3 py-1.5 rounded-full mb-6">
            <RefreshCw className="h-3.5 w-3.5" /> Auto-refund on every failed delivery
          </div>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-ink-950 dark:text-white">Ready when you are.</h2>
          <p className="mt-4 text-ink-600 dark:text-ink-400 text-lg">It takes thirty seconds to start. No credit card required.</p>
          <Link to="/register"
            className="inline-flex items-center gap-2 mt-8 px-8 py-4 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 text-base font-semibold hover:opacity-90 transition">
            Create your account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-ink-100 dark:border-ink-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo />
          <div className="text-sm text-ink-500 flex items-center gap-6">
            <Link to="/legal/privacy" className="hover:text-ink-800 dark:hover:text-ink-200 transition">Privacy</Link>
            <Link to="/legal/terms"   className="hover:text-ink-800 dark:hover:text-ink-200 transition">Terms</Link>
            <span>© {new Date().getFullYear()} C-codit</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
