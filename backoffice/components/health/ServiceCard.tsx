'use client';

import { useId } from 'react';
import { Chip, Skeleton, type Tone } from '@/components/ui';
import { since } from './time';
import type { HealthService, HealthStatus } from './types';

const STATUS: Record<HealthStatus, { label: string; tone: Tone }> = {
  ok: { label: 'Opérationnel', tone: 'vert' },
  warn: { label: 'À surveiller', tone: 'ambre' },
  down: { label: 'En panne', tone: 'rouge' },
  unconfigured: { label: 'Non connecté', tone: 'gris' },
};

export function ServiceCard({ service, now }: { service: HealthService; now: number }) {
  const titleId = useId();
  const status = STATUS[service.status] ?? STATUS.unconfigured;
  const missing = service.missing ?? [];
  const external = service.link ? /^https?:\/\//.test(service.link.url) : false;

  return (
    <section className={`carte svc ${service.status}`} aria-labelledby={titleId}>
      <div className="carte-t">
        <h2 id={titleId}>{service.name}</h2>
        <div className="droite">
          <Chip tone={status.tone}>{status.label}</Chip>
        </div>
      </div>

      {service.metrics.length > 0 && (
        <dl>
          {service.metrics.map((metric) => (
            <div key={metric.label} style={{ display: 'contents' }}>
              <dt>{metric.label}</dt>
              <dd className={metric.mono ? 'mono' : undefined}>{metric.at ? since(metric.at, now) : metric.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {service.status === 'unconfigured' && missing.length > 0 && (
        <div className="svc-vars">
          <span>{missing.length > 1 ? 'Variables à définir sur le backend' : 'Variable à définir sur le backend'}</span>
          <ul>
            {missing.map((name) => (
              <li key={name} className="mono">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {service.metrics.length === 0 && service.status !== 'unconfigured' && <div style={{ flex: 1 }} />}

      {(service.note || service.link) && (
        <div className="svc-b">
          {service.note && <span className="svc-note">{service.note}</span>}
          {service.link && (
            <a className="ext" href={service.link.url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {service.link.label}
            </a>
          )}
        </div>
      )}
    </section>
  );
}

export function ServiceCardSkeleton() {
  return (
    <div className="carte svc" aria-hidden="true">
      <div className="carte-t">
        <Skeleton width={90} height={16} />
        <div className="droite">
          <Skeleton width={96} height={20} />
        </div>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton />
        <Skeleton />
        <Skeleton width="70%" />
      </div>
    </div>
  );
}
