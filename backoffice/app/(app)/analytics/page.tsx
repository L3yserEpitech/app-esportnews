'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Download, Info, LineChart as LineChartIcon } from 'lucide-react';
import { download, errorMessage, fetcher, SITE_URL } from '@/lib/api';
import { day, dec1, num } from '@/lib/format';
import { PageHeader } from '@/components/Shell';
import { LineChart, Legend, type ChartLine } from '@/components/charts';
import { Empty, FilterMenu, Notice, Skeleton, Tabs, useToast } from '@/components/ui';

type Tab = 'site' | 'gsc' | 'app';

interface DayPoint {
  date: string;
  value: number;
  other?: number;
}

interface SourceState {
  configured: boolean;
  missing?: string[];
  error?: string;
}

interface SiteRow {
  key: string;
  visitors: number;
  pageviews: number;
}

interface SiteData {
  source: 'vercel' | '';
  vercel: SourceState;
  end: string;
  totals: { visitors: number; pageviews: number; prev_visitors: number; prev_pageviews: number };
  series: DayPoint[];
  prev_series: DayPoint[];
  pages: SiteRow[];
  referrers: SiteRow[];
  countries: SiteRow[];
  devices: SiteRow[];
}

interface GscRow {
  key?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscData extends SourceState {
  end: string;
  totals: GscRow;
  prev: GscRow;
  series: DayPoint[];
  queries: GscRow[];
  pages: GscRow[];
}

interface StoreData extends SourceState {
  key: string;
  name: string;
  total: number;
  prev: number;
  series: DayPoint[];
  through?: string;
}

interface AppData {
  end: string;
  stores: StoreData[];
  devices: { ios: number; android: number };
  signups: { total: number; prev: number; ios: number; android: number; web: number; unknown: number };
  premium: { app_store: number; google_play: number; stripe: number; gift: number };
  follows: { matches: number; tournaments: number };
}

const PERIODS = [
  { value: 7, label: '7 jours' },
  { value: 28, label: '28 jours' },
  { value: 90, label: '90 jours' },
];

const ACCENT = '#F22E62';
const GREY = '#A1A1AA';
const BLUE = '#1D4ED8';

// « ↗ 14,6 % » between two periods; nothing when the previous one is empty.
function Variation({ current, previous }: { current: number; previous: number }) {
  if (!previous || current === previous) return null;
  const ratio = (current - previous) / previous;
  return <span className={`delta ${ratio >= 0 ? 'up' : 'down'}`}>{`${ratio >= 0 ? '↗' : '↘'} ${dec1(Math.abs(ratio) * 100)} %`}</span>;
}

function Kpi({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="kpi">
      <span className="kpi-l">{label}</span>
      <div className="kpi-v">
        <span>
          <b>{value}</b>
          {children}
        </span>
      </div>
    </div>
  );
}

function NotConnected({ name, title, missing, error }: { name: string; title?: string; missing?: string[]; error?: string }) {
  if (error) return <Notice tone="rouge">{name} : {error}</Notice>;
  return (
    <section className="carte">
      <div className="carte-c">
        <p>
          <b style={{ fontWeight: 600 }}>{title || `${name} n'est pas connecté.`}</b>
        </p>
        <p className="faible">
          Aucun chiffre n&apos;est affiché tant que la source n&apos;est pas branchée. Variables à définir sur le backend :
        </p>
        <p className="mono">{(missing || []).join(' · ')}</p>
      </div>
    </section>
  );
}

function pagePath(url: string): string {
  const path = url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) : url.replace(/^https?:\/\/[^/]+/, '');
  return path === '/' || path === '' ? 'Accueil' : path;
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('gsc');
  const [days, setDays] = useState(28);

  const site = useSWR<SiteData>(tab === 'site' ? `/analytics/site?days=${days}` : null, fetcher);
  const gsc = useSWR<GscData>(tab === 'gsc' ? `/analytics/gsc?days=${days}` : null, fetcher);
  const app = useSWR<AppData>(tab === 'app' ? `/analytics/app?days=${days}` : null, fetcher);

  const end = tab === 'gsc' ? gsc.data?.end : tab === 'site' ? site.data?.end : app.data?.end;
  const failure = tab === 'gsc' ? gsc.error : tab === 'site' ? site.error : app.error;

