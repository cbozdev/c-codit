import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

export function startTour() {
  const isMobile = window.innerWidth < 1024;

  // On mobile: elements are in the bottom nav (data-tour-mobile)
  // On desktop: elements are in the sidebar (data-tour)
  function navEl(id: string): HTMLElement | undefined {
    const attr = isMobile ? `data-tour-mobile` : `data-tour`;
    return (document.querySelector(`[${attr}="${id}"]`) as HTMLElement) ?? undefined;
  }

  function navStep(
    id: string,
    title: string,
    description: string,
  ): DriveStep | null {
    const el = navEl(id);
    if (!el) return null;
    return {
      element: el,
      popover: {
        title,
        description,
        side: isMobile ? 'top' : 'right',
        align: 'center',
      },
    };
  }

  const walletCard = document.querySelector('[data-tour="wallet-card"]') as HTMLElement | null;
  const quickActions = document.querySelector('[data-tour="quick-actions"]') as HTMLElement | null;

  const allSteps: (DriveStep | null)[] = [
    {
      popover: {
        title: '👋 Welcome to C-Codit',
        description: "Let's take a quick tour so you know your way around. Click <strong>Next →</strong> to continue.",
        side: 'over',
        align: 'center',
      },
    },
    navStep('nav-wallet',       '💳 Wallet',       'Fund your account here using a card (Flutterwave) or crypto. Your balance pays for all services.'),
    navStep('nav-services',     '🛍️ Services',      'Buy virtual numbers (STR & LTR), eSIM cards, gift cards, utility bills, and social media boosts.'),
    navStep('nav-ltr',          '📱 LTR Numbers',   'Manage your long-term rental numbers — check expiry, toggle auto-renew, and reuse numbers.'),
    navStep('nav-proxy',        '🌐 Proxies',       'Purchase residential, datacenter, ISP, or mobile proxies and manage them here.'),
    navStep('nav-transactions', '📋 Transactions',  'Full history of every top-up, purchase, and refund on your account.'),
    walletCard ? {
      element: walletCard,
      popover: {
        title: '💰 Your Balance',
        description: 'Your available balance is shown here. Click <strong>Add funds</strong> to top up instantly.',
        side: isMobile ? 'bottom' : 'bottom',
        align: 'start',
      },
    } : null,
    quickActions ? {
      element: quickActions,
      popover: {
        title: '⚡ Quick Actions',
        description: 'Jump straight to any service from here — virtual numbers, gift cards, utility bills and more.',
        side: 'top',
        align: 'start',
      },
    } : null,
    {
      popover: {
        title: "✅ You're all set!",
        description: "That's the full tour. Fund your wallet and start using C-Codit's services.<br/><br/>Need help? Reach out to support anytime.",
        side: 'over',
        align: 'center',
      },
    },
  ];

  const steps = allSteps.filter((s): s is DriveStep => s !== null);

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
    allowClose: true,
    steps,
  });

  d.drive();
}
