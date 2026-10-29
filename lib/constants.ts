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

export const SESSION_COOKIE_NAME = 'buddy_session';
export const TIMEZONE_COOKIE_NAME = 'buddy_tz';

export type AccountType = (typeof APP_CONFIG.accountTypes)[number]['value'];

export const ACCOUNT_ICONS = [
  { id: 'wallet', label: 'Wallet' },
  { id: 'landmark', label: 'Bank / Institution' },
  { id: 'piggy-bank', label: 'Piggy Bank / Savings' },
  { id: 'credit-card', label: 'Credit Card' },
  { id: 'banknote', label: 'Cash / Banknote' },
  { id: 'coins', label: 'Coins' },
  { id: 'trending-up', label: 'Investments / Stocks' },
  { id: 'briefcase', label: 'Business / Work' },
  { id: 'shield-check', label: 'Emergency / Safety' },
  { id: 'building-2', label: 'Real Estate / Property' },
  { id: 'home', label: 'Home / Mortgage' },
  { id: 'car', label: 'Vehicle / Transport' },
  { id: 'plane', label: 'Travel / Holiday' },
  { id: 'shopping-bag', label: 'Shopping / Retail' },
  { id: 'gift', label: 'Gift / Fun' },
  { id: 'receipt', label: 'Bills / Utilities' },
] as const;

export type AccountIconId = (typeof ACCOUNT_ICONS)[number]['id'];
