import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StructuredData } from './StructuredData';

const HOSTILE = "BLAST</script><script>alert(1)</script>";

function render(name: string): string {
  return renderToStaticMarkup(createElement(StructuredData, { data: { '@type': 'SportsEvent', name } }));
}

// Tournament, team and player names come from Liquipedia, a wiki anyone edits.
// Web tokens live in localStorage: a script here is a stolen session, admin included.
describe('StructuredData', () => {
  it('cannot close its script tag from a value', () => {
    const html = render(HOSTILE);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it('keeps the value intact for a JSON-LD reader', () => {
    const html = render(HOSTILE);
    const json = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(JSON.parse(json).name).toBe(HOSTILE);
  });

  it('cannot open an HTML comment either', () => {
    expect(render('<!--<script>')).not.toContain('<!--');
  });
});
