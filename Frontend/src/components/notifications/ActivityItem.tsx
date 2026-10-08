import Link from "next/link";
import {
  ArrowRightLeft,
  CheckCircle2,
  Flag,
  HandCoins,
  LogIn,
  LogOut,
  PiggyBank,
  Receipt,
  ShoppingBag,
  Trash2,
  UserMinus,
} from "lucide-react";
import { rupees } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

const ICONS: Record<ActivityEvent["type"], { icon: typeof Receipt; tone: string }> = {
  expense_added: { icon: Receipt, tone: "bg-primary/10 text-primary" },
  expense_deleted: { icon: Trash2, tone: "bg-danger/10 text-danger" },
  payment_recorded: { icon: ArrowRightLeft, tone: "bg-success/10 text-success" },
  payment_deleted: { icon: Trash2, tone: "bg-danger/10 text-danger" },
  fund_opened: { icon: PiggyBank, tone: "bg-accent/15 text-accent" },
  fund_closed: { icon: PiggyBank, tone: "bg-foreground/8 text-foreground/60" },
  fund_payment_recorded: { icon: HandCoins, tone: "bg-accent/15 text-accent" },
  fund_payment_approved: { icon: CheckCircle2, tone: "bg-success/10 text-success" },
  fund_payment_disputed: { icon: Flag, tone: "bg-danger/10 text-danger" },
  fund_spend: { icon: ShoppingBag, tone: "bg-accent/15 text-accent" },
  fund_settled: { icon: CheckCircle2, tone: "bg-success/10 text-success" },
  member_joined: { icon: LogIn, tone: "bg-primary/10 text-primary" },
  member_left: { icon: LogOut, tone: "bg-foreground/8 text-foreground/60" },
  member_removed: { icon: UserMinus, tone: "bg-foreground/8 text-foreground/60" },
};

// One feed row in plain words: "Kamran added Groceries · ₹600".
function describe(e: ActivityEvent, myId?: string) {
  const who = (id: string | null, name: string | null, you = "You") => (id && id === myId ? you : (name ?? "Former member"));
  const actor = who(e.actor_id, e.actor_name);
  const subject = who(e.subject_id, e.subject_name);
  const subjectLower = who(e.subject_id, e.subject_name, "you");
  const amount = e.amount_paise !== null ? rupees(e.amount_paise) : "";
  const fund = e.data.fund ?? "the fund";
  const sameActor = e.actor_id !== null && e.actor_id === e.subject_id;

  switch (e.type) {
    case "expense_added":
      return `${actor} added ${e.data.description} · ${amount}${sameActor ? "" : ` (paid by ${subjectLower})`}`;
    case "expense_deleted":
      return `${actor} deleted the expense ${e.data.description} (${amount})`;
    case "payment_recorded":
      return `${subject} paid ${e.to_name ?? "someone"} ${amount}${sameActor ? "" : ` · recorded by ${actor}`}`;
    case "payment_deleted":
      return `${actor} deleted a payment of ${amount} from ${subjectLower} to ${e.to_name ?? "someone"}`;
    case "fund_opened":
      return `${actor} started ${fund}: ${amount} per person, collected by ${subjectLower}`;
    case "fund_closed":
      return `${fund} was closed and the leftover settled`;
    case "fund_payment_recorded":
      return sameActor
        ? `${subject} recorded paying ${amount} into ${fund}${e.data.confirmed ? "" : " · waiting for the collector"}`
        : `${actor} recorded ${subjectLower === "you" ? "your" : `${subject}'s`} ${amount} into ${fund}${e.data.confirmed ? "" : ` · waiting for ${subjectLower} to approve`}`;
    case "fund_payment_approved":
      return sameActor
        ? `${actor} approved ${e.actor_id === myId ? "your" : "their"} ${amount} payment into ${fund}`
        : `${actor} confirmed receiving ${amount} from ${subjectLower} for ${fund}`;
    case "fund_payment_disputed":
      return `${actor} disputed the ${amount} recorded for ${e.actor_id === myId ? "you" : "them"} in ${fund}${e.data.note ? `: “${e.data.note}”` : ""}`;
    case "fund_spend":
      return `${actor} spent ${amount} from ${fund}${e.data.description ? ` on ${e.data.description}` : ""}`;
    case "fund_settled":
      return `${fund}: ${amount} ${e.data.kind === "refund" ? "refunded to" : "collected from"} ${subjectLower}`;
    case "member_joined":
      return `${subject} joined`;
    case "member_left":
      return `${subject} left`;
    case "member_removed":
      return `${actor} removed ${subjectLower}`;
  }
}

export function ActivityItem({ event, myId, showRoom }: { event: ActivityEvent; myId?: string; showRoom: boolean }) {
  const { icon: Icon, tone } = ICONS[event.type] ?? ICONS.expense_added;
  const href = event.data.fund_id ? `/rooms/${event.room_id}/fund` : `/rooms/${event.room_id}`;
  return (
    <li>
      <Link href={href} className={`flex items-start gap-3 rounded-2xl px-3 py-3 hover:bg-foreground/3 ${event.unread ? "bg-primary/5" : ""}`}>
        <span className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm">{describe(event, myId)}</span>
          <span className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-foreground/50">
            {time(event.created_at)}
            {showRoom && <> · {event.room_name}</>}
            {event.data.category && <Badge>{event.data.category}</Badge>}
          </span>
        </span>
        {event.unread && <span className="h-2 w-2 mt-2 rounded-full bg-primary shrink-0" aria-label="New" />}
      </Link>
    </li>
  );
}
