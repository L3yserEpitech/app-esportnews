// Inline <head> script, served before any chunk can fail.
//
// Why: Next (Turbopack) loads the page as ~17 async <script> chunks. When one
// of them errors after hydration has started, the runtime throws "Failed to
// load chunk" inside React, React unmounts the root and the whole <body> is
// emptied, server-rendered markup included. Google's renderer hits that path
// regularly: its fetch of one chunk times out after 30 s (seen on the crawl of
// 2026-10-29 22:44 and in the live test of 2026-10-30), so the home page was
// indexed as an empty document: title link reduced to the site name, no
// snippet, "missing terms" on the description's own words.
//
// The listener runs in the capture phase, so it sees the script's error event
// before the runtime's own listener on the element. It swallows the event and
// reloads the chunk under a cache-busting query. The runtime keys a chunk by
// its path without query (`getAttribute("src")` stripped of `?...`) and
// resolves the pending load when the retried script registers itself, so a
// successful retry hydrates normally. After MAX failures the load stays
// pending: the page keeps its server-rendered content instead of going blank.
// The src is taken from the attribute (relative, "/_next/...") on purpose:
// an absolute URL would register under another key and never resolve.
export const CHUNK_RETRY_SCRIPT =
  "(function(){var M=2;window.addEventListener('error',function(e){var el=e.target;if(!el||el.tagName!=='SCRIPT')return;var src=el.getAttribute('src')||'';if(src.indexOf('/_next/static/chunks/')!==0)return;var n=Number(el.getAttribute('data-chunk-retry')||0);if(n>=M)return;e.stopImmediatePropagation();var s=document.createElement('script');s.src=src.replace(/[?&]chunkretry=\\d+$/,'')+(src.indexOf('?')===-1?'?':'&')+'chunkretry='+(n+1);s.async=true;s.setAttribute('data-chunk-retry',String(n+1));document.head.appendChild(s)},true)})();";
