import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { FloatingWhatsappButton } from "@/components/floating-whatsapp-button";
import { GoogleAnalytics } from "@/components/google-analytics";
import { Header } from "@/components/header";
import { Providers } from "@/app/providers";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marjouxs | Joias e Alianças",
  description: "Joias, alianças e serviços de joalheria com atendimento personalizado da Marjouxs.",
  metadataBase: new URL("https://marjouxsjoias.com.br"),
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Marjouxs | Joias e Alianças",
    description: "Joias, alianças e serviços de joalheria com atendimento personalizado da Marjouxs.",
    url: "https://marjouxsjoias.com.br",
    siteName: "Marjouxs",
    locale: "pt_BR",
    type: "website"
  }
};

const jewelryStoreSchema = {
  "@context": "https://schema.org",
  "@type": "JewelryStore",
  name: "Marjouxs Joias e Alianças",
  url: "https://marjouxsjoias.com.br",
  email: "marjouxsgold@gmail.com",
  telephone: "+55 11 91581-8241",
  sameAs: ["https://www.instagram.com/marjouxs/"],
  address: {
    "@type": "PostalAddress",
    streetAddress: "Avenida João Manoel, 600 - Prédio JM 600 - Térreo",
    addressLocality: "Arujá",
    addressRegion: "SP",
    addressCountry: "BR"
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Saturday",
      opens: "09:00",
      closes: "13:00"
    }
  ]
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jewelryStoreSchema) }}
        />
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
          <FloatingWhatsappButton />
        </Providers>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
