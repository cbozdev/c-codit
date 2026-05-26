import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function startTour() {
  const d = driver({
    animate: true,
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Done',
    progressText: '{{current}} of {{total}}',
    overlayOpacity: 0.55,
    popoverClass: 'c-codit-tour',
    steps: [
      {
        popover: {
          title: '👋 Welcome to C-Codit',
          description: 'Let\'s take a quick tour so you know your way around. Click <strong>Next</strong> to continue.',
          side: 'over',
          align: 'center',
        },
      },
      {
        element: '[data-tour="nav-wallet"]',
        popover: {
          title: '💳 Wallet',
          description: 'Fund your account here using a card (Flutterwave) or crypto (NOWPayments). Your balance is used to pay for all services.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="nav-services"]',
        popover: {
          title: '🛍️ Services',
          description: 'Buy virtual numbers (STR & LTR), eSIM cards, gift cards, utility bills, and social media boosts — all from your wallet balance.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="nav-ltr"]',
        popover: {
          title: '📱 LTR Numbers',
          description: 'View and manage your long-term rental phone numbers. Toggle auto-renew, reuse numbers, and check expiry dates here.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="nav-proxy"]',
        popover: {
          title: '🌐 Proxies',
          description: 'Purchase residential, datacenter, ISP, or mobile proxies. Manage bandwidth, rotate IPs, and view connection details.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="nav-transactions"]',
        popover: {
          title: '📋 Transactions',
          description: 'Full history of every top-up, purchase, and refund on your account.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="wallet-card"]',
        popover: {
          title: '💰 Your Balance',
          description: 'Your available balance is shown here at a glance. Click <strong>Add funds</strong> to top up instantly.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="quick-actions"]',
        popover: {
          title: '⚡ Quick Actions',
          description: 'Jump straight to any service from here — virtual numbers, gift cards, utility bills, and more.',
          side: 'top',
          align: 'start',
        },
      },
      {
        popover: {
          title: '✅ You\'re all set!',
          description: 'That\'s the full tour. Fund your wallet and start using C-Codit\'s services. <br/><br/>Need help? Reach out to support anytime.',
          side: 'over',
          align: 'center',
        },
      },
    ],
  });

  d.drive();
}
