import { Link, useParams } from 'react-router-dom';
import { Logo } from '@/components/Logo';

const TERMS = `
# Terms of Service

Last updated: ${new Date().toISOString().slice(0, 10)}

By using C-codit you agree to these terms. C-codit provides digital services
(virtual phone numbers, eSIMs, gift cards, utility bill payments) and a wallet
to pay for them. We are not a bank.

## 1. Eligibility
You must be at least 18 years old and able to enter into a binding contract.

## 2. Wallet
Funds in your wallet are denominated in your account currency and represent a
prepaid balance for use on C-codit. Funds are non-interest-bearing and
non-transferable to other users.

## 3. Refunds
If a third-party provider fails to deliver a service after your wallet was
debited, the held funds are automatically returned to your wallet. Beyond that,
purchases of digital goods are generally non-refundable.

## 4. Prohibited use
You may not use C-codit for fraud, money laundering, or to circumvent the
verification requirements of any third-party service.

## 5. Termination
We may suspend or terminate accounts that violate these terms or applicable law.
We will refund any unused wallet balance subject to verification.

## 6. Disclaimer
The service is provided "as is" without warranties of any kind. To the maximum
extent permitted by law, our liability is limited to the amount currently held
in your wallet.

## 7. Changes
We may update these terms. Continued use after changes constitutes acceptance.
`;

const PRIVACY = `
# Privacy Policy

Last updated: ${new Date().toISOString().slice(0, 10)}

We collect only what we need to deliver the service: account info, transaction
records, and minimal device data for security.

## What we collect
- Account: name, email, phone, country.
- Wallet & ledger: every credit and debit, with full audit history.
- Payments: gateway-provided references — never raw card numbers.
- Operational: IP, user-agent, login timestamps for fraud prevention.

## How we use it
- Provide the service and process your payments.
- Detect and prevent fraud.
- Comply with legal obligations.

## Sharing
We share data only with payment and service providers strictly required to
fulfil your request (e.g. Flutterwave, NowPayments, 5sim, sms-activate).

## Retention
Financial records are kept for the period required by law. Operational logs
older than one year are pruned.

## Your rights
You may request export or deletion of your account by contacting
privacy@c-codit.com. Financial records may be retained where required by law.
`;

export default function LegalPage() {
  const { doc } = useParams<{ doc: string }>();
  const isPrivacy = doc === 'privacy';
  const content = isPrivacy ? PRIVACY : TERMS;

  return (
    <div className="min-h-screen bg-aurora">
      <header className="px-6 py-5 flex items-center justify-between border-b border-ink-100 bg-white/70 backdrop-blur">
        <Link to="/"><Logo /></Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/legal/terms" className={!isPrivacy ? 'font-semibold text-ink-900' : 'text-ink-600'}>Terms</Link>
          <Link to="/legal/privacy" className={isPrivacy ? 'font-semibold text-ink-900' : 'text-ink-600'}>Privacy</Link>
        </nav>
      </header>
      <article className="prose prose-ink max-w-3xl mx-auto px-6 py-12 text-ink-800 whitespace-pre-line">
        {content}
      </article>
    </div>
  );
}
