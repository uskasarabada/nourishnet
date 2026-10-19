// Volunteer Matching: rank open shifts by fit with a volunteer's preferences.
//   score = 40·availability + 25·distance + 20·role + 15·need-for-help
// Shifts that are full, past, or on days the volunteer is unavailable are excluded.

import type { FoodDrive, LatLng, VolunteerShift } from './types';
import { haversineMiles } from './geo';
import { daysFromToday, parseISODate } from './dates';

export interface VolunteerPrefs {
  days: number[]; // 0=Sun … 6=Sat
  times: ('morning' | 'afternoon')[];
  roles: VolunteerShift['role'][];
  maxMiles: number;
  home: LatLng;
}

export interface ShiftMatch {
  drive: FoodDrive;
  shift: VolunteerShift;
  miles: number;
  score: number;
  reasons: string[];
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function matchShifts(drives: FoodDrive[], prefs: VolunteerPrefs, signedUp: string[]): ShiftMatch[] {
  const out: ShiftMatch[] = [];
  for (const d of drives) {
    if (d.status === 'completed') continue;
    const miles = haversineMiles(prefs.home, d.location);
    if (miles > prefs.maxMiles) continue;
    for (const s of d.shifts) {
      if (daysFromToday(s.date) < 0 || signedUp.includes(s.id)) continue;
      const open = s.slots - s.filled;
      if (open <= 0) continue;
      const dow = parseISODate(s.date).getDay();
      if (prefs.days.length && !prefs.days.includes(dow)) continue;
      const tod = Number(s.start.slice(0, 2)) < 12 ? 'morning' : 'afternoon';
      const timeOk = !prefs.times.length || prefs.times.includes(tod);
      const roleOk = !prefs.roles.length || prefs.roles.includes(s.role);
      const score = Math.round(
        40 * (timeOk ? 1 : 0.3) + 25 * (1 - miles / Math.max(prefs.maxMiles, 1)) + 20 * (roleOk ? 1 : 0.2) + 15 * (open / s.slots),
      );
      const reasons = [
        `${DAY[dow]} ${tod}${timeOk ? ' — matches your availability' : ' — outside your preferred time'}`,
        `${miles.toFixed(1)} mi from home`,
        roleOk ? `${s.role} is one of your preferred roles` : `${s.role} (not a preferred role)`,
        `${open} of ${s.slots} spots open`,
      ];
      out.push({ drive: d, shift: s, miles, score, reasons });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
