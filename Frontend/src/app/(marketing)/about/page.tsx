import Link from "next/link";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/ui/Card";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About RooMates",
  description: "Why we built RooMates — a simpler, fairer way for roommates and friends to split shared expenses and settle up.",
  path: "/about",
});

const values = [
  { title: "Fair by default", desc: "Every rupee is tracked to the paisa, and settle-ups are calculated, not argued over." },
  { title: "Less money talk", desc: "The app keeps the tally, so friends and flatmates don't have to chase each other." },
  { title: "Private by design", desc: "Your room's expenses are visible only to your room — enforced by the database itself." },
];

export default function AboutPage() {
  return (
    <>
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-secondary dark:text-foreground mb-6">
          Shared living, without the shared headaches
        </h1>
        <p className="text-lg text-foreground/60">
          RooMates started with a familiar problem: a flat full of friends, a month full of shared expenses, and a
          group chat full of &quot;who paid for the milk again?&quot;. We built the tool we wished we had — one place
          to log expenses, and a clear answer to who owes whom at the end of the month.
        </p>
      </div>

      <Section title="What we believe">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {values.map((v) => (
            <Card key={v.title} className="p-6">
              <h3 className="font-semibold text-lg mb-2">{v.title}</h3>
              <p className="text-foreground/60 text-sm">{v.desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      <div className="text-center pb-24">
        <Link href="/signup" className="px-6 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark">
          Start splitting fairly
        </Link>
      </div>
    </>
  );
}
