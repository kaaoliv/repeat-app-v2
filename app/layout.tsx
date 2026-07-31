import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import BottomNav from "./components/BottomNav";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Repeat — seu diário de escuta",
  description:
    "Quanto tempo da sua vida você já gastou ouvindo música? Faixa por faixa, com repetições contando de verdade.",
};

export const viewport: Viewport = {
  themeColor: "#0c0c11",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${inter.variable} bg-bg`}
    >
      <body className="bg-bg text-ink min-h-screen antialiased font-sans">
        <div className="mx-auto w-full max-w-xl min-h-screen pb-28">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
