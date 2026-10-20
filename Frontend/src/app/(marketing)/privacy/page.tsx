import { LegalPage } from "@/components/marketing/LegalPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How RooMates collects, uses and protects your data.",
  path: "/privacy",
});

// Describes what the app actually does with data - keep it in step with the
// code (e.g. add a line here before adding analytics or a new provider).
// A starting draft, not legal advice: have it reviewed before launch.
const sections = [
  {
    heading: "Information we collect",
    body: `Account details: your name, email address, Indian mobile number and, if you sign in with Google, your Google profile name and photo. If you sign up with a password we store only a one-way hash of it, never the password itself.

What you add: rooms, expenses, payments, room funds and notes you or your roommates record; room listings, their photos and location; requests and reports you send.

Location: "Near me" search uses your browser's location only for that search and does not store it. A listing's location is stored only if its owner adds it.

Technical data: when you last used the app and which devices are signed in, so you can see your sessions and we can spot abuse.

Usage statistics: we count page visits with Vercel Web Analytics to see which features are used. It uses no cookies, doesn't follow you across sites, and we strip anything personal (like your email) from page addresses before they're counted.`,
  },
  {
    heading: "How we use your information",
    body: `To run the service: sign you in, keep each room's balances, show your listings to people searching, and send account emails (verification and password-reset codes).

To keep it safe: rate limits, spotting fake listings and abuse, and moderation by our team.

To handle plan upgrades: when you request a paid plan, we use the mobile number you give to contact you about payment.

We don't sell your data and we don't show ads.`,
  },
  {
    heading: "Who can see what",
    body: `Members of a room you've joined see your name, email and profile photo, and the expenses and payments in that room.

Your phone number and email are shared with a listing's owner (or the person who asked about your listing) only after a request is accepted.

Published listings, without your contact details, are visible to anyone.`,
  },
  {
    heading: "Service providers",
    body: `We use trusted providers to run RooMates: Neon (database), Render (servers), Vercel (website), Cloudinary (listing photos), Brevo (emails), Vercel Web Analytics (anonymous page-visit counts), Sentry (crash reports, with personal details removed) and Google (if you choose Google sign-in). They process data only to provide their service to us.`,
  },
  {
    heading: "How your data is protected",
    body: `Data travels over HTTPS. Passwords, sign-in tokens and one-time codes are stored only as hashes. Each room's data is separated inside the database itself, so one room can't read another's. Sessions end 24 hours after you sign in.

Your sign-in session is kept in your browser's local storage. We don't use advertising or tracking cookies, and our analytics uses no cookies at all.`,
  },
  {
    heading: "Your rights and deleting your account",
    body: `You can see and correct your profile in Settings at any time.

You can delete your account yourself from Settings > Delete account. This erases your name, email, phone and photo and signs you out everywhere. Expenses and payments you shared stay in those rooms under "Deleted user", because your roommates' balances depend on them. You need to be settled up in every room first.

Under India's Digital Personal Data Protection Act, 2023 you can also ask us for a summary of your data, or raise a grievance, through the contact details below.`,
  },
  {
    heading: "Contact",
    body: `For privacy questions, data requests or grievances, use the Contact page on this site. We aim to reply within 7 days.`,
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated="21 October 2026" sections={sections} />;
}
