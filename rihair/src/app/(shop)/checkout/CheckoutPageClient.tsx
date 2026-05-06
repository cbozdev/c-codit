"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ChevronRight } from "lucide-react";
import { useCartStore } from "@/stores/cart.store";
import { useCurrencyStore } from "@/stores/currency.store";
import { formatPrice } from "@/lib/utils/currency";
import { checkoutSchema, type CheckoutInput } from "@/validators/checkout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CartSummaryPanel } from "@/components/commerce/CartSummaryPanel";
import { PaymentStep } from "@/components/commerce/PaymentStep";
import toast from "react-hot-toast";

const STEPS = ["Information", "Shipping", "Payment"] as const;
type Step = (typeof STEPS)[number];

export function CheckoutPageClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const { items, getSummary, couponCode } = useCartStore();
  const { currency } = useCurrencyStore();
  const [currentStep, setCurrentStep] = useState<Step>("Information");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [shippingAmount, setShippingAmount] = useState(0);

  const summary = getSummary(shippingAmount);

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      sameAsShipping: true,
      currency,
      shippingRateId: "",
    },
  });

  if (items.length === 0 && !orderId) {
    return (
      <div className="container-narrow py-24 text-center">
        <p className="font-display text-2xl font-medium text-text-primary mb-4">
          Your bag is empty
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={() => router.push("/shop")}
        >
          Continue Shopping
        </Button>
      </div>
    );
  }

  const handleInformationNext = async () => {
    const valid = await form.trigger([
      "shippingAddress.firstName",
      "shippingAddress.lastName",
      "shippingAddress.email" as never,
      "shippingAddress.addressLine1",
      "shippingAddress.city",
      "shippingAddress.state",
      "shippingAddress.country",
      "shippingAddress.phone",
    ]);
    if (valid) setCurrentStep("Shipping");
  };

  const handleShippingNext = async () => {
    if (!selectedRateId) {
      toast.error("Please select a shipping method");
      return;
    }
    form.setValue("shippingRateId", selectedRateId);
    setCurrentStep("Payment");
  };

  const handlePlaceOrder = async (paymentData: {
    provider: string;
    reference: string;
  }) => {
    setIsSubmitting(true);
    try {
      const values = form.getValues();
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkout: values,
          cartItems: items,
          currency,
          paymentProvider: paymentData.provider,
          paymentReference: paymentData.reference,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Failed to place order");
      }

      const { orderId: newOrderId } = await response.json();
      setOrderId(newOrderId);
      router.push(`/checkout/success?orderId=${newOrderId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndex = STEPS.indexOf(currentStep);

  return (
    <div className="container-brand py-10 lg:py-16">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <h1 className="font-display text-2xl lg:text-3xl font-medium text-text-primary">
            Checkout
          </h1>
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <Lock className="w-3.5 h-3.5" />
            Secure checkout
          </div>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-3 mb-10">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <button
                onClick={() => i < stepIndex && setCurrentStep(step)}
                disabled={i > stepIndex}
                className="flex items-center gap-2"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    i < stepIndex
                      ? "bg-brand-gold text-brand-black"
                      : i === stepIndex
                      ? "bg-brand-gold/20 border-2 border-brand-gold text-brand-gold"
                      : "bg-surface-tertiary text-text-muted"
                  }`}
                >
                  {i < stepIndex ? "✓" : i + 1}
                </div>
                <span
                  className={`text-sm font-medium ${
                    i === stepIndex ? "text-text-primary" : "text-text-muted"
                  }`}
                >
                  {step}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-text-muted" />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16">
          {/* Form */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              {currentStep === "Information" && (
                <motion.div
                  key="information"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  {!session && (
                    <div className="card-elevated p-4 flex items-center justify-between">
                      <p className="text-sm text-text-secondary">
                        Already have an account?
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/auth/login?next=/checkout")}
                      >
                        Sign in
                      </Button>
                    </div>
                  )}

                  <div>
                    <h2 className="font-display text-xl font-medium text-text-primary mb-5">
                      Shipping Address
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="First Name"
                        required
                        {...form.register("shippingAddress.firstName")}
                        error={form.formState.errors.shippingAddress?.firstName?.message}
                      />
                      <Input
                        label="Last Name"
                        required
                        {...form.register("shippingAddress.lastName")}
                        error={form.formState.errors.shippingAddress?.lastName?.message}
                      />
                      <Input
                        label="Email Address"
                        type="email"
                        required
                        className="col-span-2"
                        {...form.register("shippingAddress.addressLine1" as never)}
                      />
                      <Input
                        label="Phone Number"
                        type="tel"
                        required
                        className="col-span-2"
                        placeholder="+234..."
                        {...form.register("shippingAddress.phone")}
                        error={form.formState.errors.shippingAddress?.phone?.message}
                      />
                      <Input
                        label="Street Address"
                        required
                        className="col-span-2"
                        {...form.register("shippingAddress.addressLine1")}
                        error={form.formState.errors.shippingAddress?.addressLine1?.message}
                      />
                      <Input
                        label="Apartment, suite, etc."
                        className="col-span-2"
                        {...form.register("shippingAddress.addressLine2")}
                      />
                      <Input
                        label="City"
                        required
                        {...form.register("shippingAddress.city")}
                        error={form.formState.errors.shippingAddress?.city?.message}
                      />
                      <Input
                        label="State / Province"
                        required
                        {...form.register("shippingAddress.state")}
                        error={form.formState.errors.shippingAddress?.state?.message}
                      />
                      <Input
                        label="Postal Code"
                        {...form.register("shippingAddress.postalCode")}
                      />
                      <Input
                        label="Country"
                        required
                        {...form.register("shippingAddress.country")}
                        error={form.formState.errors.shippingAddress?.country?.message}
                      />
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleInformationNext}
                    icon={<ChevronRight className="w-5 h-5" />}
                    iconPosition="right"
                  >
                    Continue to Shipping
                  </Button>
                </motion.div>
              )}

              {currentStep === "Shipping" && (
                <motion.div
                  key="shipping"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <h2 className="font-display text-xl font-medium text-text-primary">
                    Shipping Method
                  </h2>
                  <ShippingRateSelector
                    country={form.watch("shippingAddress.country")}
                    selected={selectedRateId}
                    onSelect={(rateId, amount) => {
                      setSelectedRateId(rateId);
                      setShippingAmount(amount);
                    }}
                    currency={currency}
                  />
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleShippingNext}
                    icon={<ChevronRight className="w-5 h-5" />}
                    iconPosition="right"
                  >
                    Continue to Payment
                  </Button>
                </motion.div>
              )}

              {currentStep === "Payment" && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <PaymentStep
                    amount={summary.total}
                    currency={currency}
                    email={session?.user?.email ?? form.getValues("shippingAddress.firstName")}
                    onSuccess={handlePlaceOrder}
                    isLoading={isSubmitting}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-2">
            <CartSummaryPanel
              summary={summary}
              currency={currency}
              couponCode={couponCode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShippingRateSelector({
  country,
  selected,
  onSelect,
  currency,
}: {
  country: string;
  selected: string | null;
  onSelect: (rateId: string, amount: number) => void;
  currency: string;
}) {
  const MOCK_RATES = [
    { id: "rate_standard", name: "Standard Shipping", carrier: "DHL", days: "7-14 business days", amount: 15 },
    { id: "rate_express", name: "Express Shipping", carrier: "DHL Express", days: "3-5 business days", amount: 35 },
    { id: "rate_overnight", name: "Overnight / Next Day", carrier: "FedEx", days: "1-2 business days", amount: 65 },
  ];

  return (
    <div className="space-y-3">
      {MOCK_RATES.map((rate) => (
        <button
          key={rate.id}
          type="button"
          onClick={() => onSelect(rate.id, rate.amount)}
          className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-colors ${
            selected === rate.id
              ? "border-brand-gold bg-brand-gold/5"
              : "border-border-default hover:border-border-emphasis"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                selected === rate.id
                  ? "border-brand-gold"
                  : "border-border-default"
              }`}
            >
              {selected === rate.id && (
                <div className="w-2 h-2 rounded-full bg-brand-gold" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{rate.name}</p>
              <p className="text-xs text-text-muted">
                {rate.carrier} · {rate.days}
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-text-primary">
            {formatPrice(rate.amount, currency as never)}
          </span>
        </button>
      ))}
    </div>
  );
}
