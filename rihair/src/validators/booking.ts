import { z } from "zod";

export const bookingSchema = z.object({
  service: z.enum([
    "WIG_INSTALLATION",
    "HAIR_CONSULTATION",
    "CUSTOM_WIG_CREATION",
    "WIG_CUSTOMIZATION",
    "COLOR_SERVICE",
  ]),
  slotId: z.string().cuid("Please select an available time slot"),
  firstName: z.string().min(2, "First name is required").max(50),
  lastName: z.string().min(2, "Last name is required").max(50),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number"),
  notes: z.string().max(1000).optional().or(z.literal("")),
  hairDetails: z
    .object({
      currentHairLength: z.string().optional(),
      desiredLength: z.string().optional(),
      hairCondition: z.string().optional(),
      colorPreference: z.string().optional(),
      additionalInfo: z.string().max(500).optional(),
    })
    .optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
