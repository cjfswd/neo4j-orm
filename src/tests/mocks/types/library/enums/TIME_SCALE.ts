export const TIME_SCALE = [
  '24',
  '24x24',
  '24x48',
  '12x36',
  '48x48',
  'weekday',
  'weekend',
] as const;
export type TIME_SCALE = (typeof TIME_SCALE)[number];
