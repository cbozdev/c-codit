import { z } from "zod";

export const addressSchema = z.object({
  firstName: z.string().min(2, "First name is required").max(50),
  lastName: z.string().min(2, "Last name is required").max(50),
  company: z.string().max(100).optional().or(z.literal("")),
  addressLine1: z.string().min(5, "Street address is required").max(200),
  addressLine2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().min(2, "City is required").max(100),
  state: z.string().min(2, "State / Province is required").max(100),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  country: z.string().min(2, "Country is required").max(100),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number"),
});

export const checkoutSchema = z.object({
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  sameAsShipping: z.boolean().default(true),
  shippingRateId: z.string().cuid("Please select a shipping method"),
  couponCode: z.string().max(50).optional().or(z.literal("")),
  currency: z.enum(["NGN", "GHS", "USD", "GBP", "CAD"]).default("USD"),
  notes: z.string().max(500).optional().or(z.literal("")),
  saveAddress: z.boolean().default(false),
});

export const couponSchema = z.object({
  code: z
    .string()
    .min(1, "Please enter a coupon code")
    .max(50)
    .transform((v) => v.toUpperCase().trim()),
});

export const guestCheckoutSchema = checkoutSchema.extend({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  createAccount: z.boolean().default(false),
  password: z.string().min(8).max(72).optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CouponInput = z.infer<typeof couponSchema>;
export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;
