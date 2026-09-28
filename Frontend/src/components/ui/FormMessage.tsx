export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) return <p className="text-danger text-sm">{error}</p>;
  if (success) return <p className="text-success text-sm">{success}</p>;
  return null;
}
