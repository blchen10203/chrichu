import Link from "next/link";

const steps = [
  "You see one fighter's real number, shown in blue.",
  "Drag your marker to your estimate for the other fighter. Tap − and + to fine-tune.",
  "Press Lock In. The closer you are, the more of the 100 points you get. A near miss still scores full marks.",
  "Daily is the same 5 rounds for everyone, once a day. Infinite never ends and does not count. Survival gives you 10 HP and 15 seconds a round; misses cost HP, and the run ends at zero.",
  "Share your Daily score and keep your streak going.",
];

export default function HowToPlayPage() {
  return (
    <>
      <h1 className="text-[26px] font-normal tracking-tight">How to play</h1>
      <ol className="flex list-decimal flex-col gap-4 pl-5 marker:text-muted">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <Link href="/" className="flex min-h-11 items-center text-sm text-muted hover:text-text">
        Home
      </Link>
    </>
  );
}
