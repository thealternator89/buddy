export const APP_CONFIG = {
  currency: {
    code: 'NZD',
    symbol: '$',
    locale: 'en-NZ',
  },
  accountTypes: [
    { value: 'checking', label: 'Everyday / Checking' },
    { value: 'savings', label: 'Savings' },
    { value: 'credit', label: 'Credit Card' },
    { value: 'cash', label: 'Cash / Wallet' },
    { value: 'other', label: 'Other' },
  ] as const,
};

export type AccountType = (typeof APP_CONFIG.accountTypes)[number]['value'];
