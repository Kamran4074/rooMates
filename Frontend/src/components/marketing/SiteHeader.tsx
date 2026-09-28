import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import { site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-card-border bg-background/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Logo size={32} />
          {site.name}
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-foreground/70">
          {site.nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-primary">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/signin" className="text-sm font-medium hover:text-primary">
            Sign In
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium px-4 py-2 rounded-lg bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary-dark"
          >
            Get started free
          </Link>
        </div>

        {/* <details> gives a working mobile menu with zero client JS. */}
        <details className="md:hidden relative">
          <summary className="list-none p-2 cursor-pointer" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </summary>
          <div className="absolute right-0 mt-2 w-52 bg-card border border-card-border rounded-xl shadow-xl p-3 flex flex-col gap-1">
            {site.nav.map((item) => (
              <Link key={item.href} href={item.href} className="px-3 py-2 rounded-lg hover:bg-foreground/5 text-sm">
                {item.label}
              </Link>
            ))}
            <Link href="/signin" className="px-3 py-2 rounded-lg hover:bg-foreground/5 text-sm">
              Sign In
            </Link>
            <Link href="/signup" className="px-3 py-2 rounded-lg bg-primary text-white text-sm text-center">
              Get started free
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
