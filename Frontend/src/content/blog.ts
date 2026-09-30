export type Block = { type: "p"; text: string } | { type: "h2"; text: string } | { type: "ul"; items: string[] };

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readingMinutes: number;
  body: Block[];
}

export const posts: BlogPost[] = [
  {
    slug: "how-to-split-rent-fairly-with-roommates",
    title: "How to split rent fairly with roommates",
    description:
      "Equal split, room size, or income-based? A practical guide to splitting rent and shared bills with roommates without the awkward conversations.",
    date: "2026-09-20",
    readingMinutes: 5,
    body: [
      { type: "p", text: "Rent is usually the biggest shared expense in a flat — and the one most likely to cause friction if it feels unfair. There's no single right answer, but there are a few methods that most roommates agree are reasonable." },
      { type: "h2", text: "1. Split it equally" },
      { type: "p", text: "The simplest option: total rent divided by the number of people. It works well when rooms are roughly the same size and everyone uses the common areas equally." },
      { type: "h2", text: "2. Split by room size" },
      { type: "p", text: "If one room is noticeably bigger, has an attached bathroom or a balcony, a fair approach is to split the private-room portion by square footage and share the common-area portion equally." },
      { type: "h2", text: "3. Agree once, then track everything" },
      { type: "p", text: "Whichever method you pick, the real problem is rarely rent itself — it's the dozens of small expenses on top: groceries, electricity, Wi-Fi, cleaning supplies. These are what get forgotten and cause arguments at month-end." },
      { type: "ul", items: ["Log every shared expense the day it happens.", "Decide per-expense whether it's split equally or custom.", "Settle up once a month instead of after every purchase."] },
      { type: "p", text: "RooMates is built for exactly this: add each expense once, and at the end of the month it tells everyone exactly who owes whom — in the fewest possible payments." },
    ],
  },
  {
    slug: "how-to-split-trip-expenses-with-friends",
    title: "How to split trip expenses with friends (without a spreadsheet)",
    description:
      "Planning a group trip? Here's how to track shared costs like stays, cabs and food, and settle up quickly when you're back.",
    date: "2026-09-24",
    readingMinutes: 4,
    body: [
      { type: "p", text: "Group trips are fun right up until someone opens a spreadsheet on the last day. Different people pay for the stay, the cab, the dinner and the tickets — and untangling it later is painful." },
      { type: "h2", text: "Pick one place to log expenses" },
      { type: "p", text: "The single most useful rule: every shared expense goes into one shared place, logged by whoever paid, as soon as they pay. No 'I'll add it later'." },
      { type: "h2", text: "Not everything is split equally" },
      { type: "p", text: "Someone skipped the paragliding; two people shared a separate room. Use custom splits for these instead of forcing an equal split and 'adjusting' later." },
      { type: "ul", items: ["Stay and fuel: usually equal.", "Activities: only the people who joined.", "Food: equal, unless someone ordered very differently."] },
      { type: "h2", text: "Settle once, at the end" },
      { type: "p", text: "Instead of everyone transferring money to everyone, simplify the debts first. In a trip room on RooMates, the settle-up view shows the minimum set of payments that squares everyone up." },
    ],
  },
  {
    slug: "how-debt-simplification-works",
    title: "Who owes who? How debt simplification works",
    description:
      "A plain-English look at the algorithm that turns a messy web of IOUs between roommates into the fewest payments needed to settle up.",
    date: "2026-09-27",
    readingMinutes: 6,
    body: [
      { type: "p", text: "Say three roommates each paid for different things over a month: ₹1,150, ₹1,390 and ₹1,765. The total is ₹4,305, so each person's fair share is ₹1,435." },
      { type: "h2", text: "Step 1: Work out net balances" },
      { type: "p", text: "Instead of tracking every individual IOU, compute one number per person: what they paid minus what they owe. That gives -₹285, -₹45 and +₹330. Positive means you should receive money; negative means you should pay. These always add up to zero." },
      { type: "h2", text: "Step 2: Match biggest debtor with biggest creditor" },
      { type: "p", text: "Sort people into those who owe and those who are owed. Repeatedly take the person who owes the most and the person who is owed the most, and settle as much as possible between them. Whoever reaches zero drops out; repeat until everyone is at zero." },
      { type: "ul", items: ["The ₹285 debtor pays the creditor ₹285 (creditor now needs ₹45 more).", "The ₹45 debtor pays the creditor ₹45.", "Done: 2 payments instead of up to 6."] },
      { type: "h2", text: "Why not always the absolute minimum?" },
      { type: "p", text: "This greedy approach always settles everyone in at most n−1 payments for n people, and is optimal in the common case. Guaranteeing the absolute minimum for every possible set of balances is an NP-hard problem, so for real-time use the greedy method is the practical, predictable choice." },
      { type: "h2", text: "Money as whole paise" },
      { type: "p", text: "One more detail that matters: amounts are stored as whole paise, never as floating-point rupees, and uneven splits distribute the leftover paise deterministically — so the numbers always add up exactly." },
    ],
  },
];

export function getPost(slug: string) {
  return posts.find((p) => p.slug === slug);
}
