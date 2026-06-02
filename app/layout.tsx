import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { FloatingWhatsappButton } from "@/components/floating-whatsapp-button";
import { Header } from "@/components/header";
import { Providers } from "@/app/providers";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Antoér Joalheria e Relojoaria",
  description: "E-commerce premium de joias, alianças, relógios e serviços de joalheria e relojoaria.",
  metadataBase: new URL("https://antoer.com.br")
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
          <FloatingWhatsappButton />
        </Providers>
      </body>
    </html>
  );
}
