export const WEIGHT = [
  'rickety',
  'skinny',
  'normal',
  'strong',
  'obese',
] as const;
export type WEIGHT = (typeof WEIGHT)[number];
