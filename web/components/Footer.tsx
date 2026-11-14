import Link from "next/link";
import { config } from "@/lib/config";

export function Footer() {
  return (
    <footer className="flex flex-col items-start gap-2 text-[11px] text-muted">
      {config.showUfcLogo && (
        // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation
        <img src="/img/ufc-logo.svg" alt="UFC" className="h-4" />
      )}
      <p>
        UFC and fighter images are property of their owners. Unofficial fan project, not affiliated with UFC.{" "}
        <Link href="/credits" className="underline hover:text-text">
          Photo credits
        </Link>
      </p>
    </footer>
  );
}
