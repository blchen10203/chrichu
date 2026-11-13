import Link from "next/link";
import { HomeModes } from "@/components/HomeModes";
import { config } from "@/lib/config";

export default function Home() {
  return (
    <>
      <div>
        <h1 className="font-display text-5xl font-bold tracking-wider">{config.name}</h1>
        <p className="text-muted">Guess the numbers behind UFC fighters.</p>
      </div>
      <HomeModes />
      <nav className="flex gap-6 text-sm">
        <Link href="/how-to-play" className="flex min-h-11 items-center underline">
          How to Play
        </Link>
        <Link href="/faq" className="flex min-h-11 items-center underline">
          FAQ
        </Link>
      </nav>
    </>
  );
}
