import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ielts-pro.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "The IELTS Exam — Full-Length Mock Tests & Band Score Analytics",
    template: "%s | The IELTS Exam",
  },
  description:
    "Master the IELTS exam with full mock tests, AI speaking evaluation, band analytics, and personalised preparation trusted by 50,000+ students worldwide.",
  keywords: [
    "IELTS",
    "IELTS mock test",
    "IELTS practice test",
    "IELTS preparation",
    "IELTS listening",
    "IELTS reading",
    "IELTS writing",
    "IELTS speaking",
    "band score",
    "IELTS online",
    "IELTS Academic",
    "IELTS General Training",
  ],
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "The IELTS Exam",
    title: "The IELTS Exam — Full-Length Mock Tests & Band Score Analytics",
    description:
      "Master the IELTS exam with full mock tests, AI speaking evaluation, band analytics, and personalised preparation.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "The IELTS Exam — Practice Smarter, Score Higher",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The IELTS Exam — Full-Length Mock Tests",
    description:
      "Practice with realistic IELTS simulations and track your band score progress.",
    images: ["/og-image.png"],
  },
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jakarta.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
