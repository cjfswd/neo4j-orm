export const ADMINISTRATIVE_LEVEL = ['read', 'update', 'delete'] as const;
export type ADMINISTRATIVE_LEVEL = (typeof ADMINISTRATIVE_LEVEL)[number];
