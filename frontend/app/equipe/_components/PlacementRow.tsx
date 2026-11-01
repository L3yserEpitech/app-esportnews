import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

interface PlacementRowProps {
  href: string | null;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

// A placement whose page has no tournament stays listed, just not clickable.
export default function PlacementRow({ href, children, ...rest }: PlacementRowProps) {
  return href ? <Link href={href} {...rest}>{children}</Link> : <div {...rest}>{children}</div>;
}
