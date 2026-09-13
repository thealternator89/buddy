import { icons, LucideIcon } from 'lucide-react';

export interface IconCategory {
  id: string;
  label: string;
  emoji: string;
  icons: string[];
}

export const POPULAR_ICON_NAMES: string[] = [
  'Wallet',
  'Landmark',
  'PiggyBank',
  'CreditCard',
  'Banknote',
  'Coins',
  'TrendingUp',
  'Briefcase',
  'ShieldCheck',
  'Building2',
  'House',
  'Car',
  'Plane',
  'ShoppingBag',
  'Gift',
  'Receipt',
  'Dog',
  'Cat',
  'Heart',
  'Coffee',
  'Smartphone',
  'Laptop',
  'Dumbbell',
  'GraduationCap',
];

export const ICON_CATEGORIES: IconCategory[] = [
  {
    id: 'popular',
    label: 'Popular',
    emoji: '⭐',
    icons: POPULAR_ICON_NAMES,
  },
  {
    id: 'finance',
    label: 'Finance',
    emoji: '💰',
    icons: [
      'Wallet',
      'Landmark',
      'PiggyBank',
      'CreditCard',
      'Banknote',
      'Coins',
      'TrendingUp',
      'TrendingDown',
      'Receipt',
      'CircleDollarSign',
      'HandCoins',
      'Vault',
      'BadgePercent',
      'Scale',
      'CirclePercent',
    ],
  },
  {
    id: 'pets',
    label: 'Animals & Pets',
    emoji: '🐕',
    icons: [
      'Dog',
      'Cat',
      'Fish',
      'PawPrint',
      'Rabbit',
      'Turtle',
      'Bird',
      'Bug',
      'Snail',
      'Bone',
      'Feather',
    ],
  },
  {
    id: 'home',
    label: 'Home & Property',
    emoji: '🏠',
    icons: [
      'House',
      'Building',
      'Building2',
      'Warehouse',
      'DoorOpen',
      'Bed',
      'Bath',
      'Sofa',
      'Lamp',
      'Key',
      'Lock',
      'ShieldCheck',
    ],
  },
  {
    id: 'vehicles',
    label: 'Vehicles & Travel',
    emoji: '🚗',
    icons: [
      'Car',
      'CarFront',
      'Bike',
      'Bus',
      'TrainFront',
      'Ship',
      'Plane',
      'Rocket',
      'Fuel',
      'Truck',
      'TreePalm',
      'Luggage',
      'MapPin',
      'Compass',
      'Tent',
      'Globe',
      'Ticket',
      'Camera',
    ],
  },
  {
    id: 'shopping',
    label: 'Shopping & Retail',
    emoji: '🛍️',
    icons: [
      'ShoppingCart',
      'ShoppingBag',
      'Store',
      'Tag',
      'Gift',
      'Package',
      'Sparkles',
      'Shirt',
      'Watch',
      'Gem',
    ],
  },
  {
    id: 'food',
    label: 'Food & Dining',
    emoji: '🍔',
    icons: [
      'Coffee',
      'Utensils',
      'Beer',
      'Wine',
      'Pizza',
      'Apple',
      'Cake',
      'CupSoda',
      'Sandwich',
      'Soup',
      'CookingPot',
    ],
  },
  {
    id: 'health',
    label: 'Health & Fitness',
    emoji: '❤️',
    icons: [
      'Heart',
      'Activity',
      'Dumbbell',
      'Stethoscope',
      'Pill',
      'Footprints',
      'Syringe',
      'Trophy',
      'Medal',
    ],
  },
  {
    id: 'tech',
    label: 'Tech & Media',
    emoji: '💻',
    icons: [
      'Laptop',
      'Smartphone',
      'Tablet',
      'Tv',
      'Headphones',
      'Gamepad2',
      'Music',
      'Wifi',
      'Cpu',
    ],
  },
  {
    id: 'work',
    label: 'Work & Education',
    emoji: '💼',
    icons: [
      'Briefcase',
      'GraduationCap',
      'Book',
      'Folder',
      'FileText',
      'Calculator',
      'Lightbulb',
      'Hammer',
      'Wrench',
    ],
  },
  {
    id: 'all',
    label: 'All Icons',
    emoji: '🌐',
    icons: [],
  },
];

