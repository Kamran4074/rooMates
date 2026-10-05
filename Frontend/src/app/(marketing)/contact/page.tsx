import { Mail } from "lucide-react";
import { ContactForm } from "@/components/marketing/ContactForm";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Contact us",
  description: "Questions, feedback or a bug to report? Get in touch with the RooMates team.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-12">
      <div>
        <h1 className="text-4xl font-bold text-secondary dark:text-foreground mb-4">Get in touch</h1>
        <p className="text-foreground/60 text-lg mb-8">
          Found a bug, have a feature idea, or just want to say hi? Send us a message and we&apos;ll get back to you.
        </p>
        <a href={`mailto:${site.contactEmail}`} className="inline-flex items-center gap-2 text-primary font-medium">
          <Mail className="h-4 w-4" /> {site.contactEmail}
        </a>
      </div>
      <ContactForm />
    </div>
  );
}
