import Link from "next/link";
import { HomeModes } from "@/components/HomeModes";
import { config } from "@/lib/config";

export default function Home() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[15px] font-semibold">{config.name}</h1>
        <p className="text-[15px] text-muted">Guess the numbers behind UFC fighters.</p>
      </div>
      <HomeModes />
      <nav className="flex gap-6 text-sm text-muted">
        <Link href="/how-to-play" className="flex min-h-11 items-center hover:text-text">
          How to play
        </Link>
        <Link href="/faq" className="flex min-h-11 items-center hover:text-text">
          FAQ
        </Link>
      </nav>
    </>
  );
}
