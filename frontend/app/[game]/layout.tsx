import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isValidSlug } from '../lib/gameRegistry';

// Root game namespace. Validates the [game] segment against the registry so a
// bogus first path segment (e.g. /randomstring/...) 404s instead of rendering.
// Static top-level routes (/match, /tournois, /news, /jeux, /article…) take
// precedence over this dynamic segment, so they are unaffected.
export default async function GameLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  if (!isValidSlug(game)) {
    notFound();
  }
  return <>{children}</>;
}
