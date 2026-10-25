// ─────────────────────────────────────────────────────────────────────────────
// SYNTHETIC DEMONSTRATION DATA — everything in this file is fictional.
//
// Completed drives are generated from a documented "ground truth" process
// (TRUE_* constants below) plus random noise. The forecasting model in
// src/lib/forecast.ts never reads these constants — it has to learn them from
// the generated history, which lets us honestly measure its accuracy.
// A fixed random seed makes the demo identical on every load.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DriveType,
  FoodCategory,
  FoodDrive,
  InventoryLot,
  LatLng,
  OrgType,
  Shelter,
  UserProfile,
  VolunteerShift,
} from '../lib/types';
import { CATEGORIES } from '../lib/categories';
import { addDays, todayISO } from '../lib/dates';
import { haversineMiles } from '../lib/geo';
import { neighborhoodCenter } from './region';

/** Mulberry32: tiny deterministic PRNG so the demo data is reproducible. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261018);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
/** Standard normal via Box–Muller. */
function gauss(): number {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function jitter(c: LatLng, miles: number): LatLng {
  const deg = miles / 69;
  return { lat: c.lat + gauss() * deg * 0.5, lng: c.lng + (gauss() * deg * 0.5) / Math.cos((c.lat * Math.PI) / 180) };
}

// ── Hidden ground-truth process (the model must learn this from data) ──────
const TRUE_RATE: Record<OrgType, number> = { school: 1.55, nonprofit: 2.5, faith: 2.8, business: 1.95, student_group: 1.35 };
const TRUE_SEASON = [0.85, 0.8, 0.88, 0.92, 0.9, 0.74, 0.72, 0.84, 0.96, 1.06, 1.42, 1.34];
const TRUE_DURATION_EXP = 0.58;
const TRUE_NOISE_SIGMA = 0.22;
/** Some neighborhoods simply give more (a "local effect" the model can pick up). */
const TRUE_LOCAL: Record<string, number> = { 'Maple Heights': 1.2, Northgate: 1.15, Eastbrook: 0.88, 'Cedar Flats': 0.9 };

interface Org {
  name: string;
  type: OrgType;
  hood: string;
  participants: [number, number];
}
const ORGS: Org[] = [
  { name: 'Maple Heights High School', type: 'school', hood: 'Maple Heights', participants: [350, 900] },
  { name: 'Cedar Flats Middle School', type: 'school', hood: 'Cedar Flats', participants: [200, 550] },
  { name: 'Riverside Elementary', type: 'school', hood: 'Riverside', participants: [150, 420] },
  { name: 'Eastbrook High School', type: 'school', hood: 'Eastbrook', participants: [300, 800] },
  { name: 'Willow Creek Academy', type: 'school', hood: 'Willow Creek', participants: [120, 300] },
  { name: 'Harvest Neighbors Coalition', type: 'nonprofit', hood: 'Old Mill', participants: [80, 380] },
  { name: 'Open Table Collective', type: 'nonprofit', hood: 'Southpoint', participants: [60, 260] },
  { name: 'Northgate Community Church', type: 'faith', hood: 'Northgate', participants: [60, 280] },
  { name: 'Old Mill Interfaith Council', type: 'faith', hood: 'Old Mill', participants: [50, 220] },
  { name: 'Westfield Credit Union', type: 'business', hood: 'Westfield', participants: [40, 200] },
  { name: 'Brightline Robotics', type: 'business', hood: 'Harbor Hill', participants: [40, 160] },
  { name: 'Eastbrook Key Club', type: 'student_group', hood: 'Eastbrook', participants: [30, 140] },
  { name: 'Riverside NHS Chapter', type: 'student_group', hood: 'Riverside', participants: [25, 120] },
];

const SEASON_NAMES = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Back-to-School', 'Fall', 'Fall', 'Thanksgiving', 'Holiday'];
const DRIVE_TYPES: DriveType[] = ['canned_goods', 'holiday', 'school_challenge', 'mobile_pantry', 'fresh_food'];

function driveTypeFor(org: Org, month: number): DriveType {
  if (month >= 10) return 'holiday';
  if (org.type === 'school' && rand() < 0.6) return 'school_challenge';
  if (org.type === 'nonprofit' && rand() < 0.35) return 'mobile_pantry';
  if (rand() < 0.12) return 'fresh_food';
  return pick(DRIVE_TYPES.slice(0, 1));
}

function acceptedFor(type: DriveType): FoodCategory[] {
  const base: FoodCategory[] = ['grains', 'protein', 'canned_veg', 'canned_fruit', 'breakfast'];
  const extra: FoodCategory[] = [];
  if (rand() < 0.5) extra.push('baby');
  if (rand() < 0.55) extra.push('hygiene');
  if (type === 'fresh_food' || type === 'mobile_pantry') extra.push('produce');
  const trimmed = rand() < 0.25 ? base.slice(0, 3 + int(0, 1)) : base;
  return [...trimmed, ...extra];
}

function splitByCategory(total: number, cats: FoodCategory[]): Partial<Record<FoodCategory, number>> {
  const weights = cats.map((c) => {
    const prior = CATEGORIES.find((x) => x.id === c)!.priorShare;
    return prior * Math.exp(gauss() * 0.25);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  const out: Partial<Record<FoodCategory, number>> = {};
  cats.forEach((c, i) => (out[c] = Math.round((total * weights[i]) / sum)));
  return out;
}

function trueExpectedLbs(org: Org, participants: number, days: number, month: number, cats: number): number {
  return (
    participants *
    TRUE_RATE[org.type] *
    days ** TRUE_DURATION_EXP *
    TRUE_SEASON[month] *
    (cats / 8) ** 0.3 *
    (TRUE_LOCAL[org.hood] ?? 1)
  );
}

function cumulativeLog(start: string, days: number, total: number, uptoDay = days): { day: string; lbs: number }[] {
  // Donations follow a front- and back-loaded curve (kickoff + final push).
  const w = Array.from({ length: days }, (_, i) => 1 + 0.6 * Math.exp(-i) + 0.8 * Math.exp(i - days + 1) + rand() * 0.3);
  const s = w.reduce((a, b) => a + b, 0);
  let run = 0;
  return w.slice(0, uptoDay).map((x, i) => {
    run += (total * x) / s;
    return { day: addDays(start, i), lbs: Math.round(run) };
  });
}

function makeShifts(driveId: string, start: string, days: number, scale: number): VolunteerShift[] {
  const shifts: VolunteerShift[] = [];
  const roles: VolunteerShift['role'][] = ['Setup', 'Collection', 'Greeter', 'Sorting', 'Driver'];
  const shownDays = Math.min(days, 4);
  for (let d = 0; d < shownDays; d++) {
    const date = addDays(start, d === shownDays - 1 ? days - 1 : d);
    for (const role of roles) {
      if (role === 'Setup' && d > 0) continue;
      if (role === 'Driver' && d !== shownDays - 1) continue;
      const am = { start: '08:30', end: '12:00' };
      const pm = { start: '12:00', end: '16:00' };
      for (const t of role === 'Collection' || role === 'Sorting' ? [am, pm] : [am]) {
        const slots = Math.max(2, Math.round((role === 'Sorting' ? 4 : role === 'Driver' ? 2 : 3) * scale));
        shifts.push({ id: `${driveId}-s${shifts.length}`, role, date, start: t.start, end: t.end, slots, filled: 0 });
      }
    }
  }
  return shifts;
}

// ── Shelters ──────────────────────────────────────────────────────────────
function weeklyHistory(base: number, trend: number, amp: number): number[] {
  return Array.from({ length: 16 }, (_, i) => Math.round(base * (1 + trend * i) * (1 + amp * Math.sin(i / 2.2)) * Math.exp(gauss() * 0.06)));
}

const T = todayISO();

// All shelters are generated (keeps the random sequence stable); only three are shown.
const ALL_SHELTERS: Shelter[] = [
  {
    id: 'sh-hope', name: 'Hope Harbor Family Shelter', kind: 'Shelter', neighborhood: 'Riverside',
    location: jitter(neighborhoodCenter('Riverside'), 0.6), address: '410 Ferry St (fictional)',
    needs: [
      { category: 'grains', label: 'Rice', unit: 'lbs', lbsPerUnit: 1, quantityNeeded: 200, quantityReceived: 35, deadline: addDays(T, 6) },
      { category: 'canned_veg', label: 'Canned vegetables', unit: 'cans', lbsPerUnit: 0.9, quantityNeeded: 150, quantityReceived: 20, deadline: addDays(T, 9) },
      { category: 'protein', label: 'Protein products', unit: 'units', lbsPerUnit: 1, quantityNeeded: 100, quantityReceived: 10, deadline: addDays(T, 5) },
      { category: 'baby', label: 'Infant formula', unit: 'units', lbsPerUnit: 1.6, quantityNeeded: 30, quantityReceived: 4, deadline: addDays(T, 4) },
    ],
    reportedSeverity: 3, inventoryDaysOnHand: 5, lastVerified: addDays(T, -2), verifiedBy: 'Shelter director (phone check)',
    instructions: 'Drop off at the side entrance on Ferry St. Please no glass jars. Label boxes by category.',
    hours: 'Mon–Sat 9am–5pm', contact: { phone: '(555) 010-2200', email: 'donate@hopeharbor.example', public: true },
    storage: { refrigerated: true, frozen: false, dryCapacityLbs: 900 }, turnoverDays: 6, peopleServedWeekly: 140,
    weeklyDistributionLbs: weeklyHistory(620, 0.012, 0.05), weeklyBaselineSupplyLbs: 590, currentInventoryLbs: 640, provenance: 'sample',
  },
  {
    id: 'sh-mid', name: 'Mid-Valley Regional Food Bank', kind: 'Food Bank', neighborhood: 'Old Mill',
    location: jitter(neighborhoodCenter('Old Mill'), 0.4), address: '2200 Industrial Pkwy (fictional)',
    needs: [
      { category: 'protein', label: 'Peanut butter & canned meat', unit: 'lbs', lbsPerUnit: 1, quantityNeeded: 600, quantityReceived: 180, deadline: addDays(T, 21) },
      { category: 'breakfast', label: 'Cereal & oatmeal', unit: 'boxes', lbsPerUnit: 1.1, quantityNeeded: 300, quantityReceived: 60, deadline: addDays(T, 18) },
      { category: 'canned_fruit', label: 'Canned fruit', unit: 'cans', lbsPerUnit: 1, quantityNeeded: 250, quantityReceived: 90, deadline: addDays(T, 25) },
      { category: 'grains', label: 'Pasta & rice', unit: 'lbs', lbsPerUnit: 1, quantityNeeded: 500, quantityReceived: 220, deadline: addDays(T, 28) },
      { category: 'produce', label: 'Fresh produce', unit: 'lbs', lbsPerUnit: 1, quantityNeeded: 400, quantityReceived: 120, deadline: addDays(T, 7) },
    ],
    reportedSeverity: 2, inventoryDaysOnHand: 11, lastVerified: addDays(T, -1), verifiedBy: 'Warehouse manager (portal update)',
    instructions: 'Dock 3 receiving, weekdays 8am–3pm. Pallets welcome. Weigh-in on arrival.',
    hours: 'Mon–Fri 8am–3pm', contact: { phone: '(555) 010-4100', email: 'receiving@midvalley.example', public: true },
    storage: { refrigerated: true, frozen: true, dryCapacityLbs: 6000 }, turnoverDays: 10, peopleServedWeekly: 2100,
    weeklyDistributionLbs: weeklyHistory(5200, 0.006, 0.04), weeklyBaselineSupplyLbs: 5100, currentInventoryLbs: 8200, provenance: 'sample',
  },
  {
    id: 'sh-st', name: "St. Brigid's Community Kitchen", kind: 'Community Kitchen', neighborhood: 'Eastbrook',
    location: jitter(neighborhoodCenter('Eastbrook'), 0.5), address: '88 Linden Row (fictional)',
    needs: [
      { category: 'produce', label: 'Potatoes, onions, carrots', unit: 'lbs', lbsPerUnit: 1, quantityNeeded: 180, quantityReceived: 30, deadline: addDays(T, 3) },
      { category: 'grains', label: 'Rice & pasta', unit: 'lbs', lbsPerUnit: 1, quantityNeeded: 150, quantityReceived: 40, deadline: addDays(T, 8) },
      { category: 'canned_veg', label: 'Canned tomatoes', unit: 'cans', lbsPerUnit: 1.75, quantityNeeded: 80, quantityReceived: 12, deadline: addDays(T, 8) },
    ],
    reportedSeverity: 5, inventoryDaysOnHand: 3, lastVerified: addDays(T, 0), verifiedBy: 'Kitchen coordinator (photo of shelves)',
    instructions: 'Kitchen door at rear. Fresh produce accepted until 2pm daily — we cook it the same week.',
    hours: 'Daily 7am–2pm', contact: { email: 'kitchen@stbrigid.example', public: true },
    storage: { refrigerated: true, frozen: true, dryCapacityLbs: 450 }, turnoverDays: 2, peopleServedWeekly: 380,
    weeklyDistributionLbs: weeklyHistory(410, 0.022, 0.06), weeklyBaselineSupplyLbs: 330, currentInventoryLbs: 170, provenance: 'sample',
  },
  {
    id: 'sh-north', name: 'Northgate Neighborhood Pantry', kind: 'Pantry', neighborhood: 'Northgate',
    location: jitter(neighborhoodCenter('Northgate'), 0.5), address: '15 Elm Ct (fictional)',
    needs: [
      { category: 'breakfast', label: 'Cereal', unit: 'boxes', lbsPerUnit: 1.1, quantityNeeded: 90, quantityReceived: 50, deadline: addDays(T, 14) },
      { category: 'hygiene', label: 'Hygiene kits', unit: 'packs', lbsPerUnit: 1.5, quantityNeeded: 60, quantityReceived: 25, deadline: addDays(T, 20) },
    ],
    reportedSeverity: 2, inventoryDaysOnHand: 16, lastVerified: addDays(T, -6), verifiedBy: 'Volunteer lead (email)',
    instructions: 'Saturday distribution; drop-offs Thu–Fri afternoons.',
    hours: 'Thu–Fri 1pm–6pm, Sat 9am–12pm', contact: { email: 'pantry@northgate.example', public: true },
    storage: { refrigerated: false, frozen: false, dryCapacityLbs: 500 }, turnoverDays: 7, peopleServedWeekly: 160,
    weeklyDistributionLbs: weeklyHistory(380, -0.004, 0.05), weeklyBaselineSupplyLbs: 400, currentInventoryLbs: 820, provenance: 'sample',
  },
  {
    id: 'sh-cedar', name: 'Cedar Flats Youth & Family Center', kind: 'Pantry', neighborhood: 'Cedar Flats',
    location: jitter(neighborhoodCenter('Cedar Flats'), 0.5), address: '930 Orchard Ave (fictional)',
    needs: [
      { category: 'breakfast', label: 'Kid-friendly breakfast', unit: 'boxes', lbsPerUnit: 1, quantityNeeded: 160, quantityReceived: 22, deadline: addDays(T, 7) },
      { category: 'canned_fruit', label: 'Fruit cups & applesauce', unit: 'packs', lbsPerUnit: 1.2, quantityNeeded: 120, quantityReceived: 18, deadline: addDays(T, 10) },
      { category: 'protein', label: 'Peanut butter', unit: 'units', lbsPerUnit: 1.1, quantityNeeded: 80, quantityReceived: 9, deadline: addDays(T, 10) },
      { category: 'baby', label: 'Diapers & baby food', unit: 'packs', lbsPerUnit: 2, quantityNeeded: 40, quantityReceived: 6, deadline: addDays(T, 12) },
    ],
    reportedSeverity: 4, inventoryDaysOnHand: 6, lastVerified: addDays(T, -3), verifiedBy: 'Program director (portal update)',
    instructions: 'Front desk accepts donations during open hours. Weekend backpack program needs items by Thursday.',
    hours: 'Mon–Fri 10am–7pm', contact: { phone: '(555) 010-7712', public: true },
    storage: { refrigerated: false, frozen: false, dryCapacityLbs: 650 }, turnoverDays: 5, peopleServedWeekly: 230,
    weeklyDistributionLbs: weeklyHistory(470, 0.018, 0.05), weeklyBaselineSupplyLbs: 400, currentInventoryLbs: 390, provenance: 'sample',
  },
  {
    id: 'sh-south', name: 'Southpoint Veterans Outreach', kind: 'Shelter', neighborhood: 'Southpoint',
    location: jitter(neighborhoodCenter('Southpoint'), 0.5), address: '5 Garrison Way (fictional)',
    needs: [
      { category: 'protein', label: 'Canned chili & stew', unit: 'cans', lbsPerUnit: 1, quantityNeeded: 120, quantityReceived: 40, deadline: addDays(T, 12) },
      { category: 'hygiene', label: 'Toiletries', unit: 'packs', lbsPerUnit: 1, quantityNeeded: 70, quantityReceived: 15, deadline: addDays(T, 16) },
      { category: 'canned_veg', label: 'Canned vegetables', unit: 'cans', lbsPerUnit: 0.9, quantityNeeded: 100, quantityReceived: 30, deadline: addDays(T, 16) },
    ],
    reportedSeverity: 3, inventoryDaysOnHand: 9, lastVerified: addDays(T, -19), verifiedBy: 'Case manager (email)',
    instructions: 'Ring bell at main entrance. Call ahead for deliveries over 100 lbs.',
    hours: 'Daily 8am–8pm', contact: { phone: '(555) 010-3390', public: false },
    storage: { refrigerated: false, frozen: false, dryCapacityLbs: 400 }, turnoverDays: 8, peopleServedWeekly: 65,
    weeklyDistributionLbs: weeklyHistory(260, 0.01, 0.04), weeklyBaselineSupplyLbs: 240, currentInventoryLbs: 300, provenance: 'sample',
  },
  {
    id: 'sh-willow', name: 'Willow Creek Mobile Pantry Hub', kind: 'Pantry', neighborhood: 'Willow Creek',
    location: jitter(neighborhoodCenter('Willow Creek'), 0.5), address: '77 Brookside Plaza (fictional)',
    needs: [
      { category: 'grains', label: 'Rice (bulk)', unit: 'lbs', lbsPerUnit: 1, quantityNeeded: 300, quantityReceived: 140, deadline: addDays(T, 15) },
      { category: 'produce', label: 'Shelf-stable produce (apples, squash)', unit: 'lbs', lbsPerUnit: 1, quantityNeeded: 200, quantityReceived: 60, deadline: addDays(T, 6) },
      { category: 'canned_fruit', label: 'Canned fruit', unit: 'cans', lbsPerUnit: 1, quantityNeeded: 100, quantityReceived: 50, deadline: addDays(T, 15) },
    ],
    reportedSeverity: 2, inventoryDaysOnHand: 13, lastVerified: addDays(T, -4), verifiedBy: 'Site lead (portal update)',
    instructions: 'Truck loads Tuesdays and Fridays at 8am. Bulk bags preferred over small packages.',
    hours: 'Tue & Fri 7am–1pm', contact: { email: 'mobile@willowcreek.example', public: true },
    storage: { refrigerated: true, frozen: false, dryCapacityLbs: 1500 }, turnoverDays: 4, peopleServedWeekly: 420,
    weeklyDistributionLbs: weeklyHistory(900, 0.004, 0.06), weeklyBaselineSupplyLbs: 880, currentInventoryLbs: 1300, provenance: 'sample',
  },
  {
    id: 'sh-harbor', name: 'Harbor Hill Senior Meals', kind: 'Community Kitchen', neighborhood: 'Harbor Hill',
    location: jitter(neighborhoodCenter('Harbor Hill'), 0.5), address: '301 Bayview Dr (fictional)',
    needs: [
      { category: 'canned_fruit', label: 'Low-sugar canned fruit', unit: 'cans', lbsPerUnit: 1, quantityNeeded: 90, quantityReceived: 10, deadline: addDays(T, 9) },
      { category: 'canned_veg', label: 'Low-sodium vegetables', unit: 'cans', lbsPerUnit: 0.9, quantityNeeded: 120, quantityReceived: 25, deadline: addDays(T, 9) },
      { category: 'breakfast', label: 'Oatmeal', unit: 'boxes', lbsPerUnit: 1.1, quantityNeeded: 60, quantityReceived: 12, deadline: addDays(T, 11) },
    ],
    reportedSeverity: 3, inventoryDaysOnHand: 7, lastVerified: addDays(T, -5), verifiedBy: 'Meals coordinator (phone check)',
    instructions: 'Low-sodium and low-sugar items strongly preferred for our senior clients.',
    hours: 'Mon–Fri 9am–1pm', contact: { phone: '(555) 010-8845', email: 'meals@harborhill.example', public: true },
    storage: { refrigerated: true, frozen: false, dryCapacityLbs: 350 }, turnoverDays: 5, peopleServedWeekly: 190,
    weeklyDistributionLbs: weeklyHistory(300, 0.015, 0.03), weeklyBaselineSupplyLbs: 280, currentInventoryLbs: 360, provenance: 'sample',
  },
  {
    id: 'sh-west', name: 'Westfield Campus Food Closet', kind: 'Pantry', neighborhood: 'Westfield',
    location: jitter(neighborhoodCenter('Westfield'), 0.4), address: 'Student Union, Room 12 (fictional)',
    needs: [
      { category: 'grains', label: 'Instant meals & ramen', unit: 'packs', lbsPerUnit: 0.5, quantityNeeded: 200, quantityReceived: 70, deadline: addDays(T, 13) },
      { category: 'protein', label: 'Canned tuna', unit: 'cans', lbsPerUnit: 0.4, quantityNeeded: 150, quantityReceived: 40, deadline: addDays(T, 13) },
    ],
    reportedSeverity: 2, inventoryDaysOnHand: 12, lastVerified: addDays(T, -9), verifiedBy: 'Student services (email)',
    instructions: 'Single-serving items preferred. Drop off at the info desk.',
    hours: 'Mon–Thu 11am–4pm', contact: { email: 'foodcloset@westfield.example', public: true },
    storage: { refrigerated: false, frozen: false, dryCapacityLbs: 250 }, turnoverDays: 9, peopleServedWeekly: 110,
    weeklyDistributionLbs: weeklyHistory(150, 0.008, 0.08), weeklyBaselineSupplyLbs: 150, currentInventoryLbs: 260, provenance: 'sample',
  },
  {
    id: 'sh-maple', name: 'Maple Heights Women & Children Shelter', kind: 'Shelter', neighborhood: 'Maple Heights',
    location: jitter(neighborhoodCenter('Maple Heights'), 0.5), address: 'Address withheld for safety',
    needs: [
      { category: 'baby', label: 'Formula & baby food', unit: 'units', lbsPerUnit: 1.4, quantityNeeded: 60, quantityReceived: 8, deadline: addDays(T, 5) },
      { category: 'hygiene', label: 'Diapers (sizes 3–5)', unit: 'packs', lbsPerUnit: 3, quantityNeeded: 40, quantityReceived: 10, deadline: addDays(T, 7) },
      { category: 'breakfast', label: 'Breakfast items', unit: 'boxes', lbsPerUnit: 1, quantityNeeded: 70, quantityReceived: 20, deadline: addDays(T, 10) },
    ],
    reportedSeverity: 4, inventoryDaysOnHand: 4, lastVerified: addDays(T, -1), verifiedBy: 'Shelter director (portal update)',
    instructions: 'For resident safety, donations go through Mid-Valley Food Bank Dock 3 marked "MH-WCS". Address is never published.',
    hours: 'Via partner drop-off', contact: { public: false },
    storage: { refrigerated: true, frozen: false, dryCapacityLbs: 400 }, turnoverDays: 5, peopleServedWeekly: 75,
    weeklyDistributionLbs: weeklyHistory(210, 0.02, 0.04), weeklyBaselineSupplyLbs: 180, currentInventoryLbs: 140, provenance: 'sample',
  },
];

/** The three partner organizations shown in the app: one of each kind. */
const SHOWN_SHELTERS = ['sh-hope', 'sh-mid', 'sh-st'];
export const SHELTERS: Shelter[] = ALL_SHELTERS.filter((x) => SHOWN_SHELTERS.includes(x.id));

// Current shelf stock by food type (lbs). Sums to each shelter's currentInventoryLbs.
const STOCK: Record<string, Partial<Record<FoodCategory, number>>> = {
  'sh-hope': { grains: 150, protein: 80, canned_veg: 140, canned_fruit: 110, breakfast: 90, baby: 20, hygiene: 50 },
  'sh-mid': { grains: 2100, protein: 1300, canned_veg: 1800, canned_fruit: 900, breakfast: 1100, baby: 200, hygiene: 300, produce: 500 },
  'sh-st': { grains: 40, protein: 35, canned_veg: 30, produce: 45, breakfast: 20 },
};
for (const sh of SHELTERS) sh.stockByCategory = STOCK[sh.id];

// ── Historical, active and upcoming drives ─────────────────────────────────
function nearestShelters(loc: LatLng, n: number): string[] {
  return [...SHELTERS]
    .sort((a, b) => haversineMiles(loc, a.location) - haversineMiles(loc, b.location))
    .slice(0, n)
    .map((s) => s.id);
}

function generateCompleted(): FoodDrive[] {
  const drives: FoodDrive[] = [];
  // Months weighted toward the fall/holiday season, like real drive calendars.
  const monthPool = [0, 1, 2, 3, 3, 4, 5, 7, 8, 8, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11];
  for (let i = 0; i < 46; i++) {
    const org = ORGS[i % ORGS.length];
    const yearsBack = 2 - Math.floor(i / 16); // spread over ~3 years
    const month = pick(monthPool);
    const now = new Date();
    let year = now.getFullYear() - yearsBack;
    if (year === now.getFullYear() && month >= now.getMonth()) year -= 1;
    const start = `${year}-${String(month + 1).padStart(2, '0')}-${String(int(2, 24)).padStart(2, '0')}`;
    const durationDays = pick([1, 1, 2, 3, 5, 5, 7, 7, 10, 14]);
    const participants = int(org.participants[0], org.participants[1]);
    const type = driveTypeFor(org, month);
    const cats = acceptedFor(type);
    const expected = trueExpectedLbs(org, participants, durationDays, month, cats.length);
    const collected = Math.round(expected * Math.exp(gauss() * TRUE_NOISE_SIGMA));
    const loc = jitter(neighborhoodCenter(org.hood), 1.8);
    const volunteers = Math.max(4, Math.round(collected / 140 + participants / 70 + gauss() * 2));
    const id = `dr-${String(i + 1).padStart(3, '0')}`;
    drives.push({
      id,
      name: `${org.name.replace(/ (High|Middle) School| Elementary| Academy/, '')} ${SEASON_NAMES[month]} Food Drive ${year}`,
      organization: org.name,
      orgType: org.type,
      driveType: type,
      status: 'completed',
      location: loc,
      address: `${org.hood} (approximate)`,
      neighborhood: org.hood,
      startDate: start,
      durationDays,
      expectedParticipants: participants,
      actualParticipants: Math.round(participants * between(0.85, 1.12)),
      acceptedCategories: cats,
      goalLbs: Math.round((expected * between(0.8, 1.3)) / 50) * 50,
      collectedLbs: collected,
      collectedByCategory: splitByCategory(collected, cats),
      dailyLog: cumulativeLog(start, durationDays, collected),
      volunteers,
      volunteerHours: Math.round(volunteers * between(3, 5.5) * Math.sqrt(durationDays)),
      sheltersSupported: nearestShelters(loc, int(1, 3)),
      shifts: [],
      description: `A ${durationDays}-day community collection organized by ${org.name}.`,
      provenance: 'sample',
    });
  }
  return drives.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function lot(id: string, category: FoodCategory, lbs: number, expiresInDays: number, note?: string): InventoryLot {
  const perishable = CATEGORIES.find((c) => c.id === category)!.perishable;
  return { id, category, lbs, perishable, expiresOn: addDays(T, expiresInDays), note };
}

function generateActiveAndUpcoming(): FoodDrive[] {
  const out: FoodDrive[] = [];
  const mk = (
    id: string,
    orgIdx: number,
    name: string,
    startOffset: number,
    durationDays: number,
    participants: number,
    goal: number,
    type: DriveType,
    cats: FoodCategory[],
    description: string,
  ): FoodDrive => {
    const org = ORGS[orgIdx];
    const loc = jitter(neighborhoodCenter(org.hood), 0.4);
    const start = addDays(T, startOffset);
    return {
      id, name, organization: org.name, orgType: org.type, driveType: type,
      status: startOffset > 0 ? 'upcoming' : 'active',
      location: loc, address: `${org.hood} (fictional address)`, neighborhood: org.hood,
      startDate: start, durationDays, expectedParticipants: participants, acceptedCategories: cats, goalLbs: goal,
      shifts: makeShifts(id, start, durationDays, Math.sqrt(participants / 250)),
      description, provenance: 'sample',
    };
  };

  const active1 = mk('dr-a01', 0, 'Maple Heights Fall Harvest Drive', -4, 7, 640, 2600, 'school_challenge',
    ['grains', 'protein', 'canned_veg', 'canned_fruit', 'breakfast', 'baby', 'produce'],
    'Homerooms compete to fill the Harvest Wall. Fresh produce accepted on Friday only, through our partnership with a local orchard.');
  active1.dailyLog = cumulativeLog(active1.startDate, 7, 2950, 5);
  active1.collectedLbs = active1.dailyLog[active1.dailyLog.length - 1].lbs;
  active1.collectedByCategory = splitByCategory(active1.collectedLbs, active1.acceptedCategories);
  active1.volunteers = 22;
  active1.volunteerHours = 96;
  active1.inventory = [
    lot('l1', 'produce', 140, 4, 'Apples & squash from orchard partner'),
    lot('l2', 'grains', 360, 400),
    lot('l3', 'protein', 290, 380),
    lot('l4', 'canned_veg', 250, 520),
    lot('l5', 'breakfast', 190, 9, 'Cereal boxes with near-term best-by dates'),
    lot('l6', 'baby', 60, 45, 'Infant formula'),
  ];

  const active2 = mk('dr-a02', 5, 'Old Mill Neighbors Pantry Restock', -2, 5, 260, 1100, 'canned_goods',
    ['grains', 'protein', 'canned_veg', 'canned_fruit', 'hygiene'],
    'Porch pickup across Old Mill plus a staffed drop-off tent at the farmers market.');
  active2.dailyLog = cumulativeLog(active2.startDate, 5, 1150, 3);
  active2.collectedLbs = active2.dailyLog[active2.dailyLog.length - 1].lbs;
  active2.collectedByCategory = splitByCategory(active2.collectedLbs, active2.acceptedCategories);
  active2.volunteers = 11;
  active2.volunteerHours = 38;
  active2.inventory = [lot('l7', 'canned_fruit', 70, 6, 'Dented cans — inspect and use soon'), lot('l8', 'grains', 180, 300)];

  const active3 = mk('dr-a03', 12, 'Riverside NHS Breakfast Boost', -1, 3, 90, 300, 'school_challenge',
    ['breakfast', 'canned_fruit', 'protein'],
    'Breakfast items for the Cedar Flats weekend backpack program.');
  active3.dailyLog = cumulativeLog(active3.startDate, 3, 290, 2);
  active3.collectedLbs = active3.dailyLog[active3.dailyLog.length - 1].lbs;
  active3.collectedByCategory = splitByCategory(active3.collectedLbs, active3.acceptedCategories);
  active3.volunteers = 6;
  active3.volunteerHours = 14;

  out.push(active1, active2, active3);
  out.push(
    mk('dr-u01', 3, 'Eastbrook Thanksgiving Can-Do Drive', 9, 10, 720, 3200, 'holiday',
      ['grains', 'protein', 'canned_veg', 'canned_fruit', 'breakfast', 'hygiene'],
      'Our biggest drive of the year. Every advisory class adopts a family meal kit.'),
    mk('dr-u02', 7, 'Northgate Church Holiday Pantry', 16, 3, 210, 1200, 'holiday',
      ['grains', 'protein', 'canned_veg', 'canned_fruit', 'breakfast', 'baby'],
      'Three-day collection after weekend services, plus a Sunday packing party.'),
    mk('dr-u03', 9, 'Westfield Credit Union Food-for-Fines', 5, 14, 160, 700, 'canned_goods',
      ['grains', 'protein', 'canned_veg', 'canned_fruit'],
      'Members can bring canned goods to waive fees. Collection bins in every branch lobby.'),
    mk('dr-u04', 1, 'Cedar Flats Middle Fill-the-Bus', 23, 2, 380, 900, 'school_challenge',
      ['breakfast', 'canned_fruit', 'protein', 'grains'],
      'Fill a school bus in the parking lot — kid-friendly breakfast items requested by the Youth & Family Center.'),
    mk('dr-u05', 6, 'Open Table Fresh Food Saturday', 12, 1, 140, 650, 'fresh_food',
      ['produce', 'grains', 'protein'],
      'A one-day fresh food rescue with local grocers, delivered same day to community kitchens.'),
  );
  return out;
}

/** Current drives shown in the app. Completed drives are the model's training history. */
const SHOWN_CURRENT = ['dr-a01', 'dr-u01'];
export const DRIVES: FoodDrive[] = [...generateCompleted(), ...generateActiveAndUpcoming().filter((d) => SHOWN_CURRENT.includes(d.id))];

// Some completed drives get a short organizer note on impact.
export const IMPACT_NOTES: Record<string, string> = {};
DRIVES.filter((d) => d.status === 'completed').forEach((d, i) => {
  if (i % 3 === 0) IMPACT_NOTES[d.id] = 'Shelter partners reported the delivery covered their weekend distribution.';
});

export const DEMO_USER: UserProfile = {
  id: 'u-1',
  name: 'Jordan Rivera',
  role: 'Organizer',
  school: 'Maple Heights High School',
  home: neighborhoodCenter('Maple Heights'),
  joined: addDays(T, -420),
  signedUpShiftIds: [],
  organizedDriveIds: ['dr-a01'],
  hoursLogged: 31,
  lbsDonated: 64,
};
