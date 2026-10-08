import { Check } from "lucide-react";
import type { Member } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

// Tick who's included - a bill section's people, or who shares one expense.
// Real toggle buttons (aria-pressed) so it works with a keyboard and screen readers.
export function MemberPicker({
  members,
  selected,
  onChange,
  myId,
  label = "Who shares it?",
}: {
  members: Pick<Member, "user_id" | "name" | "picture">[];
  selected: string[];
  onChange: (ids: string[]) => void;
  myId?: string;
  label?: string;
}) {
  const all = selected.length === members.length;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">{label}</p>
        <button
          type="button"
          onClick={() => onChange(all ? [] : members.map((m) => m.user_id))}
          className="text-xs font-medium text-primary"
        >
          {all ? "Clear" : "Everyone"}
        </button>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
        {members.map((m) => {
          const on = selected.includes(m.user_id);
          return (
            <li key={m.user_id}>
              <button
                type="button"
                onClick={() => toggle(m.user_id)}
                aria-pressed={on}
                className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  on ? "border-primary bg-primary/5" : "border-card-border text-foreground/50"
                }`}
              >
                <Avatar name={m.name} picture={m.picture} size={24} />
                <span className="flex-1 truncate">
                  {m.name}
                  {m.user_id === myId && <span className="text-foreground/45"> (you)</span>}
                </span>
                {on && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
