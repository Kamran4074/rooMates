export const site = {
  name: "RooMates",
  tagline: "Split rent, bills & trips — settle up in the fewest payments",
  description:
    "RooMates is a free expense splitter for roommates and trip groups. Add shared expenses, split them equally or custom, and settle up with the minimum number of payments.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  contactEmail: "hello.roomatess@gmail.com",
  keywords: [
    "split rent with roommates",
    "roommate expense tracker",
    "split bills app",
    "trip expense splitter",
    "splitwise alternative",
    "shared expenses India",
    "who owes who",
  ],
  nav: [
    { href: "/#features", label: "Features" },
    { href: "/about", label: "About" },
    { href: "/blog", label: "Blog" },
    { href: "/contact", label: "Contact" },
  ],
};
