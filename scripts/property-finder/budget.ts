/**
 * Tracks paid API calls per calendar month so scheduled runs can't blow
 * through the RentCast free plan (50 calls/month). State lives in
 * listings.json's meta.budget, so it survives between Action runs.
 *
 * RentCast bills by your subscription month, not the calendar month — the
 * default limit (45) leaves headroom for that mismatch.
 */
export class Budget {
  month: string;
  callsUsed: number;
  readonly limit: number;

  constructor(prev: { month: string; callsUsed: number } | undefined, limit: number, now = new Date()) {
    this.month = now.toISOString().slice(0, 7);
    this.callsUsed = prev && prev.month === this.month ? prev.callsUsed : 0;
    this.limit = limit;
  }

  get remaining(): number {
    return Math.max(0, this.limit - this.callsUsed);
  }

  canSpend(calls = 1): boolean {
    return this.callsUsed + calls <= this.limit;
  }

  spend(calls = 1): void {
    this.callsUsed += calls;
  }

  toJSON() {
    return { month: this.month, callsUsed: this.callsUsed, limit: this.limit };
  }
}
