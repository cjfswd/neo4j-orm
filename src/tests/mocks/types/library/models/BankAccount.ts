const BANK_ACCOUNT = ['CHECKING', 'SAVING', 'SALARY'] as const;
type BANK_ACCOUNT = (typeof BANK_ACCOUNT)[number];

export interface BankAccountModel {
  name: string;
  type: BANK_ACCOUNT;
  agency: string;
  account: string;
  digit: string;
}
