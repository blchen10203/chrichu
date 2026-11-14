import { config } from "@/lib/config";

// The only code that knows where fighter images come from (spec section 4).
export function fighterImage(id: string, hasImage: boolean): string {
  return config.showFighterImages && hasImage
    ? `/img/fighters/${id}.webp`
    : "/img/fallback.svg";
}
