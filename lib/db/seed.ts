import { eq } from 'drizzle-orm';
import { db, pgClient } from './index';
import { accountGroups, accounts, categories, payees, transactions, users } from './schema';
import { hashPassword } from '../auth';
import crypto from 'crypto';

const DEMO_EMAIL = 'demo@buddy.local';
const DEMO_PASSWORD = 'password123';

export async function seed() {
  console.log('🌱 Seeding PostgreSQL database...');

  // Remove existing demo user (cascades to all demo user records)
  await db.delete(users).where(eq(users.email, DEMO_EMAIL));

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await db.insert(users).values({
    id: userId,
    email: DEMO_EMAIL,
    name: 'Demo User',
    passwordHash,
  });

  // 1. Category Tree Hierarchy
  // Level 1: Root Categories
  const catGroceriesId = crypto.randomUUID();
  const catEatingOutId = crypto.randomUUID();
  const catHousingId = crypto.randomUUID();
  const catIncomeId = crypto.randomUUID();

  // Level 2: Subcategories
  const catSupermarketId = crypto.randomUUID();
  const catConvenienceId = crypto.randomUUID();
  const catBarId = crypto.randomUUID();
  const catRestaurantId = crypto.randomUUID();
  const catCoffeeId = crypto.randomUUID();
  const catRentId = crypto.randomUUID();
  const catUtilitiesId = crypto.randomUUID();
  const catSalaryId = crypto.randomUUID();
  const catInvestmentsId = crypto.randomUUID();

  // Level 3: Sub-subcategories (multi-layer support!)
  const catElectricityId = crypto.randomUUID();
  const catInternetId = crypto.randomUUID();

  await db.insert(categories).values([
    // Root level categories
    { id: catGroceriesId, userId, parentId: null, name: 'Groceries', sortOrder: 1 },
    { id: catEatingOutId, userId, parentId: null, name: 'Eating out', sortOrder: 2 },
    { id: catHousingId, userId, parentId: null, name: 'Housing & Living', sortOrder: 3 },
    { id: catIncomeId, userId, parentId: null, name: 'Income', sortOrder: 4 },

    // Groceries children (Level 2)
    { id: catSupermarketId, userId, parentId: catGroceriesId, name: 'Supermarket', sortOrder: 1 },
    { id: catConvenienceId, userId, parentId: catGroceriesId, name: 'Convenience', sortOrder: 2 },

    // Eating out children (Level 2)
    { id: catBarId, userId, parentId: catEatingOutId, name: 'Bar', sortOrder: 1 },
    { id: catRestaurantId, userId, parentId: catEatingOutId, name: 'Restaurant', sortOrder: 2 },
    { id: catCoffeeId, userId, parentId: catEatingOutId, name: 'Cafes & Coffee', sortOrder: 3 },

    // Housing children (Level 2)
    { id: catRentId, userId, parentId: catHousingId, name: 'Rent / Mortgage', sortOrder: 1 },
    { id: catUtilitiesId, userId, parentId: catHousingId, name: 'Utilities', sortOrder: 2 },

    // Utilities children (Level 3)
    {
      id: catElectricityId,
      userId,
      parentId: catUtilitiesId,
      name: 'Power & Electricity',
      sortOrder: 1,
    },
    {
      id: catInternetId,
      userId,
      parentId: catUtilitiesId,
      name: 'Internet & Mobile',
      sortOrder: 2,
    },

    // Income children (Level 2)
    { id: catSalaryId, userId, parentId: catIncomeId, name: 'Salary & Wages', sortOrder: 1 },
    {
      id: catInvestmentsId,
      userId,
      parentId: catIncomeId,
      name: 'Investments & Dividends',
      sortOrder: 2,
    },
  ]);

  // 2. Payees (assigned to either parent or child categories!)
  const payeePaknsaveId = crypto.randomUUID();
  const payeeCountdownId = crypto.randomUUID();
  const payeeLocalCornerId = crypto.randomUUID();
  const payeeCornerPubId = crypto.randomUUID();
  const payeePastaBistroId = crypto.randomUUID();
  const payeeMercuryId = crypto.randomUUID();
  const payeeSparkId = crypto.randomUUID();
  const payeeMojoId = crypto.randomUUID();
  const payeeEmployerId = crypto.randomUUID();
  const payeeOldBakeryId = crypto.randomUUID();

  await db.insert(payees).values([
    // Priority 0: Highest (quick-picks displayed before entry)
    {
      id: payeePaknsaveId,
      userId,
      name: "Pak'nSave",
      defaultCategoryId: catSupermarketId,
      priority: 0,
    },
    { id: payeeMojoId, userId, name: 'Mojo Coffee', defaultCategoryId: catCoffeeId, priority: 0 },

    // Priority 1: Standard (current behaviour)
    {
      id: payeeCountdownId,
      userId,
      name: 'Woolworths / Countdown',
      defaultCategoryId: catSupermarketId,
      priority: 1,
    },
    {
      id: payeeCornerPubId,
      userId,
      name: 'The Craft Bar & Taphouse',
      defaultCategoryId: catBarId,
      priority: 1,
    },
    {
      id: payeePastaBistroId,
      userId,
      name: 'Bella Italia Restaurant',
      defaultCategoryId: catRestaurantId,
      priority: 1,
    },
    {
      id: payeeMercuryId,
      userId,
      name: 'Mercury Energy',
      defaultCategoryId: catElectricityId,
      priority: 1,
    },
    {
      id: payeeSparkId,
      userId,
      name: 'Spark NZ',
      defaultCategoryId: catInternetId,
      priority: 1,
    },
    {
      id: payeeEmployerId,
      userId,
      name: 'Employer Inc',
      defaultCategoryId: catSalaryId,
      priority: 1,
    },

    // Priority 2: Low (appears at bottom of list even if better match)
    {
      id: payeeLocalCornerId,
      userId,
      name: 'City Convenience Store',
      defaultCategoryId: catConvenienceId,
      priority: 2,
    },

    // Priority 3: Archived (hidden from selection lists, visible in existing transactions)
    {
      id: payeeOldBakeryId,
      userId,
      name: 'Old Corner Bakery (Closed)',
      defaultCategoryId: catConvenienceId,
      priority: 3,
    },
  ]);

  // 3. Account Groups
  const grpEverydayId = crypto.randomUUID();
  const grpSavingsId = crypto.randomUUID();
  const grpCardsId = crypto.randomUUID();

  await db.insert(accountGroups).values([
    { id: grpEverydayId, userId, name: 'Everyday Banking', icon: 'Wallet', sortOrder: 1 },
    { id: grpSavingsId, userId, name: 'Savings & Goals', icon: 'PiggyBank', sortOrder: 2 },
    { id: grpCardsId, userId, name: 'Credit Cards', icon: 'CreditCard', sortOrder: 3 },
  ]);

  // 4. Accounts
  const accCheckingId = crypto.randomUUID();
  const accSavingsId = crypto.randomUUID();
  const accCreditId = crypto.randomUUID();
  const accCashId = crypto.randomUUID();

  await db.insert(accounts).values([
    {
      id: accCheckingId,
      userId,
      groupId: grpEverydayId,
      name: 'Everyday Checking',
      type: 'checking',
      icon: 'Wallet',
      sortOrder: 1,
    },
    {
      id: accCashId,
      userId,
      groupId: grpEverydayId,
      name: 'Cash Wallet',
      type: 'cash',
      icon: 'Banknote',
      sortOrder: 2,
    },
    {
      id: accSavingsId,
      userId,
      groupId: grpSavingsId,
      name: 'High Interest Savings',
      type: 'savings',
      icon: 'PiggyBank',
      sortOrder: 1,
    },
    {
      id: accCreditId,
      userId,
      groupId: grpCardsId,
      name: 'Visa Rewards Card',
      type: 'credit',
      icon: 'CreditCard',
      sortOrder: 1,
      creditLimitCents: 500000,
      balanceDisplayMode: 'available',
    },
  ]);

  // 5. Initial / Sample Transactions
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };

  // Starting balances
  await db.insert(transactions).values([
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accCheckingId,
      amountCents: 250000, // $2,500.00
      date: daysAgo(30),
      notes: 'Initial starting balance',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accSavingsId,
      amountCents: 850000, // $8,500.00
      date: daysAgo(30),
      notes: 'Initial savings balance',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accCreditId,
      amountCents: -34020, // -$340.20
      date: daysAgo(30),
      notes: 'Previous statement balance',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accCashId,
      amountCents: 12000, // $120.00
      date: daysAgo(30),
      notes: 'Cash on hand',
      isCleared: true,
    },
  ]);

  // Recent transactions
  await db.insert(transactions).values([
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accCheckingId,
      payeeId: payeeEmployerId,
      categoryId: catSalaryId,
      amountCents: 325000, // +$3,250.00
      date: daysAgo(14),
      notes: 'Fortnightly pay',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accCheckingId,
      payeeId: payeePaknsaveId,
      categoryId: catSupermarketId,
      amountCents: -18450, // -$184.50
      date: daysAgo(10),
      notes: 'Weekly supermarket groceries run',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accCheckingId,
      payeeId: payeeMercuryId,
      categoryId: catElectricityId,
      amountCents: -14520, // -$145.20
      date: daysAgo(8),
      notes: 'Electricity bill',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accCreditId,
      payeeId: payeeLocalCornerId,
      categoryId: catConvenienceId,
      amountCents: -1850, // -$18.50
      date: daysAgo(6),
      notes: 'Milk & snacks',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accCreditId,
      payeeId: payeeMojoId,
      categoryId: catCoffeeId,
      amountCents: -580, // -$5.80
      date: daysAgo(3),
      notes: 'Flat white',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accCreditId,
      payeeId: payeePastaBistroId,
      categoryId: catRestaurantId,
      amountCents: -8900, // -$89.00
      date: daysAgo(2),
      notes: 'Dinner date with friends',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accCreditId,
      payeeId: payeeCornerPubId,
      categoryId: catBarId,
      amountCents: -3400, // -$34.00
      date: daysAgo(1),
      notes: 'Friday drinks',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      userId,
      accountId: accCheckingId,
      categoryId: catGroceriesId,
      amountCents: -4500, // -$45.00
      date: today,
      notes: 'General grocery market stall',
      isCleared: false,
    },
  ]);

  // Inter-account transfer: $400 from Checking to Savings
  const transferOutId = crypto.randomUUID();
  const transferInId = crypto.randomUUID();

  await db.insert(transactions).values([
    {
      id: transferOutId,
      userId,
      accountId: accCheckingId,
      amountCents: -40000, // -$400.00
      date: daysAgo(5),
      notes: 'Monthly savings transfer',
      isCleared: true,
      transferId: transferInId,
    },
    {
      id: transferInId,
      userId,
      accountId: accSavingsId,
      amountCents: 40000, // +$400.00
      date: daysAgo(5),
      notes: 'Monthly savings transfer',
      isCleared: true,
      transferId: transferOutId,
    },
  ]);

  console.log(`✅ Seed completed! Demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

seed()
  .then(async () => {
    await pgClient.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await pgClient.end();
    process.exit(1);
  });
