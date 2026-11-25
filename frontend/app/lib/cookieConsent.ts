// Consent is collected by Google's certified CMP, configured in the AdSense
// account (Confidentialité et messages) and loaded by the AdSense script. It
// speaks the IAB TCF v2 API (window.__tcfapi) and Google's own (window.googlefc).

interface TcData {
  eventStatus?: 'tcloaded' | 'cmpuishown' | 'useractioncomplete';
  gdprApplies?: boolean;
}

type TcfApi = (command: 'addEventListener', version: 2, callback: (data: TcData, success: boolean) => void) => void;

interface GoogleFc {
  callbackQueue?: unknown[];
  showRevocationMessage?: () => void;
}

type ConsentWindow = { __tcfapi?: TcfApi; googlefc?: GoogleFc };

const POLL_MS = 250;

// Calls `onSettled` once nothing is waiting on the visitor: they answered the
// consent message, had already answered, or no message applies (outside the
// EEA, script blocked). Used to show one prompt at a time. Returns a cancel.
export function whenConsentSettled(onSettled: () => void, maxWaitMs = 4000): () => void {
  const target = window as unknown as ConsentWindow;
  let done = false;
  let listening = false;
  let poll: ReturnType<typeof setInterval> | undefined;
  let giveUp: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    done = true;
    clearInterval(poll);
    clearTimeout(giveUp);
  };
  const settle = () => {
    if (done) return;
    stop();
    onSettled();
  };

  const listen = () => {
    if (listening || done || typeof target.__tcfapi !== 'function') return;
    listening = true;
    clearInterval(poll);
    target.__tcfapi('addEventListener', 2, (data, success) => {
      if (!success) return;
      if (data.gdprApplies === false || data.eventStatus === 'tcloaded' || data.eventStatus === 'useractioncomplete') {
        settle();
      } else if (data.eventStatus === 'cmpuishown') {
        // The message is on screen: wait for the answer, however long it takes.
        clearTimeout(giveUp);
      }
    });
  };

  giveUp = setTimeout(settle, maxWaitMs);
  poll = setInterval(listen, POLL_MS);
  listen();

  return stop;
}

// Reopens the consent message so the visitor can change their choice. False
// when no message is available here (outside the EEA, script blocked).
export function openConsentSettings(): boolean {
  const fc = (window as unknown as ConsentWindow).googlefc;
  if (!fc?.callbackQueue || typeof fc.showRevocationMessage !== 'function') return false;
  fc.callbackQueue.push(fc.showRevocationMessage);
  return true;
}
