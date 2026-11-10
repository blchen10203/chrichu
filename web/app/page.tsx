import Link from "next/link";
import { config } from "@/lib/config";

// TODO: mode cards and current streak (spec section 8).
const links = [
  ["/daily", "Daily"],
  ["/infinite", "Infinite"],
  ["/survival", "Survival"],
  ["/how-to-play", "How to Play"],
  ["/faq", "FAQ"],
];

export default function Home() {
  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold">{config.name}</h1>
      <nav className="mt-4 flex flex-col gap-2">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="underline">
            {label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
