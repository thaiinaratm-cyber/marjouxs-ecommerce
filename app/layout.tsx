import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { FloatingWhatsappButton } from "@/components/floating-whatsapp-button";
import { GoogleAnalytics } from "@/components/google-analytics";
import { Header } from "@/components/header";
import { Providers } from "@/app/providers";
import {
  absoluteUrl,
  DEFAULT_SOCIAL_IMAGE,
  organizationWebsiteSchema,
  serializeJsonLd,
  SITE_URL
} from "@/lib/seo";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marjouxs | Joias e Alianças",
  description: "Joias, alianças e serviços de joalheria com atendimento personalizado da Marjouxs.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Marjouxs | Joias e Alianças",
    description: "Joias, alianças e serviços de joalheria com atendimento personalizado da Marjouxs.",
    siteName: "Marjouxs",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: absoluteUrl(DEFAULT_SOCIAL_IMAGE),
        width: 1200,
        height: 630,
        alt: "Joias e alianças Marjouxs"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Marjouxs | Joias e Alianças",
    description: "Joias, alianças e serviços de joalheria com atendimento personalizado da Marjouxs.",
    images: [absoluteUrl(DEFAULT_SOCIAL_IMAGE)]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationWebsiteSchema) }}
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
