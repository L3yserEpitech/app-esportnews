import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import { GameProvider } from "./contexts/GameContext";
import ClientLayout from "./components/layout/ClientLayout";
import { Analytics } from "@vercel/analytics/next"
import { getLanguagePreference } from "@/lib/preferences";
import { PageViewTracker } from "./components/PageViewTracker";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Esport News — Actus esport & scores en direct",
  description: "Actus esport et scores en direct. Résultats, classements, analyses, interviews et agenda des tournois : CS2, Rocket League, LoL, Valorant, Fortnite…",
  keywords: "esport, gaming, tournois, matchs en direct, actualités, scores, CS2, Rocket League, LoL, Valorant, Fortnite, classements, analyses,",
  authors: [{ name: "Esport News" }],
  openGraph: {
    title: "Esport News — Actus esport & scores en direct",
    description: "Actus esport et scores en direct. Résultats, classements, analyses, interviews et agenda des tournois : CS2, Rocket League, LoL, Valorant, Fortnite…",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Esport News — Actus esport & scores en direct",
    description: "Actus esport et scores en direct. Résultats, classements, analyses, interviews et agenda des tournois : CS2, Rocket League, LoL, Valorant, Fortnite…",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = getLanguagePreference();
  const langMap: Record<string, string> = {
    fr: 'fr',
    en: 'en',
    es: 'es',
    de: 'de',
    it: 'it',
  };

  return (
    <html lang={langMap[locale] || 'fr'}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#060B13" />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen`}
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          color: 'var(--color-text-primary)',
        }}
      >
        <AuthProvider>
          <GameProvider>
            <PageViewTracker />
            <ClientLayout>
              {children}
              <Analytics />
            </ClientLayout>
          </GameProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
