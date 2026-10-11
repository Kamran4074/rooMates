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
import { describeActivity } from "@/lib/activityText";
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
          <span className="block text-sm">{describeActivity(event, myId)}</span>
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
