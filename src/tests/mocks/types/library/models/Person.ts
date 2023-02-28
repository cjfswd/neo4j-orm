import { SEX } from '../enums/SEX';
import { CIVIL_STATUS } from '../enums/CIVIL_STATUS';

export interface PersonModel {
  name: string;

  birthDate: Date;
  sex: SEX;
  civilStatus: CIVIL_STATUS;

  photo: string;
  archive: string;
}
