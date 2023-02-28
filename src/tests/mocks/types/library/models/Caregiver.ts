import { TIME_SCALE, DISEASE } from '../enums/_enums.module';

export interface CaregiverModel {
  availableTimeScale: TIME_SCALE[];
  diseaseExperience: DISEASE[];
}
