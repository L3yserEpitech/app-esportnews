'use client';

import { Chip } from '@/components/ui';
import { num } from '@/lib/format';
import { age, since } from './time';
import type { HealthWiki } from './types';

// The bar turns amber where the backend starts warning: 80 % of the hourly budget.
const BUDGET_WARN = 0.8;

function ListCell({ refreshedAt, expired, now }: { refreshedAt: string | null; expired: boolean; now: number }) {
  if (expired) {
    return (
      <span title={refreshedAt ? `Dernier rafraîchissement ${since(refreshedAt, now)}` : 'Aucun rafraîchissement depuis le redémarrage du backend'}>
        <Chip tone="ambre">{refreshedAt ? `Expirée · ${age(refreshedAt, now)}` : 'Expirée'}</Chip>
      </span>
    );
  }
  return <>{since(refreshedAt, now)}</>;
}

export function WikiTable({ wikis, now }: { wikis: HealthWiki[]; now: number }) {
  return (
    <div className="box-scroll">
      <table className="tbl serre">
        <thead>
          <tr>
            <th scope="col">Jeu</th>
            <th scope="col">Wiki</th>
            <th scope="col">Budget de l&apos;heure</th>
            <th scope="col">Matchs en direct</th>
            <th scope="col">Matchs à venir</th>
            <th scope="col">Dernier webhook</th>
          </tr>
        </thead>
        <tbody>
          {wikis.map((w) => {
            const ratio = w.budget_limit > 0 ? Math.min(1, w.budget_used / w.budget_limit) : 0;
            const loaded = w.budget_limit > 0 && w.budget_used / w.budget_limit >= BUDGET_WARN;
            return (
              <tr key={w.wiki} className={loaded ? 'sante-alerte' : undefined}>
                <th scope="row" className="sante-jeu">
                  {w.game}
                </th>
                <td className="mono">{w.wiki}</td>
                <td>
                  <span
                    className="bar"
                    role="meter"
                    aria-label={`Budget utilisé par ${w.game}`}
                    aria-valuemin={0}
                    aria-valuemax={w.budget_limit}
                    aria-valuenow={w.budget_used}
                    aria-valuetext={`${num(w.budget_used)} appels sur ${num(w.budget_limit)}`}
                  >
                    <i style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </span>{' '}
                  <span className="sante-budget">{num(w.budget_used)}</span>
                </td>
                <td>
                  <ListCell refreshedAt={w.running_refreshed_at} expired={w.running_expired} now={now} />
                </td>
                <td>
                  <ListCell refreshedAt={w.upcoming_refreshed_at} expired={w.upcoming_expired} now={now} />
                </td>
                <td>{since(w.last_webhook_at, now)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
