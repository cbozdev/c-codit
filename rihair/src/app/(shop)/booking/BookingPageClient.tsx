"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Calendar, Clock, CheckCircle, ChevronRight } from "lucide-react";
import { bookingSchema, type BookingInput } from "@/validators/booking";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GoldDivider } from "@/components/ui/GoldDivider";
import { formatPrice } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import toast from "react-hot-toast";
import type { ServiceDetails } from "@/types";
import type { BookingSlot } from "@prisma/client";

type BookingSlotWithCount = BookingSlot & {
  _count: { bookings: number };
};

type BookingPageClientProps = {
  services: ServiceDetails[];
  availableSlots: BookingSlotWithCount[];
  initialService?: string;
};

export function BookingPageClient({
  services,
  availableSlots,
  initialService,
}: BookingPageClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedService, setSelectedService] = useState<ServiceDetails | null>(
    services.find((s) => s.id === initialService) ?? null
  );
  const [selectedSlot, setSelectedSlot] = useState<BookingSlotWithCount | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState<string | null>(null);

  const filteredSlots = availableSlots.filter(
    (s) => !selectedService || s.service === selectedService.id
  );

  const slotsByDate = filteredSlots.reduce<Record<string, BookingSlotWithCount[]>>(
    (acc, slot) => {
      const dateKey = typeof slot.date === "string"
        ? slot.date.slice(0, 10)
        : format(slot.date, "yyyy-MM-dd");
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey]!.push(slot);
      return acc;
    },
    {}
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      firstName: session?.user?.firstName ?? "",
      lastName: session?.user?.lastName ?? "",
      email: session?.user?.email ?? "",
      service: (initialService as BookingInput["service"]) ?? undefined,
    },
  });

  const onSubmit = async (data: BookingInput) => {
    if (!selectedSlot || !selectedService) {
      toast.error("Please select a service and time slot");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          slotId: selectedSlot.id,
          service: selectedService.id,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setBookingRef(result.bookingRef);
      toast.success("Booking confirmed!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Booking failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (bookingRef) {
    return (
      <div className="container-narrow py-24 text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto"
        >
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </motion.div>
        <h1 className="font-display text-3xl font-medium text-text-primary">
          Booking Confirmed!
        </h1>
        <p className="text-text-secondary">
          Your booking reference is{" "}
          <span className="text-brand-gold font-semibold">{bookingRef}</span>
        </p>
        <p className="text-text-muted text-sm">
          A confirmation email has been sent. We look forward to seeing you!
        </p>
        <Button variant="primary" size="md" onClick={() => router.push("/")}>
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="container-brand py-10 lg:py-16">
      <div className="text-center mb-12">
        <p className="text-label mb-2">Professional Services</p>
        <h1 className="font-display text-4xl lg:text-5xl font-medium text-text-primary mb-4">
          Book Your Appointment
        </h1>
        <p className="text-text-secondary text-base max-w-lg mx-auto">
          Select a service, choose your preferred time, and let our expert stylists take care of the rest.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Service Selection */}
        <div className="space-y-6">
          <GoldDivider label="1. Choose Service" className="max-w-xs" />
          <div className="space-y-3">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => {
                  setSelectedService(service);
                  setSelectedSlot(null);
                }}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all duration-200",
                  selectedService?.id === service.id
                    ? "border-brand-gold bg-brand-gold/5"
                    : "border-border-default hover:border-border-emphasis"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary mb-0.5">
                      {service.name}
                    </p>
                    <p className="text-xs text-text-muted leading-relaxed">
                      {service.description.slice(0, 80)}…
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-brand-gold">
                      {formatPrice(service.price, service.currency)}
                    </p>
                    <p className="text-2xs text-text-muted">
                      {service.duration} min
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Date & Time */}
        <div className="space-y-6">
          <GoldDivider label="2. Pick a Time" className="max-w-xs" />
          {!selectedService ? (
            <p className="text-text-muted text-sm">Select a service first</p>
          ) : Object.keys(slotsByDate).length === 0 ? (
            <p className="text-text-muted text-sm">
              No available slots for this service. Please contact us directly.
            </p>
          ) : (
            <div className="space-y-5 max-h-[480px] overflow-y-auto scrollbar-thin pr-1">
              {Object.entries(slotsByDate).map(([dateKey, daySlots]) => (
                <div key={dateKey}>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(parseISO(dateKey), "EEEE, MMMM d")}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {daySlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          "flex flex-col items-center gap-0.5 p-2 rounded-xl border text-center transition-all duration-200",
                          selectedSlot?.id === slot.id
                            ? "border-brand-gold bg-brand-gold/10 text-brand-gold"
                            : "border-border-default text-text-secondary hover:border-brand-gold/50"
                        )}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">{slot.startTime}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact Details */}
        <div className="space-y-6">
          <GoldDivider label="3. Your Details" className="max-w-xs" />
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                required
                {...register("firstName")}
                error={errors.firstName?.message}
              />
              <Input
                label="Last Name"
                required
                {...register("lastName")}
                error={errors.lastName?.message}
              />
            </div>
            <Input
              label="Email"
              type="email"
              required
              {...register("email")}
              error={errors.email?.message}
            />
            <Input
              label="Phone"
              type="tel"
              required
              placeholder="+234..."
              {...register("phone")}
              error={errors.phone?.message}
            />
            <div>
              <label className="input-label">Notes (optional)</label>
              <textarea
                {...register("notes")}
                placeholder="Any special requests or information..."
                rows={3}
                className="input-field resize-none"
              />
            </div>

            {selectedService && selectedSlot && (
              <div className="card-elevated p-4 space-y-2">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Booking Summary
                </p>
                <p className="text-sm text-text-primary font-medium">
                  {selectedService.name}
                </p>
                <p className="text-xs text-text-muted">
                  {format(
                    parseISO(
                      typeof selectedSlot.date === "string"
                        ? selectedSlot.date.slice(0, 10)
                        : format(selectedSlot.date, "yyyy-MM-dd")
                    ),
                    "EEEE, MMMM d, yyyy"
                  )}{" "}
                  at {selectedSlot.startTime}
                </p>
                <p className="text-sm font-bold text-brand-gold">
                  {formatPrice(selectedService.price, selectedService.currency)}
                  {selectedService.depositRequired &&
                    ` · Deposit: ${formatPrice(selectedService.depositAmount ?? 0, selectedService.currency)}`}
                </p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
              disabled={!selectedService || !selectedSlot}
              icon={<ChevronRight className="w-5 h-5" />}
              iconPosition="right"
            >
              Confirm Booking
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
