import { WORKER_STATUS } from '../enums/WORKER_STATUS';
export interface WorkerModel {
  pis: string;
  dependents: number;
  workerStatus: WORKER_STATUS;
}
