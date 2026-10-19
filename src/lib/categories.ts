import type { FoodCategory } from './types';

export interface CategoryMeta {
  id: FoodCategory;
  label: string;
  short: string;
  /** Fixed categorical color — the category always keeps this color, on every chart. */
  color: string;
  perishable: boolean;
  /** Typical share of a general food drive (by weight), used as a prior. */
  priorShare: number;
  example: string;
}

// Order is fixed and validated for color-vision-deficiency separation
// (see docs/DESIGN_SYSTEM.md). Never cycle or re-assign these colors.
export const CATEGORIES: CategoryMeta[] = [
  { id: 'grains', label: 'Rice, pasta & grains', short: 'Grains', color: '#1f8a52', perishable: false, priorShare: 0.22, example: 'Rice, pasta, oats' },
  { id: 'protein', label: 'Protein', short: 'Protein', color: '#6d5bd0', perishable: false, priorShare: 0.2, example: 'Canned tuna, beans, peanut butter' },
  { id: 'canned_veg', label: 'Canned vegetables', short: 'Veg', color: '#e3a008', perishable: false, priorShare: 0.18, example: 'Green beans, corn, tomatoes' },
  { id: 'canned_fruit', label: 'Canned fruit', short: 'Fruit', color: '#2a78d6', perishable: false, priorShare: 0.1, example: 'Peaches, applesauce' },
  { id: 'breakfast', label: 'Breakfast & cereal', short: 'Breakfast', color: '#e0663f', perishable: false, priorShare: 0.12, example: 'Cereal, oatmeal' },
  { id: 'baby', label: 'Baby & infant', short: 'Baby', color: '#0f9aa3', perishable: false, priorShare: 0.05, example: 'Formula, baby food' },
  { id: 'hygiene', label: 'Hygiene & essentials', short: 'Hygiene', color: '#9c5a1c', perishable: false, priorShare: 0.06, example: 'Soap, diapers, toothpaste' },
  { id: 'produce', label: 'Fresh produce', short: 'Produce', color: '#d65a8f', perishable: true, priorShare: 0.07, example: 'Apples, potatoes, carrots' },
];

export const CATEGORY_BY_ID: Record<FoodCategory, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<FoodCategory, CategoryMeta>;

/** Common planning conversion used by U.S. food banks (Feeding America): 1.2 lb ≈ 1 meal. */
export const LBS_PER_MEAL = 1.2;
