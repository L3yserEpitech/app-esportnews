import type { Metadata } from 'next';
import NotFoundContent from './components/common/NotFoundContent';

// Without this, a 404 carried Next's own `noindex` next to the layout's
// `index, follow`: two robots tags that contradict each other.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundContent />;
}
