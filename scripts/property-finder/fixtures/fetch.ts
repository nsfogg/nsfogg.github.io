import { readFileSync } from 'node:fs';

// Offline stand-in for fetch(), used by `pf:ingest --fixtures` and the tests.
// It serves the bundled Seattle fixtures so the whole pipeline (adapter →
// merge → waterfront → alerts) runs without touching the network.

const load = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const json = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'application/json' } });

export const fixtureFetch: typeof fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === 'api.rentcast.io') {
    return json(url.searchParams.get('offset') === '0' ? load('rentcast-seattle.json') : '[]');
  }
  if (url.hostname === 'api.simplyrets.com') {
    return json(url.searchParams.get('offset') === '0' ? load('simplyrets-sample.json') : '[]');
  }
  if (url.hostname.startsWith('overpass')) return json(load('overpass-seattle.json'));
  if (url.hostname.endsWith('discord.com')) return new Response(null, { status: 204 });
  return json(JSON.stringify({ error: `no fixture for ${url.href}` }), 404);
};
