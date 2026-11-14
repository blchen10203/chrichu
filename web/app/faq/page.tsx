import Link from "next/link";

const faq = [
  ["Where do the numbers come from?", "From official UFC fight statistics, through a public dataset that is refreshed after events. They cover UFC fights only."],
  ["How often is it updated?", "About once a week."],
  ["Why can I only play Daily once?", "So everyone gets one fair try at the same puzzle. Infinite is there for more."],
  ["Where is my progress saved?", "In this browser only. There are no accounts, so clearing your browser data clears your streak."],
  ["Is this an official UFC product?", "No. It is an unofficial fan project."],
];

export default function FaqPage() {
  return (
    <>
      <h1 className="text-[26px] font-normal tracking-tight">FAQ</h1>
      {faq.map(([q, a]) => (
        <section key={q} className="flex flex-col gap-1">
          <h2 className="font-medium">{q}</h2>
          <p className="text-muted">{a}</p>
        </section>
      ))}
      <Link href="/" className="flex min-h-11 items-center text-sm text-muted hover:text-text">
        Home
      </Link>
    </>
  );
}
