'use client';

import type { LucideIcon } from 'lucide-react';

interface ContentLoaderProps {
  label: string;
  icon?: LucideIcon;
  compact?: boolean;
  className?: string;
}

// Loader unique du site : carré tournant + icône contextuelle + label.
// `compact` pour les chargements de section (dans une page déjà rendue).
export default function ContentLoader({ label, icon: Icon, compact = false, className = '' }: ContentLoaderProps) {
  return (
    <div className={`flex items-center justify-center ${compact ? 'py-10' : 'py-28'} ${className}`}>
      <div className="text-center">
        <div className={`relative ${compact ? 'w-10 h-10 mb-3' : 'w-14 h-14 mb-5'} mx-auto`}>
          <div className="absolute inset-0 border border-border-primary rounded-xl" />
          <div className="absolute inset-0 border border-transparent border-t-accent rounded-xl animate-spin" />
          {Icon && <Icon className={`absolute inset-0 m-auto ${compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-accent/50`} />}
        </div>
        <p className="text-text-muted text-xs uppercase tracking-[0.2em] font-semibold">{label}</p>
      </div>
    </div>
  );
}
