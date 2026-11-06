import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: { default: "PC Hunter — Buscador inteligente de PCs e monitores", template: "%s · PC Hunter" },
  description: "Encontra PCs gamer e monitores com melhor custo-benefício e entrega para o Brasil, com nota de 0 a 100, custo final e histórico de preços.",
};

export const viewport: Viewport = { themeColor: "#07090d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>
          <Suspense fallback={<div className="h-14 border-b border-line" />}>
            <Header />
          </Suspense>
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16">{children}</main>
          <footer className="border-t border-line py-6 text-center text-xs text-faint px-4">
            PC Hunter não vende produtos. Preços e estoques vêm das fontes listadas em <a className="underline hover:text-fg" href="/fontes">Fontes</a> e podem mudar a qualquer momento — confira na loja antes de comprar.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
