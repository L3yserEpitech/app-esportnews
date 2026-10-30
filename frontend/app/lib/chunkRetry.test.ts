import { describe, it, expect } from 'vitest';
import { CHUNK_RETRY_SCRIPT } from './chunkRetry';

type FakeScript = {
  tagName: string;
  src: string;
  async?: boolean;
  attrs: Record<string, string>;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
};

function script(src: string, attrs: Record<string, string> = {}): FakeScript {
  return {
    tagName: 'SCRIPT',
    src,
    attrs: { src, ...attrs },
    getAttribute(name) {
      return name in this.attrs ? this.attrs[name] : null;
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
  };
}

// Runs the inline script against a minimal DOM double and returns the error
// handler it registered plus the scripts it appended.
function install() {
  const appended: FakeScript[] = [];
  let handler: ((e: unknown) => void) | undefined;
  let capture: boolean | undefined;
  const window = {
    addEventListener(type: string, fn: (e: unknown) => void, useCapture: boolean) {
      if (type === 'error') {
        handler = fn;
        capture = useCapture;
      }
    },
  };
  const document = {
    createElement: () => script(''),
    head: { appendChild: (s: FakeScript) => appended.push(s) },
  };
  new Function('window', 'document', CHUNK_RETRY_SCRIPT)(window, document);
  if (!handler) throw new Error('no error listener registered');
  return { handler, capture, appended };
}

function fail(handler: (e: unknown) => void, target: unknown) {
  let stopped = false;
  handler({ target, stopImmediatePropagation: () => (stopped = true) });
  return stopped;
}

const CHUNK = '/_next/static/chunks/654d1dee35bdcfe0.js?dpl=dpl_abc';

describe('CHUNK_RETRY_SCRIPT', () => {
  it('listens in the capture phase, ahead of the runtime listener on the element', () => {
    expect(install().capture).toBe(true);
  });

  it('swallows the first failure and reloads the chunk under a cache-busting query', () => {
    const { handler, appended } = install();
    expect(fail(handler, script(CHUNK))).toBe(true);
    expect(appended).toHaveLength(1);
    expect(appended[0].src).toBe(`${CHUNK}&chunkretry=1`);
    expect(appended[0].async).toBe(true);
    expect(appended[0].getAttribute('data-chunk-retry')).toBe('1');
  });

  it('keeps the relative path and replaces a previous retry marker', () => {
    const { handler, appended } = install();
    fail(handler, script(`${CHUNK}&chunkretry=1`, { 'data-chunk-retry': '1' }));
    expect(appended[0].src).toBe(`${CHUNK}&chunkretry=2`);
  });

  it('gives up after two retries and lets the runtime see the failure', () => {
    const { handler, appended } = install();
    expect(fail(handler, script(`${CHUNK}&chunkretry=2`, { 'data-chunk-retry': '2' }))).toBe(false);
    expect(appended).toHaveLength(0);
  });

  it('ignores scripts that are not Next chunks', () => {
    const { handler, appended } = install();
    expect(fail(handler, script('https://cdn.example.com/lib.js'))).toBe(false);
    expect(fail(handler, { tagName: 'IMG', getAttribute: () => '/_next/image?url=x' })).toBe(false);
    expect(fail(handler, null)).toBe(false);
    expect(appended).toHaveLength(0);
  });
});
