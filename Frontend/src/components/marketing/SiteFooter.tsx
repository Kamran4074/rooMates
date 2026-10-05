import Link from "next/link";
import { Logo } from "@/components/Logo";
import { site } from "@/lib/site";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#faq", label: "FAQ" },
      { href: "/signup", label: "Get started" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-card-border bg-card mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 gap-10 md:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-3">
            <Logo size={28} />
            {site.name}
          </Link>
          <p className="text-sm text-foreground/60">{site.tagline}</p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="font-semibold text-sm mb-3">{col.title}</h3>
            <ul className="flex flex-col gap-2 text-sm text-foreground/60">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-card-border py-5 text-center text-xs text-foreground/50">
        © {new Date().getFullYear()} {site.name}. All rights reserved.
      </div>
    </footer>
  );
}
