import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans, DM_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@/components/seo/Analytics";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
  preload: true,
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
  preload: true,
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://rihaircollectables.com"
  ),
  title: {
    default: "RI Hair Collectables — Premium Luxury Hair",
    template: "%s | RI Hair Collectables",
  },
  description:
    "Discover premium human hair wigs, bundles, and extensions. Brazilian, Peruvian, Cambodian & Indian raw virgin hair. HD lace, transparent lace. Shipped worldwide.",
  keywords: [
    "luxury hair wigs",
    "human hair wigs",
    "HD lace wigs",
    "frontal wigs",
    "closure wigs",
    "Brazilian hair",
    "Peruvian hair",
    "raw virgin hair",
    "hair bundles",
    "wig installation Nigeria",
    "premium hair UK",
    "RI Hair Collectables",
  ],
  authors: [{ name: "RI Hair Collectables" }],
  creator: "RI Hair Collectables",
  publisher: "RI Hair Collectables",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "RI Hair Collectables",
    title: "RI Hair Collectables — Premium Luxury Hair",
    description:
      "Premium human hair wigs & bundles. Brazilian, Peruvian, Cambodian & Indian raw virgin hair. HD lace wigs. Shipped to Nigeria, Ghana, UK, USA & Canada.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "RI Hair Collectables — Premium Luxury Hair",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RI Hair Collectables — Premium Luxury Hair",
    description:
      "Premium human hair wigs & bundles. HD lace. Ships to Nigeria, Ghana, UK, USA & Canada.",
    images: ["/og-image.jpg"],
    creator: "@rihaircollectables",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/icons/safari-pinned-tab.svg",
        color: "#C9A84C",
      },
    ],
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/",
      "en-GB": "/",
      "en-NG": "/",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <SchemaOrg />
      </head>
      <body className="min-h-screen bg-surface-primary text-text-primary antialiased">
        <SessionProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#1E1E1E",
                color: "#FAFAF8",
                border: "1px solid #3A3A3A",
                borderRadius: "12px",
                fontSize: "14px",
                fontFamily: "var(--font-dm-sans)",
              },
              success: {
                iconTheme: {
                  primary: "#C9A84C",
                  secondary: "#0A0A0A",
                },
              },
              error: {
                iconTheme: {
                  primary: "#F44336",
                  secondary: "#FAFAF8",
                },
              },
            }}
          />
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
