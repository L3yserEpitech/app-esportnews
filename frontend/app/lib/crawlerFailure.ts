import { headers } from 'next/headers';
import { isSearchEngineCrawler } from './crawlers';

// The backend could not say what this page holds. A visitor gets the client, which
// retries, and a link preview gets the title read from the URL. A search engine gets
// a 5xx: it keeps what it has indexed and slows down, where a 200 would replace it
// with an empty page and a noindex would de-index it. Next renders the error twice,
// which replays the upstream fetch of generateMetadata: 2 backend calls per failure.
export async function failForCrawlers(): Promise<void> {
  const requestHeaders = await headers();
  if (isSearchEngineCrawler(requestHeaders.get('user-agent'))) {
    throw new Error('backend unavailable: answering 5xx to a search engine');
  }
}
