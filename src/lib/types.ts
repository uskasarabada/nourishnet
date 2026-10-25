// Core domain types for NourishNet.
// Every record carries a `provenance` so the UI can always tell real, verified
// numbers apart from sample or estimated ones.

export type Provenance = 'verified' | 'self-reported' | 'estimated' | 'sample';

export type FoodCategory =
  | 'grains'
  | 'protein'
  | 'canned_veg'
  | 'canned_fruit'
  | 'breakfast'
  | 'baby'
  | 'hygiene'
  | 'produce';

export type DriveStatus = 'completed' | 'active' | 'upcoming';
export type OrgType = 'school' | 'nonprofit' | 'faith' | 'business' | 'student_group';
export type DriveType = 'canned_goods' | 'holiday' | 'school_challenge' | 'mobile_pantry' | 'fresh_food';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface VolunteerShift {
  id: string;
  role: 'Collection' | 'Sorting' | 'Greeter' | 'Driver' | 'Setup';
  date: string; // ISO date
  start: string; // "09:00"
  end: string; // "12:00"
  slots: number;
  filled: number;
}

/** A batch of donated food with a known (or estimated) expiration date. */
export interface InventoryLot {
  id: string;
  category: FoodCategory;
  lbs: number;
  perishable: boolean;
  expiresOn: string; // ISO date
  note?: string;
}

export interface FoodDrive {
  id: string;
  name: string;
  organization: string;
  orgType: OrgType;
  driveType: DriveType;
  status: DriveStatus;
  location: LatLng;
  address: string;
  neighborhood: string;
  startDate: string; // ISO date
  durationDays: number;
  expectedParticipants: number;
  actualParticipants?: number;
  acceptedCategories: FoodCategory[];
  goalLbs: number;
  /** Prediction stored when the drive was created, so we can score accuracy later. */
  predictedLbs?: number;
  predictedLow?: number;
  predictedHigh?: number;
  /** Final collected weight (completed) or running total (active). */
  collectedLbs?: number;
  collectedByCategory?: Partial<Record<FoodCategory, number>>;
  /** Cumulative pounds by day, for active/completed drives. */
  dailyLog?: { day: string; lbs: number }[];
  volunteers?: number;
  volunteerHours?: number;
  sheltersSupported?: string[];
  shifts: VolunteerShift[];
  inventory?: InventoryLot[];
  description: string;
  provenance: Provenance;
}

export interface ShelterNeed {
  category: FoodCategory;
  label: string; // "Rice", "Canned vegetables"
  unit: 'lbs' | 'cans' | 'units' | 'boxes' | 'packs';
  lbsPerUnit: number;
  quantityNeeded: number;
  quantityReceived: number;
  deadline: string; // ISO date
}

export interface Shelter {
  id: string;
  name: string;
  kind: 'Shelter' | 'Food Bank' | 'Pantry' | 'Community Kitchen';
  location: LatLng;
  address: string;
  neighborhood: string;
  needs: ShelterNeed[];
  /** 1 (minor) – 5 (critical), reported by the organization. */
  reportedSeverity: 1 | 2 | 3 | 4 | 5;
  /** Days the current inventory would last at the normal distribution rate. */
  inventoryDaysOnHand: number;
  lastVerified: string; // ISO date
  verifiedBy: string;
  instructions: string;
  hours: string;
  contact: { phone?: string; email?: string; public: boolean };
  storage: { refrigerated: boolean; frozen: boolean; dryCapacityLbs: number };
  /** Typical number of days before donated food is distributed. */
  turnoverDays: number;
  peopleServedWeekly: number;
  /** Pounds distributed per week, oldest first (for need forecasting). */
  weeklyDistributionLbs: number[];
  /** Pounds expected to arrive per week from regular suppliers. */
  weeklyBaselineSupplyLbs: number;
  currentInventoryLbs: number;
  /** Current shelf stock by food type, in lbs. */
  stockByCategory?: Partial<Record<FoodCategory, number>>;
  provenance: Provenance;
}

export interface UserProfile {
  id: string;
  name: string;
  role: 'Volunteer' | 'Organizer' | 'Shelter Staff';
  school: string;
  home: LatLng;
  joined: string;
  signedUpShiftIds: string[];
  organizedDriveIds: string[];
  hoursLogged: number;
  lbsDonated: number;
}
