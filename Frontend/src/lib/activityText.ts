import { rupees } from "./format";
import type { ActivityEvent } from "./types";

// Used by the Notifications feed and the live-update toasts, so both say the same thing.
// One feed row in plain words: "Kamran added Groceries · ₹600".
export function describeActivity(e: ActivityEvent, myId?: string): string {
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
