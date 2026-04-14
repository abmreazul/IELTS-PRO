import { HomePage } from "@/components/home/home-page";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ielts-pro.vercel.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "IELTS Pro",
  url: SITE_URL,
  description:
    "Master the IELTS exam with full mock tests, AI speaking evaluation, band analytics, and personalised preparation.",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "29",
    highPrice: "99",
    offerCount: "3",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage />
    </>
  );
}
