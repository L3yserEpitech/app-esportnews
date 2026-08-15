import { NextRequest, NextResponse } from 'next/server';
import { getTweet } from 'react-tweet/api';

export const runtime = 'edge';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const tweet = await getTweet(id);
    if (!tweet) return NextResponse.json({ notFound: true }, { status: 404 });
    return NextResponse.json(tweet);
  } catch (err: unknown) {
    const status =
      err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    return NextResponse.json({ error: 'Failed to fetch tweet' }, { status });
  }
}