  return (
    <>
      <PageHeader title="Analytics">
        <FilterMenu label="Période" value={days} onChange={(v) => setDays(v ?? 28)} options={PERIODS} />
        {end && <span className="faible">jusqu&apos;au {day(end + 'T12:00:00')}</span>}
        <button
          type="button"
          className="btn btn-s"
          onClick={() => download(`/analytics/export?tab=${tab}&days=${days}`, `analytics-${tab}.csv`).catch((e) => toast.fail(errorMessage(e)))}
        >
          <Download aria-hidden="true" />
          Exporter
        </button>
      </PageHeader>
      <main className="contenu">
        <Tabs
          label="Sources"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'site', label: 'Site · Vercel' },
            { value: 'gsc', label: 'Google · Search Console' },
            { value: 'app', label: 'Application mobile' },
          ]}
        />
        {failure && <Notice tone="rouge">{errorMessage(failure)}</Notice>}
        {tab === 'gsc' && <GscTab data={gsc.data} />}
        {tab === 'site' && <SiteTab data={site.data} />}
        {tab === 'app' && <AppTab data={app.data} />}
      </main>
    </>
  );
}

function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skeleton height={76} />
      <Skeleton height={220} />
      <Skeleton height={240} />
    </div>
  );
}

function ChartCard({ title, dates, lines, describe }: { title: string; dates: string[]; lines: ChartLine[]; describe: string }) {
  return (
    <section className="carte" style={{ flexShrink: 0 }}>
      <div className="carte-t">
        <LineChartIcon className="ico" aria-hidden="true" />
        <h2>{title}</h2>
      </div>
      <div className="carte-c">
        <LineChart dates={dates} lines={lines} describe={describe} width={1100} height={170} />
        <Legend lines={lines} />
      </div>
    </section>
  );
}

function GscTab({ data }: { data?: GscData }) {
  if (!data) return <Loading />;
  if (!data.configured || data.error) return <NotConnected name="Google Search Console" missing={data.missing} error={data.error} />;
  const { totals, prev } = data;
  const ctrPoints = (totals.ctr - prev.ctr) * 100;
  const positionGain = prev.position - totals.position;
  const lines: ChartLine[] = [
    { label: 'Clics', values: data.series.map((p) => p.value), color: ACCENT, width: 2 },
    { label: 'Impressions', values: data.series.map((p) => p.other || 0), color: GREY, ownScale: true },
  ];
  return (
    <>
      <div className="info">
        <Info aria-hidden="true" />
        {/* An abbreviated month already ends with a full stop (« 22 nov. »). */}
        Google publie ses chiffres avec 2 à 3 jours de retard : la période s&apos;arrête au{' '}
        {day(data.end + 'T12:00:00').replace(/\.$/, '')}.
      </div>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <Kpi label="Clics" value={num(totals.clicks)}>
          <Variation current={totals.clicks} previous={prev.clicks} />
        </Kpi>
        <Kpi label="Impressions" value={num(totals.impressions)}>
          <Variation current={totals.impressions} previous={prev.impressions} />
        </Kpi>
        <Kpi label="Taux de clic" value={`${dec1(totals.ctr * 100)} %`}>
          {prev.impressions > 0 && (
            <span className={`delta ${ctrPoints >= 0 ? 'up' : 'down'}`}>{`${ctrPoints >= 0 ? '↗' : '↘'} ${dec1(Math.abs(ctrPoints))} pt`}</span>
          )}
        </Kpi>
        <Kpi label="Position moyenne" value={totals.impressions > 0 ? dec1(totals.position) : '—'}>
          {/* A smaller position is a better rank: it reads as a gain. */}
          {prev.impressions > 0 && totals.impressions > 0 && (
            <span className={`delta ${positionGain >= 0 ? 'up' : 'down'}`}>{`${positionGain >= 0 ? '↗' : '↘'} ${dec1(Math.abs(positionGain))}`}</span>
          )}
        </Kpi>
      </div>
      <ChartCard
        title="Clics et impressions par jour"
        dates={data.series.map((p) => p.date)}
        lines={lines}
        describe={`Clics et impressions par jour, ${num(totals.clicks)} clics sur la période`}
      />
      <div className="grille-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
        <GscTable title="Requêtes" head="Requête" rows={data.queries} render={(k) => k} />
        <GscTable title="Pages" head="Page" rows={data.pages} render={pagePath} mono />
      </div>
      <NotIndexedCard />
    </>
  );
}

interface NotIndexed {
  configured: boolean;
  checked: number;
  pages: { url: string; article_id: number | null; coverage_state: string; not_indexed_since: string | null; checked_at: string }[];
}

