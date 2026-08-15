'use client';
import Link from 'next/link';
import 'flag-icons/css/flag-icons.min.css';
import { countryCode } from '../../lib/countryCodes';
import { playerHref } from '../../lib/gameLinks';
import { getRoleBadgeStyle } from '../../match/_components/sections/shared';

export interface PlayerCardData {
  name: string;
  slug?: string | null;
  role?: string | null;
  nationality?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

// Global player row used everywhere a roster is displayed (match page, team
// page…). Square rounded flag as the avatar, real name as subtitle, role
// badge, and a link to the player page when a slug is available.
export default function PlayerCard({ player, wiki }: { player: PlayerCardData; wiki?: string | null }) {
  const code = countryCode(player.nationality);
  const realName = [player.first_name, player.last_name].filter(Boolean).join(' ');
  const url = player.slug ? playerHref({ wiki, pagename: player.slug }) : null;

  const inner = (
    <>
      <div
        className="w-10 h-10 rounded-lg overflow-hidden ring-1 ring-[var(--color-border-primary)]/30 flex items-center justify-center flex-shrink-0 bg-[var(--color-bg-primary)]/80 transition-all group-hover/player:ring-accent/40"
        title={player.nationality || undefined}
      >
        {code ? (
          <span className={`fi fi-${code} fis`} style={{ width: '100%', height: '100%', fontSize: 'unset', lineHeight: 'unset', backgroundSize: 'cover' }} />
        ) : (
          <span className="text-[11px] font-bold text-text-muted/60">{player.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-primary truncate transition-colors group-hover/player:text-accent">{player.name}</p>
        {(realName || player.nationality) && (
          <p className="text-[10px] text-text-muted/70 truncate">{realName || player.nationality}</p>
        )}
      </div>
      {player.role && (
        <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${getRoleBadgeStyle(player.role)}`}>
          {player.role}
        </span>
      )}
    </>
  );

  const cls = 'group/player flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors';
  return url ? <Link href={url} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
