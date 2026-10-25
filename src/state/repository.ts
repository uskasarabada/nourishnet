// Data access boundary. The UI only talks to a `Repository`, so the local demo
// implementation below can be swapped for a REST/Supabase/Firebase client
// without touching any screen. See docs/ARCHITECTURE.md.

import type { FoodDrive, Shelter, UserProfile } from '../lib/types';
import { DEMO_USER, DRIVES, SHELTERS } from '../data/seed';

export interface Snapshot {
  drives: FoodDrive[];
  shelters: Shelter[];
  user: UserProfile;
}

export interface Repository {
  load(): Snapshot;
  save(s: Snapshot): void;
  reset(): Snapshot;
}

const KEY = 'nourishnet.demo.v3';

/** Seed data + the user's own changes, kept in this browser only. */
export const localRepository: Repository = {
  load() {
    const seed: Snapshot = { drives: DRIVES, shelters: SHELTERS, user: DEMO_USER };
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return seed;
      const saved = JSON.parse(raw) as Partial<Snapshot> & { createdDrives?: FoodDrive[] };
      return {
        drives: saved.drives ?? seed.drives,
        shelters: saved.shelters ?? seed.shelters,
        user: saved.user ?? seed.user,
      };
    } catch {
      return seed;
    }
  },
  save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable (private mode) — demo still works in memory */
    }
  },
  reset() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return { drives: DRIVES, shelters: SHELTERS, user: DEMO_USER };
  },
};
