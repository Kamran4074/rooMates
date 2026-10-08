import Link from "next/link";

// One sidebar item; shared by the member sidebar and the admin console sidebar.
export function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 h-10 px-3 rounded-xl text-sm transition-colors ${
        active ? "bg-primary/15 text-primary font-semibold" : "text-foreground/75 hover:bg-foreground/5"
      }`}
    >
      {children}
    </Link>
  );
}
