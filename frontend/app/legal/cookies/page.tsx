import type { Metadata } from 'next';
import CookiesContent from './CookiesContent';

export const metadata: Metadata = {
  title: 'Politique de gestion des cookies | Esport News',
  description: 'Comment Esport News utilise les cookies et comment gérer vos préférences',
};

export default function CookiesPage() {
  return <CookiesContent />;
}