// The latest articles are checked against Google's index once a day.
function NotIndexedCard() {
  const { data } = useSWR<NotIndexed>('/analytics/gsc/index', fetcher);
  if (!data || !data.configured) return null;
  return (
    <section className="carte">
      <div className="carte-t">
        <h2>Articles absents de l&apos;index Google</h2>
        <div className="droite">
          <span className="faible" style={{ fontSize: 12 }}>
            {data.checked > 0 ? `${num(data.checked)} articles récents vérifiés chaque jour` : 'première vérification en attente'}
          </span>
        </div>
      </div>
      {data.pages.length === 0 ? (
        <Empty>{data.checked > 0 ? 'Tous les articles vérifiés sont indexés.' : 'Aucun article vérifié pour le moment.'}</Empty>
      ) : (
        <div className="box-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Page</th>
                <th>État selon Google</th>
                <th>Depuis</th>
              </tr>
            </thead>
            <tbody>
              {data.pages.map((p) => (
                <tr key={p.url}>
                  <td className="court mono" style={{ maxWidth: 520 }} title={p.url}>
                    {p.article_id ? <Link href={`/articles/${p.article_id}`}>{pagePath(p.url)}</Link> : pagePath(p.url)}
                  </td>
                  <td>{p.coverage_state || '—'}</td>
                  <td className="faible" style={{ whiteSpace: 'nowrap' }}>
                    {p.not_indexed_since ? day(p.not_indexed_since) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GscTable({ title, head, rows, render, mono }: { title: string; head: string; rows: GscRow[]; render: (key: string) => string; mono?: boolean }) {
  return (
    <section className="carte">
      <div className="carte-t">
        <h2>{title}</h2>
        <div className="droite">
          <span className="faible" style={{ fontSize: 12 }}>
            par clics
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty>Aucune donnée sur la période.</Empty>
      ) : (
        <div className="box-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>{head}</th>
                <th className="num">Clics</th>
                <th className="num">Impressions</th>
                <th className="num">Position</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const label = render(r.key || '');
                return (
                  <tr key={r.key}>
                    <td className={`court ${mono && label !== 'Accueil' ? 'mono' : ''}`} style={{ maxWidth: 330 }} title={r.key}>
                      {label}
                    </td>
                    <td className="num">{num(r.clicks)}</td>
                    <td className="num">{num(r.impressions)}</td>
                    <td className="num">{dec1(r.position)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SiteTab({ data }: { data?: SiteData }) {
  if (!data) return <Loading />;
  if (data.source !== 'vercel') return <NotConnected name="Vercel Web Analytics" missing={data.vercel.missing} error={data.vercel.error} />;
  const { totals } = data;
  const perVisitor = totals.visitors > 0 ? totals.pageviews / totals.visitors : null;
  const lines: ChartLine[] = [
    { label: 'Visiteurs', values: data.series.map((p) => p.value), color: ACCENT, width: 2 },
    { label: 'Période précédente', values: data.prev_series.map((p) => p.value), color: GREY, dashed: true },
  ];
  return (
    <>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <Kpi label="Visiteurs uniques" value={num(totals.visitors)}>
          <Variation current={totals.visitors} previous={totals.prev_visitors} />
        </Kpi>
        <Kpi label="Pages vues" value={num(totals.pageviews)}>
          <Variation current={totals.pageviews} previous={totals.prev_pageviews} />
        </Kpi>
        <Kpi label="Pages par visiteur" value={perVisitor === null ? '—' : dec1(perVisitor)} />
      </div>
      <ChartCard
        title="Visiteurs par jour"
        dates={data.series.map((p) => p.date)}
        lines={lines}
        describe={`Visiteurs par jour, ${num(totals.visitors)} sur la période contre ${num(totals.prev_visitors)} sur la précédente`}
      />
      <div className="grille-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
        <SiteTable title="Pages" head="Page" rows={data.pages} render={pagePath} mono />
        <SiteTable title="Provenance" head="Site d'origine" rows={data.referrers} render={(k) => k} />
        {data.countries.length > 0 && <SiteTable title="Pays" head="Pays" rows={data.countries} render={countryName} />}
        {data.devices.length > 0 && <SiteTable title="Appareils" head="Type" rows={data.devices} render={deviceName} />}
      </div>
    </>
  );
}

const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['fr'], { type: 'region' }) : null;

function countryName(code: string): string {
  try {
    return regionNames?.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

function deviceName(kind: string): string {
  return { desktop: 'Ordinateur', mobile: 'Mobile', tablet: 'Tablette' }[kind.toLowerCase()] || kind;
}

function SiteTable({ title, head, rows, render, mono }: { title: string; head: string; rows: SiteRow[]; render: (key: string) => string; mono?: boolean }) {
  return (
    <section className="carte">
      <div className="carte-t">
        <h2>{title}</h2>
        <div className="droite">
          <span className="faible" style={{ fontSize: 12 }}>
            par pages vues
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty>Aucune donnée sur la période.</Empty>
      ) : (
        <div className="box-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>{head}</th>
                <th className="num">Visiteurs</th>
                <th className="num">Pages vues</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const label = render(r.key);
                return (
                  <tr key={r.key}>
                    <td className={`court ${mono && label !== 'Accueil' ? 'mono' : ''}`} style={{ maxWidth: 330 }} title={r.key}>
                      {label}
                    </td>
                    <td className="num">{num(r.visitors)}</td>
                    <td className="num">{num(r.pageviews)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AppTab({ data }: { data?: AppData }) {
  if (!data) return <Loading />;
  const connected = data.stores.filter((s) => s.configured);
  const total = connected.reduce((sum, s) => sum + s.total, 0);
  const prev = connected.reduce((sum, s) => sum + s.prev, 0);
  const colors: Record<string, string> = { app_store: ACCENT, google_play: BLUE };
  const lines: ChartLine[] = connected.map((s) => ({
    label: s.name,
    values: s.series.map((p) => p.value),
    color: colors[s.key] || GREY,
    width: 2,
  }));
  const signupsKnown = data.signups.ios + data.signups.android + data.signups.web;

  return (
    <>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <Kpi label="Téléchargements de l'app" value={connected.length > 0 ? num(total) : '—'}>
          {connected.length > 0 && <Variation current={total} previous={prev} />}
        </Kpi>
        {data.stores.map((s) => (
          <Kpi key={s.key} label={s.name} value={s.configured ? num(s.total) : '—'}>
            {s.configured ? <Variation current={s.total} previous={s.prev} /> : <span className="sous">non connecté</span>}
          </Kpi>
        ))}
        <Kpi label="Appareils joignables en push" value={num(data.devices.ios + data.devices.android)}>
          <span className="sous">
            {num(data.devices.ios)} iOS · {num(data.devices.android)} Android
          </span>
        </Kpi>
      </div>

      {connected.length > 0 ? (
        <>
          {connected.some((s) => s.through && s.through < data.end) && (
            <div className="info">
              <Info aria-hidden="true" />
              Les stores publient leurs chiffres avec retard :{' '}
              {connected
                .filter((s) => s.through)
                .map((s) => `${s.name} jusqu'au ${day(s.through + 'T12:00:00')}`)
                .join(', ')}
              . Les jours suivants ne sont pas encore connus.
            </div>
          )}
          <ChartCard
            title="Téléchargements par jour"
            dates={connected[0].series.map((p) => p.date)}
            lines={lines}
            describe={`Téléchargements par jour, ${num(total)} sur la période`}
          />
        </>
      ) : null}

      {data.stores
        .filter((s) => !s.configured)
        .map((s) => (
          <NotConnected key={s.key} name={s.name} title={`Les téléchargements ${s.name} ne sont pas connectés.`} missing={s.missing} />
        ))}

      <div className="grille-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <section className="carte">
          <div className="carte-t">
            <h2>Inscriptions</h2>
            <div className="droite">
              <Variation current={data.signups.total} previous={data.signups.prev} />
            </div>
          </div>
          <dl className="dl" style={{ gridTemplateColumns: '1fr auto' }}>
            <dt>Sur la période</dt>
            <dd>{num(data.signups.total)}</dd>
            <dt>Depuis l&apos;app iOS</dt>
            <dd>{num(data.signups.ios)}</dd>
            <dt>Depuis l&apos;app Android</dt>
            <dd>{num(data.signups.android)}</dd>
            <dt>Depuis le site</dt>
            <dd>{num(data.signups.web)}</dd>
            {data.signups.unknown > 0 && (
              <>
                <dt>Origine non enregistrée</dt>
                <dd>{num(data.signups.unknown)}</dd>
              </>
            )}
          </dl>
          {signupsKnown === 0 && data.signups.unknown > 0 && (
            <div className="carte-c" style={{ borderTop: '1px solid var(--line-soft)' }}>
              <p className="aide">L&apos;origine est enregistrée pour les comptes créés depuis la mise en service du back-office.</p>
            </div>
          )}
        </section>
        <section className="carte">
          <div className="carte-t">
            <h2>Abonnés Premium</h2>
          </div>
          <dl className="dl" style={{ gridTemplateColumns: '1fr auto' }}>
            <dt>App Store</dt>
            <dd>{num(data.premium.app_store)}</dd>
            <dt>Google Play</dt>
            <dd>{num(data.premium.google_play)}</dd>
            <dt>Site (Stripe)</dt>
            <dd>{num(data.premium.stripe)}</dd>
            <dt>Offerts</dt>
            <dd>{num(data.premium.gift)}</dd>
          </dl>
        </section>
        <section className="carte">
          <div className="carte-t">
            <h2>Alertes en attente</h2>
          </div>
          <dl className="dl" style={{ gridTemplateColumns: '1fr auto' }}>
            <dt>Matchs suivis</dt>
            <dd>{num(data.follows.matches)}</dd>
            <dt>Tournois suivis</dt>
            <dd>{num(data.follows.tournaments)}</dd>
          </dl>
        </section>
      </div>
    </>
  );
}
