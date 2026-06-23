import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

/** Root metadata fallback; `[locale]/layout` overrides per language. */
export const metadata: Metadata = {
  title: "Faleague The Football Hub",
  description: "World Cup live, FPL tools, global football news, and AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className={inter.variable} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
