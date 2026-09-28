import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Create your free account",
  description: "Sign up for RooMates free — split rent, bills and trip expenses with roommates and friends.",
  path: "/signup",
});

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
