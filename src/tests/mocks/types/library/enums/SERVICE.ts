export const SERVICE = ['contract', 'wildcard'] as const;
export type SERVICE = (typeof SERVICE)[number];
