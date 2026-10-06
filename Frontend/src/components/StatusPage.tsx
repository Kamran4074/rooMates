import Link from "next/link";
import { Logo } from "@/components/Logo";

// Full-screen message used by the 404 and error pages, in the app's style.
export function StatusPage({
  code,
  title,
  message,
  children,
}: {
  code: string;
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 bg-background">
      <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-10" aria-label="RooMates home">
        <Logo size={36} /> RooMates
      </Link>
      <p className="text-sm font-semibold text-primary mb-2">{code}</p>
      <h1 className="text-3xl font-semibold tracking-tight mb-3">{title}</h1>
      <p className="text-foreground/60 max-w-md mb-8">{message}</p>
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </main>
  );
}