export const ALL_ICON_NAMES: string[] = Object.keys(icons).sort();

export const ICON_SYNONYMS: Record<string, string[]> = {
  pet: ['Dog', 'Cat', 'Fish', 'PawPrint', 'Rabbit', 'Turtle', 'Bird', 'Bone', 'Feather'],
  pets: ['Dog', 'Cat', 'Fish', 'PawPrint', 'Rabbit', 'Turtle', 'Bird', 'Bone', 'Feather'],
  animal: ['Dog', 'Cat', 'Fish', 'PawPrint', 'Rabbit', 'Turtle', 'Bird', 'Bug', 'Snail'],
  animals: ['Dog', 'Cat', 'Fish', 'PawPrint', 'Rabbit', 'Turtle', 'Bird', 'Bug', 'Snail'],
  dog: ['Dog', 'PawPrint', 'Bone'],
  puppy: ['Dog', 'PawPrint', 'Bone'],
  canine: ['Dog', 'PawPrint'],
  cat: ['Cat', 'PawPrint'],
  kitten: ['Cat', 'PawPrint'],
  feline: ['Cat', 'PawPrint'],
  money: ['Banknote', 'Coins', 'CircleDollarSign', 'HandCoins', 'Wallet', 'CreditCard', 'PiggyBank', 'Vault'],
  cash: ['Banknote', 'Coins', 'Wallet', 'CircleDollarSign'],
  bank: ['Landmark', 'Vault', 'PiggyBank', 'Building2'],
  savings: ['PiggyBank', 'Vault', 'TrendingUp', 'Coins'],
  credit: ['CreditCard', 'Wallet', 'Receipt'],
  card: ['CreditCard', 'Wallet'],
  crypto: ['Bitcoin', 'Coins', 'CircleDollarSign'],
  bitcoin: ['Bitcoin', 'Coins', 'CircleDollarSign'],
  car: ['Car', 'CarFront', 'CarTaxiFront', 'Truck', 'Bus', 'Fuel'],
  auto: ['Car', 'CarFront', 'Fuel', 'Wrench'],
  vehicle: ['Car', 'Bike', 'Bus', 'TrainFront', 'Ship', 'Plane', 'Truck'],
  travel: ['Plane', 'Luggage', 'TreePalm', 'MapPin', 'Compass', 'Tent', 'Globe', 'Ticket'],
  vacation: ['TreePalm', 'Luggage', 'Plane', 'Sun', 'Tent', 'Camera'],
  holiday: ['TreePalm', 'Gift', 'Plane', 'Luggage', 'PartyPopper', 'Sparkles'],
  home: ['House', 'Building', 'Building2', 'Key', 'Lock', 'Sofa', 'Bed'],
  house: ['House', 'Building', 'Building2', 'Key', 'DoorOpen'],
  rent: ['House', 'Key', 'Receipt', 'Building'],
  mortgage: ['House', 'Landmark', 'FileText', 'Key'],
  food: ['Utensils', 'Coffee', 'Pizza', 'Apple', 'Cake', 'CupSoda', 'Sandwich', 'Beer'],
  dining: ['Utensils', 'Wine', 'Beer', 'Pizza', 'Coffee'],
  groceries: ['ShoppingCart', 'ShoppingBag', 'Apple', 'Store'],
  coffee: ['Coffee', 'CupSoda'],
  health: ['Heart', 'Activity', 'Stethoscope', 'Pill', 'Syringe'],
  fitness: ['Dumbbell', 'Activity', 'Heart', 'Trophy', 'Footprints'],
  gym: ['Dumbbell', 'Activity', 'Trophy', 'Flame'],
  tech: ['Laptop', 'Smartphone', 'Tablet', 'Tv', 'Headphones', 'Cpu'],
  education: ['GraduationCap', 'Book', 'FileText', 'Lightbulb'],
  school: ['GraduationCap', 'Book', 'School', 'Backpack'],
  kids: ['Baby', 'SmilePlus', 'Heart', 'Footprints'],
  baby: ['Baby', 'Heart', 'Footprints'],
  salary: ['Banknote', 'HandCoins', 'CircleDollarSign', 'Briefcase'],
  bills: ['Receipt', 'FileText', 'Zap', 'Flame', 'Droplets'],
  utilities: ['Zap', 'Flame', 'Droplets', 'Wifi'],
  emergency: ['ShieldCheck', 'TriangleAlert', 'Siren', 'Flame', 'LifeBuoy'],
};

