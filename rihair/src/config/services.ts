import type { ServiceDetails } from "@/types";

export const BOOKING_SERVICES: ServiceDetails[] = [
  {
    id: "WIG_INSTALLATION",
    name: "Wig Installation",
    description:
      "Professional wig installation by our expert stylists. Includes prep, application, and styling. Duration includes consultation.",
    duration: 120,
    price: 80,
    currency: "USD",
    depositRequired: true,
    depositAmount: 25,
  },
  {
    id: "HAIR_CONSULTATION",
    name: "Hair Consultation",
    description:
      "One-on-one consultation to help you find the perfect wig or hair solution. We assess your lifestyle, preferences, and budget.",
    duration: 45,
    price: 30,
    currency: "USD",
    depositRequired: false,
  },
  {
    id: "CUSTOM_WIG_CREATION",
    name: "Custom Wig Creation",
    description:
      "Bespoke wig crafted to your exact specifications — origin, texture, length, density, colour, and lace type. Includes fitting and styling.",
    duration: 180,
    price: 250,
    currency: "USD",
    depositRequired: true,
    depositAmount: 100,
  },
  {
    id: "WIG_CUSTOMIZATION",
    name: "Wig Customisation",
    description:
      "Transform your existing wig — bleached knots, baby hair application, tinting, cutting, or styling to suit your look.",
    duration: 90,
    price: 60,
    currency: "USD",
    depositRequired: true,
    depositAmount: 20,
  },
  {
    id: "COLOR_SERVICE",
    name: "Colour Service",
    description:
      "Professional colour application on your wig or bundles. Includes toning, highlights, ombre, and full colour change.",
    duration: 150,
    price: 120,
    currency: "USD",
    depositRequired: true,
    depositAmount: 40,
  },
];
