import type { ReactNode } from 'react';
import { BarChart3, GitCompareArrows, HeartHandshake, MapPinned } from 'lucide-react';

// One accent per feature, so each part of the app has its own look.
// Used by the nav, the Home feature cards and each page header.
export interface Feature {
  id: 'plan' | 'drives' | 'shelters' | 'match';
  to: string;
  label: string;
  title: string;
  icon: ReactNode;
  color: string; // strong accent (text, active nav, buttons)
  tint: string; // soft background
  border: string;
  /** One plain sentence for the Home page. */
  short: string;
  summary: string;
  points: string[];
}

export const FEATURES: Feature[] = [
  {
    id: 'plan',
    to: '/plan',
    label: 'Plan',
    title: 'Plan a drive',
    icon: <BarChart3 size={20} />,
    color: '#145536',
    tint: '#EEF6F1',
    border: '#D5EADD',
    short: 'See how much food your drive will collect before it starts.',
    summary: 'Predict how much food your drive will collect before it starts, with an honest range instead of a guess.',
    points: ['Pounds collected (80% range)', 'Volunteers, boxes, storage, vehicles', 'Learns from every finished drive'],
  },
  {
    id: 'drives',
    to: '/drives',
    label: 'Drives',
    title: 'Track drives',
    icon: <MapPinned size={20} />,
    color: '#1F5FAD',
    tint: '#EEF4FC',
    border: '#D3E3F7',
    short: "Log donations and watch your drive's progress.",
    summary: 'See local drives on a map, log donations as they arrive, and watch progress against the forecast.',
    points: ['Live progress vs. forecast', 'Inventory by food type', 'Close out a drive to retrain the model'],
  },
  {
    id: 'shelters',
    to: '/shelters',
    label: 'Shelters',
    title: 'Shelter needs',
    icon: <HeartHandshake size={20} />,
    color: '#B4462A',
    tint: '#FDF0EC',
    border: '#FAD9CF',
    short: 'See what local shelters need, and who needs it most.',
    summary: 'Partners post exactly what they need. A transparent urgency score shows who needs help first, and why.',
    points: ['Verified requests', 'Inventory gauge: days of food left', 'Urgency score you can check yourself'],
  },
  {
    id: 'match',
    to: '/match',
    label: 'Match',
    title: 'Match donations',
    icon: <GitCompareArrows size={20} />,
    color: '#5240B8',
    tint: '#F1EEFB',
    border: '#DCD6F5',
    short: 'Split your food between shelters, fairly and with reasons.',
    summary: "Split a drive's food across shelters based on what they asked for, urgency, and distance, with every choice explained.",
    points: ['Fills real requests first', 'Respects storage & expiration', 'Organizers can adjust anything'],
  },
];

export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<Feature['id'], Feature>;
