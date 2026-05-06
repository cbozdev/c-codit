"use client";

import { useEffect, useState } from "react";
import { useGeoLocation } from "@/hooks/useGeoLocation";
import { formatPrice } from "@/lib/utils/currency";
import { Button } from "@/components/ui/Button";
import { Lock, CreditCard } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import toast from "react-hot-toast";
import type { SupportedCurrency } from "@/types";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

type PaymentStepProps = {
  amount: number;
  currency: SupportedCurrency;
  email: string;
  onSuccess: (data: { provider: string; reference: string }) => Promise<void>;
  isLoading: boolean;
};

export function PaymentStep({
  amount,
  currency,
  email,
  onSuccess,
  isLoading,
}: PaymentStepProps) {
  const geo = useGeoLocation();
  const isWestAfrica = geo?.paymentRegion === "west_africa";
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  useEffect(() => {
    if (!isWestAfrica && amount > 0) {
      fetch("/api/payments/stripe/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, email }),
      })
        .then((r) => r.json())
        .then((d) => {
          setClientSecret(d.clientSecret);
          setPaymentIntentId(d.paymentIntentId);
        })
        .catch(() => toast.error("Failed to initialize payment"));
    }
  }, [isWestAfrica, amount, currency, email]);

  if (isWestAfrica) {
    return (
      <PaystackPaymentForm
        amount={amount}
        currency={currency}
        email={email}
        onSuccess={onSuccess}
        isLoading={isLoading}
      />
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#C9A84C",
            colorBackground: "#1E1E1E",
            colorText: "#FAFAF8",
            borderRadius: "12px",
            fontFamily: "DM Sans, sans-serif",
          },
        },
      }}
    >
      <StripePaymentForm
        paymentIntentId={paymentIntentId}
        onSuccess={onSuccess}
        isLoading={isLoading}
        amount={amount}
        currency={currency}
      />
    </Elements>
  );
}

function StripePaymentForm({
  paymentIntentId,
  onSuccess,
  isLoading,
  amount,
  currency,
}: {
  paymentIntentId: string | null;
  onSuccess: PaymentStepProps["onSuccess"];
  isLoading: boolean;
  amount: number;
  currency: SupportedCurrency;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !paymentIntentId) return;

    setProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) throw new Error(error.message);
      if (paymentIntent?.status === "succeeded") {
        await onSuccess({ provider: "stripe", reference: paymentIntent.id });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="font-display text-xl font-medium text-text-primary">
        Payment
      </h2>
      <PaymentElement />
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={processing || isLoading}
        icon={<Lock className="w-4 h-4" />}
      >
        Pay {formatPrice(amount, currency)}
      </Button>
      <p className="text-xs text-text-muted text-center flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3" />
        Secured by Stripe · 256-bit SSL encryption
      </p>
    </form>
  );
}

function PaystackPaymentForm({
  amount,
  currency,
  email,
  onSuccess,
  isLoading,
}: PaymentStepProps) {
  const [processing, setProcessing] = useState(false);

  const handlePaystack = async () => {
    setProcessing(true);
    try {
      const res = await fetch("/api/payments/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const handler = (window as never as { PaystackPop: { setup: (config: unknown) => { openIframe: () => void } } }).PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email,
        amount: Math.round(amount * 100),
        currency,
        ref: data.reference,
        callback: (response: { reference: string }) => {
          onSuccess({ provider: "paystack", reference: response.reference });
        },
        onClose: () => {
          setProcessing(false);
        },
      });
      handler.openIframe();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-medium text-text-primary">
        Payment
      </h2>
      <div className="card-elevated p-5 flex items-center gap-3">
        <CreditCard className="w-5 h-5 text-brand-gold" />
        <div>
          <p className="text-sm font-medium text-text-primary">
            Pay with Paystack
          </p>
          <p className="text-xs text-text-muted">
            Cards, bank transfer, USSD, mobile money
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        loading={processing || isLoading}
        icon={<Lock className="w-4 h-4" />}
        onClick={handlePaystack}
      >
        Pay {formatPrice(amount, currency)}
      </Button>
      <p className="text-xs text-text-muted text-center flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3" />
        Secured by Paystack
      </p>
    </div>
  );
}
