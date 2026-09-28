export function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`max-w-6xl mx-auto px-6 py-20 scroll-mt-16 ${className ?? ""}`}>
      <div className="text-center max-w-2xl mx-auto mb-12">
        {eyebrow && <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">{eyebrow}</p>}
        <h2 className="text-3xl sm:text-4xl font-bold text-secondary dark:text-foreground">{title}</h2>
        {subtitle && <p className="text-foreground/60 mt-4 text-lg">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
