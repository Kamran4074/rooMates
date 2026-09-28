export interface LegalSection {
  heading: string;
  body: string;
}

export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold text-secondary dark:text-foreground mb-2">{title}</h1>
      <p className="text-sm text-foreground/50 mb-10">Last updated: {updated}</p>
      {sections.map((s, i) => (
        <section key={s.heading} className="mb-8">
          <h2 className="text-xl font-semibold mb-2">
            {i + 1}. {s.heading}
          </h2>
          <p className="text-foreground/70 leading-relaxed whitespace-pre-line">{s.body}</p>
        </section>
      ))}
    </div>
  );
}
