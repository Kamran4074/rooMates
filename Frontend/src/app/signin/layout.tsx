import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to RooMates to see your rooms, balances and who owes whom.",
  path: "/signin",
});

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
