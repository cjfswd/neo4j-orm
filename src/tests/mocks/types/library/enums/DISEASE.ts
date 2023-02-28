export const DISEASE = [
  'elderly',
  'wheelchair',
  'bed',
  'glucose',
  'high_pressure',
  'parkison',
  'alzheimer',
  'dementia',
  'colostomy',
  'aids',
  'tracheostomy',
  'gastrostomy',
] as const;
export type DISEASE = (typeof DISEASE)[number];
