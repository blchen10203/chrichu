import Link from "next/link";
import credits from "@/data/photo-credits.json";

// Required by the photos' CC BY and CC BY-SA licences; outlines traced from them share the same licence.
const photos = Object.values(credits).sort((a, b) => a.name.localeCompare(b.name));

export default function CreditsPage() {
  return (
    <>
      <h1 className="text-[26px] font-normal tracking-tight">Photo credits</h1>
      <p className="text-muted">
        Most fighter outlines and headshots come from ufc.com athlete photos. The {photos.length} below come from Wikimedia
        Commons photos and are shared under the same licence.
      </p>
      <ul className="flex flex-col gap-1 text-sm text-muted">
        {photos.map((p) => (
          <li key={p.url}>
            <span className="text-text">{p.name}</span>,{" "}
            <a href={p.url} className="underline hover:text-text">
              {p.author}
            </a>
            , {p.license}
          </li>
        ))}
      </ul>
      <Link href="/" className="flex min-h-11 items-center text-sm text-muted hover:text-text">
        Home
      </Link>
    </>
  );
}
