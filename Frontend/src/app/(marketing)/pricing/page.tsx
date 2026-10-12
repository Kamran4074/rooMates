import { pageMetadata } from "@/lib/seo";
import { PublicPricing } from "@/components/plans/PublicPricing";

export const metadata = pageMetadata({
  title: "Pricing",
  description: "Split rent and bills free on Basic. Standard and Premium add room funds, bill sections, Find a room and bigger groups.",
  path: "/pricing",
});

const FAQ = [
  {
    q: "Is Basic really free?",
    a: "Yes, for as long as you like: split expenses and settle up in up to 2 rooms of 4 people, flats or trips.",
  },
  {
    q: "How do I pay for Standard or Premium?",
    a: "Pick a plan and leave your mobile number. We call you, take the payment by UPI or bank transfer, and your plan is on straight away. Card payments are coming soon.",
  },
  {
    q: "What happens when my plan ends?",
    a: "You're back on Basic. Nothing is deleted: your rooms, expenses and existing funds stay. Starting new funds or sections, Find a room and adding people beyond 4 per room wait until you renew.",
  },
  {
    q: "Whose plan counts in a shared room?",
    a: "The room admin's - the person who created the room. Everyone in it gets that plan's features in that room.",
  },
];

export default function PricingPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="text-4xl font-bold text-secondary dark:text-foreground mb-4">Simple pricing for shared living</h1>
        <p className="text-foreground/60 text-lg">Start free. Upgrade when your flat or trip needs more.</p>
      </div>
      <PublicPricing />
      <div className="max-w-3xl mx-auto mt-20">
        <h2 className="text-2xl font-semibold mb-6">Questions</h2>
        <dl className="flex flex-col gap-6">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="font-medium mb-1">{item.q}</dt>
              <dd className="text-foreground/60">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
