import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { config } from "@/lib/config";
import { Footer } from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { themeScript } from "@/lib/theme";
import "./globals.css";

// Variable weight and width: body at normal width, display condensed (globals.css).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: config.name,
  description: "Guess UFC fighter measurements and stats.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before React loads, so the server's <html> never matches: that is expected.
    <html
      lang="en"
      className={`${archivo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Plain and inline so it runs before first paint; next/script's beforeInteractive waits for Next's runtime. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-10 bg-bg px-5 pt-6 pb-6 font-sans text-text">
        <ThemeToggle />
        <main className="flex flex-1 flex-col gap-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
