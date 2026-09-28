import { LegalPage } from "@/components/marketing/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How RooMates collects, uses and protects your data.",
  path: "/privacy",
});

// TODO(owner): replace each section body with your own policy.
const sections = [
  { heading: "Information we collect", body: "Write your policy here." },
  { heading: "How we use your information", body: "Write your policy here." },
  { heading: "How your data is protected", body: "Write your policy here." },
  { heading: "Sharing your information", body: "Write your policy here." },
  { heading: "Your rights", body: "Write your policy here." },
  { heading: "Contact", body: "Write your policy here." },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated="28 September 2026" sections={sections} />;
}
