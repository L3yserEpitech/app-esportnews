import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import { GameProvider } from "./contexts/GameContext";
import ClientLayout from "./components/layout/ClientLayout";
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Esport News — Actus e-sport & scores en direct",
  description: "Actus e-sport et scores en direct. Résultats, classements, analyses, interviews et agenda des tournois : CS2, Rocket League, LoL, Valorant, Fortnite…",
  keywords: "esport, gaming, tournois, matchs en direct, actualités, scores, CS2, Rocket League, LoL, Valorant, Fortnite, classements, analyses,",
  authors: [{ name: "Esport News" }],
  openGraph: {
    title: "Esport News — Actus e-sport & scores en direct",
    description: "Actus e-sport et scores en direct. Résultats, classements, analyses, interviews et agenda des tournois : CS2, Rocket League, LoL, Valorant, Fortnite…",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Esport News — Actus e-sport & scores en direct",
    description: "Actus e-sport et scores en direct. Résultats, classements, analyses, interviews et agenda des tournois : CS2, Rocket League, LoL, Valorant, Fortnite…",
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
  return (
    <html lang="fr" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#060B13" />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased bg-gray-950 text-white min-h-screen`}
      >
        <AuthProvider>
          <GameProvider>
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
