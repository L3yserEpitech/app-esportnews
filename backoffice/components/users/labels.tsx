import { CreditCard, Smartphone } from 'lucide-react';
import { until } from '@/lib/format';
import { Chip } from '@/components/ui';
import type { Device, FollowLimit, PremiumSource, PremiumState } from './types';

export const SOURCE_LABEL: Record<PremiumSource, string> = {
  app_store: 'App Store',
  google_play: 'Google Play',
  stripe: 'Stripe',
  gift: 'Offert',
};

export const SOURCE_LONG: Record<PremiumSource, string> = {
  app_store: 'App Store (achat intégré iOS)',
  google_play: 'Google Play (achat intégré Android)',
  stripe: 'Stripe (abonnement sur le site)',
  gift: "Offert par l'équipe",
};

const SIGNUP_SOURCE: Record<string, string> = {
  ios: "depuis l'app iOS",
  android: "depuis l'app Android",
  web: 'depuis le site',
  invitation: "sur invitation de l'équipe",
};

export const signupSource = (source: string | null) => (source ? SIGNUP_SOURCE[source] || '' : '');

const MATCH_STATUS: Record<string, string> = {
  upcoming: 'à venir',
  not_started: 'à venir',
  running: 'en direct',
  finished: 'terminé',
  canceled: 'annulé',
};

export const followStatus = (status: string) => MATCH_STATUS[status] || status || '—';

export const isOver = (status: string) => status === 'finished' || status === 'canceled';

export function platformLabel(platform: string): string {
  if (platform === 'ios') return 'iOS';
  if (platform === 'android') return 'Android';
  return 'Plateforme inconnue';
}

export function deviceNote(d: Device, format: (v: string | null) => string): string {
  if (d.active) return d.created_at ? `enregistré le ${format(d.created_at)}` : 'enregistré';
  return d.updated_at ? `désactivé le ${format(d.updated_at)}` : 'désactivé';
}

// « 2 sur 5 gratuits », or what Premium changes to it.
export function limitText(limit: FollowLimit, unlimited: boolean): string {
  if (unlimited) return `${limit.used} en cours, sans limite avec Premium`;
  return `${limit.used} sur ${limit.limit} ${limit.limit > 1 ? 'gratuits' : 'gratuit'}`;
}

// The Premium column of the list: where it comes from, then what to watch.
export function PremiumCell({ premium }: { premium: PremiumState }) {
  if (!premium.active) return <span className="faible">—</span>;
  const paid = premium.source && premium.source !== 'gift';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {paid && premium.source && (
        <span className="src">
          {premium.source === 'stripe' ? <CreditCard aria-hidden="true" /> : <Smartphone aria-hidden="true" />}
          {SOURCE_LABEL[premium.source]}
        </span>
      )}
      {premium.gifted && <Chip tone="gris">Offert</Chip>}
      {!premium.source && !premium.gifted && <span>Actif</span>}
      {premium.expiring && premium.expires_at && <Chip tone="ambre">Expire {until(premium.expires_at)}</Chip>}
    </span>
  );
}
