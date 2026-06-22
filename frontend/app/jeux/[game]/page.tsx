import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { generateListingMetadata } from '@/app/lib/seoHelpers';
import { articleHref } from '@/app/lib/articleUrl';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

async function getGame(acronym: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/games/acronym/${acronym}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getGames() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/games`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getTournaments(game: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/tournaments?game=${game}&limit=6`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function getUpcomingMatches(game: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/matches/upcoming?game=${game}`, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 8) : [];
  } catch {
    return [];
  }
}

async function getArticles(game: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/articles?category=${game}&limit=6`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  const games = await getGames();
  return games
    .filter((g: any) => g.acronym)
    .map((g: any) => ({ game: g.acronym }));
}

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  const gameData = await getGame(game);
  if (!gameData) return { title: 'Jeu non trouvé | EsportNews' };

  const name = gameData.full_name || gameData.name;
  return generateListingMetadata(
    `Esport ${name} - Matchs en direct, Tournois et Actualités`,
    `Suivez l'esport ${name} sur EsportNews : matchs en direct, résultats de tournois, classements et toutes les actualités.`,
    `/jeux/${game}`,
    `${name} esport, matchs ${name}, tournois ${name}, actualités ${name}, results ${name}`
  );
}

export default async function JeuPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;

  const [gameData, tournaments, matches, articles] = await Promise.all([
    getGame(game),
    getTournaments(game),
    getUpcomingMatches(game),
    getArticles(game),
  ]);

  if (!gameData) notFound();

  const name = gameData.full_name || gameData.name;

  return (
    <main className="min-h-screen bg-[#060B13] text-white pt-20">
      {/* Hero */}
      <section className="relative border-b border-white/5 pb-10 pt-10">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-6">
            {gameData.selected_image && (
              <Image
                src={gameData.selected_image}
                alt={name}
                width={80}
                height={80}
                className="rounded-xl object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold md:text-4xl">
                Esport <span className="text-[#F22E62]">{name}</span>
              </h1>
              <p className="mt-2 text-gray-400">
                Matchs en direct, tournois, actualités et résultats {name}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 space-y-14">
        {/* Tournois */}
        {tournaments.length > 0 && (
          <section>
            <h2 className="mb-6 text-xl font-bold">
              Tournois <span className="text-[#F22E62]">{name}</span> en cours
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((t: any) => (
                <Link
                  key={t.id}
                  href={`/tournois/${t.id}`}
                  className="rounded-xl border border-white/10 bg-[#091626] p-4 hover:border-[#F22E62]/40 transition-colors"
                >
                  <p className="text-xs uppercase tracking-widest text-[#F22E62]">
                    {t.tier ? `Tier ${t.tier.toUpperCase()}` : 'Tournoi'}
                  </p>
                  <p className="mt-1 font-semibold">{t.name}</p>
                  {t.begin_at && (
                    <p className="mt-1 text-sm text-gray-400">
                      {new Date(t.begin_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </Link>
              ))}
            </div>
            <Link href={`/tournois?game=${game}`} className="mt-4 inline-block text-sm text-[#F22E62] hover:underline">
              Voir tous les tournois {name} →
            </Link>
          </section>
        )}

        {/* Prochains matchs */}
        {matches.length > 0 && (
          <section>
            <h2 className="mb-6 text-xl font-bold">
              Prochains matchs <span className="text-[#F22E62]">{name}</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {matches.map((m: any) => {
                const home = m.opponents?.[0]?.opponent;
                const away = m.opponents?.[1]?.opponent;
                return (
                  <Link
                    key={m.match2id || m.id}
                    href={`/match/${m.id}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-[#091626] px-4 py-3 hover:border-[#F22E62]/40 transition-colors"
                  >
                    <span className="font-medium truncate">{home?.name || '?'}</span>
                    <span className="mx-3 shrink-0 rounded bg-[#182859] px-2 py-0.5 text-xs font-bold">VS</span>
                    <span className="font-medium truncate text-right">{away?.name || '?'}</span>
                  </Link>
                );
              })}
            </div>
            <Link href={`/match?game=${game}`} className="mt-4 inline-block text-sm text-[#F22E62] hover:underline">
              Voir tous les matchs {name} →
            </Link>
          </section>
        )}

        {/* Articles */}
        {articles.length > 0 && (
          <section>
            <h2 className="mb-6 text-xl font-bold">
              Actualités <span className="text-[#F22E62]">{name}</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a: any) => (
                <Link
                  key={a.id}
                  href={articleHref(a)}
                  className="group rounded-xl border border-white/10 bg-[#091626] overflow-hidden hover:border-[#F22E62]/40 transition-colors"
                >
                  {a.featuredImage && (
                    <div className="relative h-40 w-full">
                      <Image src={a.featuredImage} alt={a.title} fill className="object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    <p className="font-semibold line-clamp-2 group-hover:text-[#F22E62] transition-colors">{a.title}</p>
                    {a.description && (
                      <p className="mt-1 text-sm text-gray-400 line-clamp-2">{a.description}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <Link href={`/articles?category=${game}`} className="mt-4 inline-block text-sm text-[#F22E62] hover:underline">
              Voir tous les articles {name} →
            </Link>
          </section>
        )}

        {tournaments.length === 0 && matches.length === 0 && articles.length === 0 && (
          <p className="text-center text-gray-400 py-20">
            Aucun contenu disponible pour {name} pour le moment.
          </p>
        )}
      </div>
    </main>
  );
}
