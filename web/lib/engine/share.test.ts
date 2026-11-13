import { expect, it } from "vitest";
import { shareText, survivalShareText } from "@/lib/engine/share";

it("matches the spec's share format", () => {
  expect(shareText("Reachdle", 42, [86, 50, 92, 64, 95], "https://reachdle.vercel.app")).toBe(
    "Reachdle #42 — 387/500\n🟩🟨🟩🟨🟩\nhttps://reachdle.vercel.app");
});

it("colours by score band", () => {
  expect(shareText("R", 1, [80, 79, 40, 39, 0], "u").split("\n")[1]).toBe("🟩🟨🟨🟥🟥");
});

it("writes the Survival share text", () => {
  expect(survivalShareText("Reachdle", 14, "https://reachdle.vercel.app"))
    .toBe("Reachdle Survival — 14 rounds\nhttps://reachdle.vercel.app");
  expect(survivalShareText("Reachdle", 1, "https://x")).toBe("Reachdle Survival — 1 round\nhttps://x");
});
