import { LegalPage } from "@/components/marketing/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms and Conditions",
  description: "The terms that govern your use of RooMates.",
  path: "/terms",
});

// A starting draft that matches how the app works, not legal advice: have
// it reviewed before launch.
const sections = [
  {
    heading: "Acceptance of terms",
    body: `By creating an account or using RooMates you agree to these terms and to our Privacy Policy. If you don't agree, please don't use the service.`,
  },
  {
    heading: "Your account",
    body: `You must be at least 18 years old and give accurate details, including a mobile number that belongs to you. One person, one account. You're responsible for keeping your password safe and for what happens under your account. You can delete your account at any time from Settings.`,
  },
  {
    heading: "Expense rooms",
    body: `RooMates is a record-keeping tool. It shows who paid what and suggests how to settle up, but it doesn't hold or move money. Payments between roommates happen outside the app, and the records are only as accurate as what members enter. Disagreements over money are between the members of the room.`,
  },
  {
    heading: "Room listings",
    body: `List only rooms you have the right to rent out, with honest details and real photos. Listings are reviewed before they go live and can be removed if they're fake, misleading, already rented or break the law. RooMates isn't a party to any rental agreement: check the room, the person and the paperwork yourself, and never pay a deposit before seeing the room.`,
  },
  {
    heading: "Acceptable use",
    body: `Don't harass other users, post spam or illegal content, scrape the service, try to break its security, or create accounts to get around plan limits. We may suspend or delete accounts that do.`,
  },
  {
    heading: "Plans and payments",
    body: `The Basic plan is free. Paid plans are for the period you pay for (a month or a year) and are activated once we've received your payment. When a paid plan ends your account moves back to Basic; nothing you've created is deleted. Prices are shown on the Pricing page and may change, but a change won't affect a period you've already paid for.`,
  },
  {
    heading: "Limitation of liability",
    body: `RooMates is provided "as is". We work to keep it running and your data safe, but we can't promise it will always be available or error-free. To the extent the law allows, we aren't liable for losses arising from disputes between users, rental arrangements, or amounts recorded in the app.`,
  },
  {
    heading: "Changes to these terms",
    body: `We may update these terms. If a change is significant we'll tell you in the app before it takes effect. Continuing to use RooMates afterwards means you accept the new terms. These terms are governed by the laws of India.`,
  },
  {
    heading: "Contact",
    body: `Questions about these terms? Reach us through the Contact page on this site.`,
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms and Conditions" updated="21 October 2026" sections={sections} />;
}
