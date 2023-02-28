export const WORKER_STATUS = ['working', 'free', 'fired'] as const;
export type WORKER_STATUS = (typeof WORKER_STATUS)[number];
