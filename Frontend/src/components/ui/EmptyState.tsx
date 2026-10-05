import { Card } from "./Card";

// The "nothing here yet" screen, so no list ever renders as a blank page.
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl p-10 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      {children && <div className="text-foreground/55 max-w-sm mx-auto">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}
