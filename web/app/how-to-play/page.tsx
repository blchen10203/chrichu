import Link from "next/link";

const steps = [
  "You see one fighter's real number. That is the blue corner.",
  "Drag the red figure or bar to your estimate for the other fighter. Tap − and + to fine-tune.",
  "Press Lock In. The closer you are, the more of the 100 points you get. A near miss still scores full marks.",
  "Daily is the same 5 rounds for everyone, once a day. Infinite never ends and does not count.",
  "Share your Daily score and keep your streak going.",
];

export default function HowToPlayPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-wider">How to Play</h1>
      <ol className="flex list-decimal flex-col gap-3 pl-5">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <Link href="/" className="flex min-h-11 items-center underline">
        Home
      </Link>
    </>
  );
}
