import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LiquipediaBadgeProps {
  variant?: 'badge' | 'text';
  className?: string;
}

export default function LiquipediaBadge({ variant = 'badge', className = '' }: LiquipediaBadgeProps) {
  const t = useTranslations('common');

  if (variant === 'text') {
    return (
      <a
        href="https://liquipedia.net"
        target="_blank"
        rel="noopener noreferrer"
        className={`text-xs text-[var(--color-text-muted)] hover:text-[#F22E62] transition-colors duration-200 ${className}`}
      >
        {t('powered_by_liquipedia')}
      </a>
    );
  }

  return (
    <a
      href="https://liquipedia.net"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-text-muted)] hover:text-[#F22E62] transition-colors duration-200 ${className}`}
    >
      <ExternalLink className="w-2.5 h-2.5" />
      {t('data_from_liquipedia')}
    </a>
  );
}
