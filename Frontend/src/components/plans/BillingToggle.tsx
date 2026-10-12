import type { BillingCycle } from "@/lib/types";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

export function BillingToggle({ value, onChange }: { value: BillingCycle; onChange: (cycle: BillingCycle) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-60">
        <SegmentedControl
          value={value}
          onChange={onChange}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
          ]}
        />
      </div>
      <span className="text-xs font-semibold text-success">Yearly: 2 months free</span>
    </div>
  );
}
