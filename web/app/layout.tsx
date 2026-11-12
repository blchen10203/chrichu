import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { config } from "@/lib/config";
import { Footer } from "@/components/Footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: config.name,
  description: "Guess UFC fighter measurements and stats.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-4 bg-bg px-4 pt-5 pb-6 font-sans text-text">
        <main className="flex flex-1 flex-col gap-4">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
