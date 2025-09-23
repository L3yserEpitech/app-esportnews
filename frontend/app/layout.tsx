import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "../components/providers/AuthProvider";
import { GameProvider } from "./contexts/GameContext";
import ClientLayout from "./components/layout/ClientLayout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EsportNews - Actualités et Matchs en Direct",
  description: "Plateforme e-sport dédiée aux matchs en direct multi-jeux et actualités. Suivez vos tournois favoris sur Valorant, CS2, League of Legends et plus encore.",
  keywords: "esport, gaming, tournois, matchs en direct, actualités, Valorant, CS2, League of Legends",
  authors: [{ name: "EsportNews" }],
  openGraph: {
    title: "EsportNews - Actualités et Matchs en Direct",
    description: "Suivez l'actualité esport et les matchs en direct de vos jeux favoris",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "EsportNews - Actualités et Matchs en Direct",
    description: "Suivez l'actualité esport et les matchs en direct de vos jeux favoris",
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
            </ClientLayout>
          </GameProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
