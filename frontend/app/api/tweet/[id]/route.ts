import { NextRequest, NextResponse } from 'next/server';
import { getTweet } from 'react-tweet/api';
import type { Tweet } from 'react-tweet/api';

export const runtime = 'edge';

// X's syndication API omits entity buckets that are empty, but react-tweet's
// getEntities() spreads hashtags / user_mentions / urls / symbols unguarded
// (only `media` is checked), so a tweet without hashtags throws
// "entities is not iterable" and the embed collapses. Backfill them here.
function withEntities<T extends Tweet>(tweet: T): T {
  const e = tweet.entities ?? ({} as Tweet['entities']);
  const normalized = {
    ...e,
    hashtags: e.hashtags ?? [],
    user_mentions: e.user_mentions ?? [],
    urls: e.urls ?? [],
    symbols: e.symbols ?? [],
  };
  const quoted = (tweet as { quoted_tweet?: Tweet }).quoted_tweet;
  return {
    ...tweet,
    entities: normalized,
    ...(quoted ? { quoted_tweet: withEntities(quoted) } : {}),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const tweet = await getTweet(id);
    if (!tweet) return NextResponse.json({ notFound: true }, { status: 404 });
    // react-tweet's browser fetcher reads `json.data` and treats anything else
    // as "fetched but empty", which renders its TweetNotFound box.
    return NextResponse.json({ data: withEntities(tweet) });
  } catch (err: unknown) {
    const status =
      err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    return NextResponse.json({ error: 'Failed to fetch tweet' }, { status });
  }
}
