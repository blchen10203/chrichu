import Link from "next/link";

export default function SurvivalPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-wider">Survival</h1>
      <p>Survival is coming soon.</p>
      <Link href="/" className="flex min-h-11 items-center underline">
        Home
      </Link>
    </>
  );
}
