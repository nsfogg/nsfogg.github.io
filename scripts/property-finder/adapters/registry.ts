import type { ListingSourceAdapter } from './base.ts';
import { RentcastAdapter } from './rentcast.ts';
import { SimplyRetsDemoAdapter } from './simplyrets.ts';

/**
 * Picks the live sources from the environment. RentCast is used whenever its
 * key is present (a repository secret in the Action); otherwise the page runs
 * on the SimplyRETS demo feed so it's never empty.
 */
export function activeAdapters(env: NodeJS.ProcessEnv = process.env): ListingSourceAdapter[] {
  const key = env.RENTCAST_API_KEY?.trim();
  if (key) return [new RentcastAdapter(key)];
  return [new SimplyRetsDemoAdapter()];
}
