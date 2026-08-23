import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import { GameProvider } from "./contexts/GameContext";
import ClientLayout from "./components/layout/ClientLayout";
import { Analytics } from "@vercel/analytics/next"
import { getLanguagePreference } from "@/lib/preferences";
import { PageViewTracker } from "./components/PageViewTracker";
import CookieBanner from "./components/common/CookieBanner";
import ProxyImageRetry from "./components/common/ProxyImageRetry";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.esportnews.fr";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
        {/* Applies the stored theme before first paint. ThemeProvider only
            reaches it from an effect, i.e. after hydration, so without this the
            server-rendered markup would flash the dark default at anyone using
            the light theme. Kept inline and synchronous on purpose, and cookie
            based rather than server read so pages stay statically renderable. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )esport_theme=([^;]*)/);var t=m?decodeURIComponent(m[1]):'dark';if(t==='auto'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t!=='dark'&&t!=='light'){t='dark'}document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className="font-sans antialiased min-h-screen"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          color: 'var(--color-text-primary)',
        }}
      >
        <AuthProvider>
          <GameProvider>
            <Suspense fallback={null}>
              <PageViewTracker />
            </Suspense>
            <ClientLayout>
              {children}
              <Analytics />
            </ClientLayout>
            <CookieBanner />
            <ProxyImageRetry />
          </GameProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
