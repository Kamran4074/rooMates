import Image from "next/image";
import Link from "next/link";
import {
  Home as HomeIcon,
  Plane,
  Split,
  Zap,
  Link2,
  ShieldCheck,
  UserPlus,
  Receipt,
  HandCoins,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/ui/Card";
import { JsonLd } from "@/components/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

const homeTitle = `${site.name} — Split rent, bills & trip expenses with roommates`;

// `absolute` skips the root layout's "%s | RooMates" template - the brand is already in this title.
export const metadata = {
  ...pageMetadata({ title: homeTitle, description: site.description, path: "/" }),
  title: { absolute: homeTitle },
};

const features = [
  { icon: HomeIcon, title: "Rooms for your flat", desc: "One room per flat for recurring rent, groceries and bills — settle up every month." },
  { icon: Plane, title: "Rooms for trips", desc: "Spin up a room for a Goa trip or a fest, settle once when it's over." },
  { icon: Split, title: "Equal or custom splits", desc: "Split evenly, or set exact shares when someone skipped dinner. Accurate to the paisa." },
  { icon: Zap, title: "Fewest payments to settle", desc: "Our debt-simplification algorithm turns a web of IOUs into the smallest set of payments." },
  { icon: Link2, title: "Invite with a code", desc: "Share an 8-character invite code — roommates join in seconds." },
  { icon: ShieldCheck, title: "Private by design", desc: "Each room's data is isolated at the database level. Only members can ever see it." },
];

const steps = [
  { icon: UserPlus, title: "Create a room", desc: "Sign up free, make a room for your flat or trip, and share the invite code." },
  { icon: Receipt, title: "Add expenses", desc: "Whoever pays adds it. Split equally or with custom amounts." },
  { icon: HandCoins, title: "Settle up", desc: "See exactly who pays whom — in the minimum number of payments." },
];

const example = [
  { name: "Aman", paid: 1150, net: -285 },
  { name: "Bhavya", paid: 1390, net: -45 },
  { name: "Chirag", paid: 1765, net: 330 },
];

const faqs = [
  {
    q: "Is RooMates free?",
    a: "Yes. The free plan includes up to 2 rooms, which covers most people's flat plus a trip. Unlimited rooms will be available on a paid plan.",
  },
  {
    q: "How does RooMates decide who pays whom?",
    a: "It adds up what everyone paid and what everyone owes, then uses a greedy debt-simplification algorithm to settle all balances in the fewest possible payments — instead of everyone paying everyone.",
  },
  {
    q: "Can I use it for trips as well as my flat?",
    a: "Yes. Create a 'roommates' room for recurring monthly costs and a separate 'trip' room for one-time trips or events. You can be in many rooms from one account.",
  },
  {
    q: "Can other people see my expenses?",
    a: "Only members of the same room. Access is enforced by the database itself (row-level security), not just the app, so one room's data can't leak into another.",
  },
  {
    q: "Do I need to sign up with Google?",
    a: "No. You can sign up with Google or with an email and password (verified with a one-time code sent to your email).",
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: site.name,
          url: site.url,
          description: site.description,
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />

      {/* Hero */}
      <section className="bg-linear-to-b from-primary/10 to-background">
        <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="inline-block text-sm font-medium px-3 py-1 rounded-full bg-accent/15 text-accent mb-5">
              Made for flatmates & trip squads
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-secondary dark:text-foreground leading-tight">
              Split rent, bills & trips with roommates — without the awkward math
            </h1>
            <p className="text-lg text-foreground/60 mt-6 max-w-xl">
              Add an expense once. RooMates keeps a running balance for everyone and tells you exactly who owes whom, in the fewest payments possible.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/signup"
                className="px-6 py-3 rounded-lg bg-primary text-white font-medium shadow-lg shadow-primary/30 hover:bg-primary-dark inline-flex items-center gap-2"
              >
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/#how-it-works" className="px-6 py-3 rounded-lg border border-card-border font-medium hover:bg-foreground/5">
                See how it works
              </Link>
            </div>
          </div>
          <div className="relative max-w-md mx-auto w-full">
            <Image
              src="/roomates-logo.png"
              alt="Roommates sharing a flat — RooMates helps them split expenses"
              width={730}
              height={768}
              priority
              className="w-full h-auto rounded-3xl shadow-2xl"
            />
          </div>
        </div>
      </section>

      <Section id="features" eyebrow="Features" title="Everything a shared flat needs" subtitle="No spreadsheets, no group-chat arguments, no forgotten IOUs.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-6">
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-1">{title}</h3>
              <p className="text-foreground/60 text-sm">{desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="how-it-works" eyebrow="How it works" title="Three steps to a settled flat" className="bg-card rounded-3xl">
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="text-center">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-accent/15 text-accent flex items-center justify-center mb-4">
                <Icon className="h-6 w-6" />
              </div>
              <p className="text-xs font-semibold text-foreground/40 mb-1">STEP {i + 1}</p>
              <h3 className="font-semibold text-lg mb-1">{title}</h3>
              <p className="text-foreground/60 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Smart settle-up"
        title="3 roommates, 1 month, just 2 payments"
        subtitle="Everyone paid for different things. The fair share is ₹1,435 each — here's the simplest way to square up."
      >
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">What everyone paid</h3>
            <ul className="flex flex-col gap-3">
              {example.map((p) => (
                <li key={p.name} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span>₹{p.paid.toLocaleString("en-IN")}</span>
                  <span className={p.net >= 0 ? "text-success font-medium" : "text-danger font-medium"}>
                    {p.net >= 0 ? `gets ₹${p.net}` : `owes ₹${-p.net}`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6 border-primary/40">
            <h3 className="font-semibold mb-4">RooMates says</h3>
            <ul className="flex flex-col gap-3">
              {[
                { from: "Aman", to: "Chirag", amount: 285 },
                { from: "Bhavya", to: "Chirag", amount: 45 },
              ].map((s) => (
                <li key={s.from} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{s.from}</span>
                  <ArrowRight className="h-4 w-4 text-foreground/40" />
                  <span className="font-medium">{s.to}</span>
                  <span className="ml-auto font-semibold text-primary">₹{s.amount}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-foreground/50 mt-5">Done. Everyone&apos;s square.</p>
          </Card>
        </div>
      </Section>

      <Section id="faq" eyebrow="FAQ" title="Questions, answered">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {faqs.map((f) => (
            <Card as="details" key={f.q} className="group p-5">
              <summary className="list-none flex items-center justify-between cursor-pointer font-medium">
                {f.q}
                <ChevronDown className="h-4 w-4 text-foreground/40 transition-transform group-open:rotate-180" />
              </summary>
              <p className="text-foreground/60 text-sm mt-3">{f.a}</p>
            </Card>
          ))}
        </div>
      </Section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="rounded-3xl bg-panel text-white px-8 py-14 text-center">
          <h2 className="text-3xl font-bold mb-3">Stop chasing your roommates for money</h2>
          <p className="text-white/70 mb-8">Create your first room in under a minute. Free forever for up to 2 rooms.</p>
          <Link href="/signup" className="px-6 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark inline-flex items-center gap-2">
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
