// Food Waste Prevention: flag lots near expiration and suggest who can use them in time.
// A shelter qualifies if it requested the category (or is a community kitchen,
// which cooks with anything), can store it (refrigeration for perishables), and
// distributes faster than the food expires.

import type { FoodDrive, InventoryLot, Shelter } from './types';
import { daysFromToday } from './dates';
import { haversineMiles } from './geo';

export const EXPIRY_ALERT_DAYS = 10;

export interface WasteAlert {
  drive: FoodDrive;
  lot: InventoryLot;
  daysLeft: number;
  severity: 'urgent' | 'soon';
  recipients: { shelter: Shelter; miles: number; why: string }[];
}

export function wasteAlerts(drives: FoodDrive[], shelters: Shelter[]): WasteAlert[] {
  const alerts: WasteAlert[] = [];
  for (const d of drives) {
    if (d.status === 'upcoming') continue;
    for (const lot of d.inventory ?? []) {
      const daysLeft = daysFromToday(lot.expiresOn);
      if (daysLeft > EXPIRY_ALERT_DAYS) continue;
      const recipients = shelters
        .filter((s) => (!lot.perishable || s.storage.refrigerated) && s.turnoverDays < daysLeft)
        .filter((s) => s.kind === 'Community Kitchen' || s.needs.some((n) => n.category === lot.category && n.quantityReceived < n.quantityNeeded))
        .map((s) => ({
          shelter: s,
          miles: haversineMiles(d.location, s.location),
          why: `${s.kind === 'Community Kitchen' ? 'Cooks donated food' : 'Requested this category'}; distributes within ${s.turnoverDays} day${s.turnoverDays > 1 ? 's' : ''}${lot.perishable ? '; refrigerated' : ''}`,
        }))
        .sort((a, b) => a.shelter.turnoverDays - b.shelter.turnoverDays || a.miles - b.miles)
        .slice(0, 3);
      alerts.push({ drive: d, lot, daysLeft, severity: daysLeft <= 5 ? 'urgent' : 'soon', recipients });
    }
  }
  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}
