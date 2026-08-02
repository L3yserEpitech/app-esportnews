import { notFound, permanentRedirect } from 'next/navigation';
import { wikiToSlug } from '../../../lib/gameRegistry';

// Legacy resolver for old /equipe/<id>/resultats?wiki=<wiki> URLs → 308-redirect
// to the canonical game-first /[game]/equipe/<id>/resultats.
export default async function LegacyResultatsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const slug = sp.wiki ? wikiToSlug(sp.wiki) : undefined;
  if (!slug) {
    notFound();
  }

  const q = new URLSearchParams();
  if (sp.name) q.set('name', sp.name);
  if (sp.acronym) q.set('acronym', sp.acronym);
  if (sp.logo) q.set('logo', sp.logo);
  const qs = q.toString();

  permanentRedirect(`/${slug}/equipe/${encodeURIComponent(id)}/resultats${qs ? `?${qs}` : ''}`);
}
