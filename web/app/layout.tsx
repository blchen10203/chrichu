import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { config } from "@/lib/config";
import { Footer } from "@/components/Footer";
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
    <html
      lang="en"
      className={`${archivo.variable} h-full antialiased`}
    >
      <body className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-10 bg-bg px-5 pt-6 pb-6 font-sans text-text">
        <main className="flex flex-1 flex-col gap-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
