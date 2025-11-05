/**
 * Helper pour générer les breadcrumbs et le JSON-LD
 */

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generateBreadcrumbs(pathSegments: BreadcrumbItem[]): BreadcrumbItem[] {
  // Toujours commencer par Home
  return [
    { name: 'Accueil', url: '/' },
    ...pathSegments,
  ];
}

export function generateBreadcrumbSchema(breadcrumbs: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Exemples d'utilisation:
 *
 * // Pour /article/mon-article
 * const breadcrumbs = generateBreadcrumbs([
 *   { name: 'Articles', url: '/articles' },
 *   { name: articleTitle, url: `/article/${articleSlug}` }
 * ]);
 *
 * // Pour /tournois/123
 * const breadcrumbs = generateBreadcrumbs([
 *   { name: 'Tournois', url: '/tournois' },
 *   { name: tournamentName, url: `/tournois/${id}` }
 * ]);
 */