const ICON_ALIASES: Record<string, string> = {
  home: 'House',
  bank: 'Landmark',
  money: 'Banknote',
  cash: 'Banknote',
  savings: 'PiggyBank',
  credit: 'CreditCard',
  card: 'CreditCard',
  alert: 'TriangleAlert',
  warning: 'TriangleAlert',
};

export function formatIconName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

export function toPascalCase(str: string): string {
  return str.replace(/(^[a-z]|-[a-z0-9])/gi, (m) => m.replace('-', '').toUpperCase());
}

export function resolveIconName(name?: string | null, type?: string): string {
  if (name) {
    const iconDict = icons as Record<string, LucideIcon>;
    // 1. Direct match (e.g. 'Dog', 'Wallet')
    if (iconDict[name]) return name;

    // 2. Alias match (e.g. 'home' -> 'House')
    const alias = ICON_ALIASES[name.toLowerCase()];
    if (alias && iconDict[alias]) return alias;

    // 3. PascalCase conversion (e.g. 'piggy-bank' -> 'PiggyBank', 'credit-card' -> 'CreditCard')
    const pascal = toPascalCase(name);
    if (iconDict[pascal]) return pascal;

    // 4. Case-insensitive search
    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = ALL_ICON_NAMES.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
    if (found) return found;
  }

  // Fallback to default by type
  switch (type) {
    case 'checking':
      return 'Wallet';
    case 'savings':
      return 'PiggyBank';
    case 'credit':
      return 'CreditCard';
    case 'cash':
      return 'Banknote';
    case 'other':
      return 'Landmark';
    default:
      return 'Wallet';
  }
}

export function searchIcons(query: string, categoryId: string = 'popular'): string[] {
  const q = query.trim().toLowerCase();

  // If query is provided, search globally across all icons and synonyms
  if (q) {
    const results = new Set<string>();

    // 1. Check exact synonyms
    if (ICON_SYNONYMS[q]) {
      for (const iconName of ICON_SYNONYMS[q]) {
        if ((icons as Record<string, LucideIcon>)[iconName]) {
          results.add(iconName);
        }
      }
    }

    // 2. Check partial synonyms
    for (const [key, iconNames] of Object.entries(ICON_SYNONYMS)) {
      if (key.includes(q) || q.includes(key)) {
        for (const iconName of iconNames) {
          if ((icons as Record<string, LucideIcon>)[iconName]) {
            results.add(iconName);
          }
        }
      }
    }

    // 3. Match against icon names (starts with gets priority)
    const startsWithMatches: string[] = [];
    const containsMatches: string[] = [];

    for (const iconName of ALL_ICON_NAMES) {
      const lower = iconName.toLowerCase();
      if (lower.startsWith(q)) {
        startsWithMatches.push(iconName);
      } else if (lower.includes(q)) {
        containsMatches.push(iconName);
      }
    }

    for (const m of startsWithMatches) results.add(m);
    for (const m of containsMatches) results.add(m);

    return Array.from(results);
  }

  // If no query, return icons by selected category
  const category = ICON_CATEGORIES.find((c) => c.id === categoryId);
  if (category && category.icons.length > 0) {
    return category.icons;
  }

  // 'all' category returns all icons
  return ALL_ICON_NAMES;
}
