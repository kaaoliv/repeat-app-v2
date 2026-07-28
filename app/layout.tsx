import type { Metadata } from "next";
import Header from "./components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repeat",
  description: "Quanto tempo da sua vida você já gastou ouvindo música?",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-background text-accent min-h-screen antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
