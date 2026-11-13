import { SURVIVAL_HP } from "@/lib/engine/scoring";

export function HpBar({ hp }: { hp: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        role="meter"
        aria-label="HP"
        aria-valuemin={0}
        aria-valuemax={SURVIVAL_HP}
        aria-valuenow={hp}
        className="h-2.5 flex-1 overflow-hidden rounded-[5px] bg-line"
      >
        <div className="h-full rounded-[5px] bg-red" style={{ width: `${(hp / SURVIVAL_HP) * 100}%` }} />
      </div>
      <div className="font-display text-lg font-bold">{hp.toFixed(1)} HP</div>
    </div>
  );
}
