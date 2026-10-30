import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import { GameProvider } from "./contexts/GameContext";
import ClientLayout from "./components/layout/ClientLayout";
import { CHUNK_RETRY_SCRIPT } from "./lib/chunkRetry";
import { Analytics } from "@vercel/analytics/next"
import { getLanguagePreference } from "@/lib/preferences";
import { PageViewTracker } from "./components/PageViewTracker";
import CookieBanner from "./components/common/CookieBanner";
import ProxyImageRetry from "./components/common/ProxyImageRetry";
import { DEFAULT_OG_IMAGE } from "./lib/seoHelpers";
import { APP_BANNER_CLOSED_KEY } from "./lib/appPromo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.esportnews.fr";

const SITE_NAME = "Esport News";
const SITE_TITLE = `${SITE_NAME} — Actus esport & scores en direct`;
const SITE_DESCRIPTION = "Actus esport et scores en direct. Résultats, classements, analyses, interviews et agenda des tournois : CS2, Rocket League, LoL, Valorant, Fortnite…";

// Next.js emits the viewport meta from this export; a hand-written
// <meta name="viewport"> in <head> would be a duplicate.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060B13",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: "esport, gaming, tournois, matchs en direct, actualités, scores, CS2, Rocket League, LoL, Valorant, Fortnite, classements, analyses,",
  authors: [{ name: SITE_NAME }],
  openGraph: {
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    locale: "fr_FR",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
  // Google only shows large image thumbnails (Discover, Top Stories) and
  // full-length snippets when the page opts in explicitly.
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
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
    // suppressHydrationWarning: the inline script below sets data-theme and
    // the dark class before React hydrates, so <html> legitimately differs.
    <html lang={langMap[locale] || 'fr'} suppressHydrationWarning>
      <head>
        {/* Emitted here rather than through metadata.alternates: pages that set
            their own canonical replace the whole `alternates` object, which
            would silently drop the feed link on every article. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${SITE_NAME} — Flux RSS`}
          href={`${SITE_URL}/feed.xml`}
        />
        {/* Keeps the server-rendered page on screen when a chunk fails to
            load: see lib/chunkRetry.ts. Inline so it is installed before any
            chunk can error. */}
        <script dangerouslySetInnerHTML={{ __html: CHUNK_RETRY_SCRIPT }} />
        {/* Applies the stored theme before first paint. ThemeProvider only
            reaches it from an effect, i.e. after hydration, so without this the
            server-rendered markup would flash the dark default at anyone using
            the light theme. Kept inline and synchronous on purpose, and cookie
            based rather than server read so pages stay statically renderable.
            Same reason for hiding the app banner a visitor already closed. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )esport_theme=([^;]*)/);var t=m?decodeURIComponent(m[1]):'dark';if(t==='auto'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t!=='dark'&&t!=='light'){t='dark'}document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}try{if(sessionStorage.getItem('${APP_BANNER_CLOSED_KEY}'))document.documentElement.setAttribute('data-app-banner','off')}catch(e){}})()`,
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
