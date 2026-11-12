import type { Fighter } from "@/lib/engine/types";
import { fighterImage } from "@/lib/images";

export function Avatar({ fighter, corner }: { fighter: Fighter; corner: "blue" | "red" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation
    <img
      src={fighterImage(fighter.id, fighter.hasImage)}
      alt={fighter.name}
      width={44}
      height={44}
      className={`size-11 shrink-0 rounded-full border object-cover ${corner === "blue" ? "border-blue" : "border-red"}`}
    />
  );
}
