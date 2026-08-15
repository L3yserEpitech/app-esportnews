import { useEffect, useRef, useState } from 'react';
import { useNavigationContainerRef, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

type DeepLinkTarget = {
  pathname: string;
  params: Record<string, string>;
};

const NAVIGATION_READY_POLL_MS = 50;

/** Maps a push payload to the screen it should open. */
function targetForNotification(data: Record<string, any> | undefined | null): DeepLinkTarget | null {
  if (!data) return null;

  if (data.type === 'match_start' && data.match_id) {
    const params: Record<string, string> = { id: String(data.match_id) };
    // The detail endpoint only resolves the alphanumeric match2id on-demand,
    // and wiki scopes the lookup instead of scanning the 10 poller caches.
    if (data.m2) params.m2 = String(data.m2);
    if (data.wiki) params.wiki = String(data.wiki);
    return { pathname: '/match/[id]', params };
  }

  if ((data.type === 'new_article' || data.type === 'new_news') && data.slug) {
    return { pathname: '/article/[slug]', params: { slug: String(data.slug) } };
  }

  return null;
}

/**
 * Routes a notification tap to its screen, cold start included.
 *
 * `useLastNotificationResponse` — unlike `addNotificationResponseReceivedListener`
 * — replays the tap that launched the app from a killed state. That tap lands
 * before the navigation container is ready (a parent's effects run after this
 * layout's), when `router.push` is a silent no-op, so the target is held until
 * navigation can accept it. An interstitial ad showing on top then can't
 * swallow the redirect: it is a native screen layered over a navigation that
 * already happened.
 */
export function useNotificationDeepLink() {
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const response = Notifications.useLastNotificationResponse();

  const [pending, setPending] = useState<DeepLinkTarget | null>(null);
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;

    const identifier = response.notification.request.identifier;
    if (handledRef.current === identifier) return;
    handledRef.current = identifier;

    const target = targetForNotification(response.notification.request.content.data as Record<string, any>);
    if (target) setPending(target);

    // The response is sticky across launches: clearing it stops a later cold
    // start from replaying an old tap.
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [response]);

  useEffect(() => {
    if (!pending) return;

    const go = () => {
      setPending(null);
      router.push(pending as any);
    };

    if (navigationRef.isReady()) {
      go();
      return;
    }

    const timer = setInterval(() => {
      if (!navigationRef.isReady()) return;
      clearInterval(timer);
      go();
    }, NAVIGATION_READY_POLL_MS);
    return () => clearInterval(timer);
  }, [pending, navigationRef, router]);
}
