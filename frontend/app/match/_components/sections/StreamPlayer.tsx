'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tv, Play, ExternalLink } from 'lucide-react';
import { SectionHeader, type MatchSectionProps } from './shared';

const getTwitchChannel = (url: string) => {
  const m = url.match(/twitch\.tv\/([^/?]+)/);
  return m ? m[1] : '';
};
const getYoutubeId = (url: string) => {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([^&/?]+)/);
  return m ? m[1] : '';
};

export default function StreamPlayer({ match, isLive }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const [selectedStreamIdx, setSelectedStreamIdx] = useState(0);

  const sortedStreams = [...(match.streams_list || [])].sort((a, b) => {
    if (a.official && !b.official) return -1;
    if (!a.official && b.official) return 1;
    if (a.main && !b.main) return -1;
    if (!a.main && b.main) return 1;
    return 0;
  });
  if (sortedStreams.length === 0) return null;

  const selectedStream = sortedStreams[Math.min(selectedStreamIdx, sortedStreams.length - 1)];
  const isTwitch = selectedStream?.raw_url?.includes('twitch');
  const isYoutube = selectedStream?.raw_url?.includes('youtube');

  return (
    <section>
      <SectionHeader
        icon={Tv}
        title={t('section_streaming')}
        extra={isLive ? (
          <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-status-live)] font-bold uppercase tracking-[0.15em]">
            <span className="w-1.5 h-1.5 bg-[var(--color-status-live)] rounded-full animate-pulse" />
            {t('stream_live_now')}
          </span>
        ) : undefined}
      />

      {(isTwitch || isYoutube) && selectedStream && (
        <div className="relative w-full rounded-xl overflow-hidden border border-[var(--color-border-primary)]/30 mb-4 group transition-all duration-300 hover:border-[var(--color-accent)]/15">
          <div className="relative bg-black rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
            {isTwitch ? (
              <iframe
                src={`https://player.twitch.tv/?channel=${getTwitchChannel(selectedStream.raw_url)}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`}
                height="100%" width="100%" allowFullScreen
                className="absolute inset-0 w-full h-full"
                allow="autoplay"
              />
            ) : isYoutube ? (
              <iframe
                width="100%" height="100%"
                src={`https://www.youtube.com/embed/${getYoutubeId(selectedStream.raw_url)}`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-none"
              />
            ) : null}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {sortedStreams.map((stream, idx) => {
          const platform = stream.raw_url?.includes('twitch') ? 'Twitch' :
                           stream.raw_url?.includes('youtube') ? 'YouTube' :
                           t('stream_fallback');
          const isSelected = selectedStreamIdx === idx;
          return (
            <button
              key={idx}
              onClick={() => setSelectedStreamIdx(idx)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all duration-200 border cursor-pointer ${
                isSelected
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : 'bg-[var(--color-bg-secondary)]/50 border-[var(--color-border-primary)]/25 text-text-secondary hover:border-accent/15 hover:text-text-primary'
              }`}
            >
              {isSelected && <Play className="w-3 h-3 fill-current" />}
              <span>{stream.official ? t('stream_official') : stream.main ? t('stream_main') : ''} {platform}</span>
              {stream.language && (
                <span className="text-[9px] text-text-muted uppercase tracking-wider opacity-60 ml-0.5">{stream.language}</span>
              )}
            </button>
          );
        })}
      </div>

      {(!isTwitch && !isYoutube) && selectedStream && (
        <a
          href={selectedStream.raw_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-accent text-white rounded-lg text-xs font-bold hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t('stream_link_text')} {selectedStream.raw_url.split('/')[2]}
        </a>
      )}
    </section>
  );
}
