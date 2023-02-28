import { TIME_SCALE } from '../enums/TIME_SCALE';
export interface ServiceModel {
  timeScale: TIME_SCALE;

  range: [number, number];

  acceptedAt: Date;
  canceledAt: Date;

  value: string;
  archives: string[];
}
