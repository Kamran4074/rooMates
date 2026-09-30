import { Home as HomeIcon, Plane } from "lucide-react";
import type { RoomType } from "@/lib/types";

export function RoomIcon({ type, size = "md" }: { type: RoomType; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7 rounded-lg" : "h-10 w-10 rounded-xl";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  const colors = type === "trip" ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary";
  return (
    <span className={`${box} ${colors} flex items-center justify-center shrink-0`}>
      {type === "trip" ? <Plane className={icon} /> : <HomeIcon className={icon} />}
    </span>
  );
}
