import { CONTACT } from '../enums/_enums.module';

export interface ContactModel {
  type: CONTACT;
  data: string;
  observation?: string;
}
