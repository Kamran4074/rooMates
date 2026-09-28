import { LegalPage } from "@/components/marketing/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms and Conditions",
  description: "The terms that govern your use of RooMates.",
  path: "/terms",
});

// TODO(owner): replace each section body with your own terms. Headings are a
// suggested structure only - add, remove or rename sections freely.
const sections = [
  { heading: "Acceptance of terms", body: "Write your terms here." },
  { heading: "Your account", body: "Write your terms here." },
  { heading: "Using RooMates", body: "Write your terms here." },
  { heading: "Payments and subscriptions", body: "Write your terms here." },
  { heading: "Limitation of liability", body: "Write your terms here." },
  { heading: "Changes to these terms", body: "Write your terms here." },
  { heading: "Contact", body: "Write your terms here." },
];

export default function TermsPage() {
  return <LegalPage title="Terms and Conditions" updated="28 September 2026" sections={sections} />;
}
