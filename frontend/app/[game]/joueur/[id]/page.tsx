interface PlayerPageProps {
  params: Promise<{ game: string; id: string }>;
}

// Routing scaffold only — the player page body is intentionally empty for now.
// Design + data wiring (Liquipedia /player) come later. The [game] segment is
// validated by app/[game]/layout.tsx.
export default async function PlayerPage({ params }: PlayerPageProps) {
  await params;
  return <main className="min-h-screen" />;
}
