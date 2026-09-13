import { db } from './index';
import { accountGroups, accounts, categories, payees, transactions } from './schema';
import crypto from 'crypto';

export async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing records if any
  db.delete(transactions).run();
  db.delete(payees).run();
  db.delete(categories).run();
  db.delete(accounts).run();
  db.delete(accountGroups).run();

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

  db.insert(categories).values([
    // Root level categories
    { id: catGroceriesId, parentId: null, name: 'Groceries', sortOrder: 1 },
    { id: catEatingOutId, parentId: null, name: 'Eating out', sortOrder: 2 },
    { id: catHousingId, parentId: null, name: 'Housing & Living', sortOrder: 3 },
    { id: catIncomeId, parentId: null, name: 'Income', sortOrder: 4 },

    // Groceries children (Level 2)
    { id: catSupermarketId, parentId: catGroceriesId, name: 'Supermarket', sortOrder: 1 },
    { id: catConvenienceId, parentId: catGroceriesId, name: 'Convenience', sortOrder: 2 },

    // Eating out children (Level 2)
    { id: catBarId, parentId: catEatingOutId, name: 'Bar', sortOrder: 1 },
    { id: catRestaurantId, parentId: catEatingOutId, name: 'Restaurant', sortOrder: 2 },
    { id: catCoffeeId, parentId: catEatingOutId, name: 'Cafes & Coffee', sortOrder: 3 },

    // Housing children (Level 2)
    { id: catRentId, parentId: catHousingId, name: 'Rent / Mortgage', sortOrder: 1 },
    { id: catUtilitiesId, parentId: catHousingId, name: 'Utilities', sortOrder: 2 },

    // Utilities children (Level 3)
    { id: catElectricityId, parentId: catUtilitiesId, name: 'Power & Electricity', sortOrder: 1 },
    { id: catInternetId, parentId: catUtilitiesId, name: 'Internet & Mobile', sortOrder: 2 },

    // Income children (Level 2)
    { id: catSalaryId, parentId: catIncomeId, name: 'Salary & Wages', sortOrder: 1 },
    { id: catInvestmentsId, parentId: catIncomeId, name: 'Investments & Dividends', sortOrder: 2 },
  ]).run();

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

  db.insert(payees).values([
    // Child category defaults
    { id: payeePaknsaveId, name: "Pak'nSave", defaultCategoryId: catSupermarketId },
    { id: payeeCountdownId, name: 'Woolworths / Countdown', defaultCategoryId: catSupermarketId },
    { id: payeeLocalCornerId, name: 'City Convenience Store', defaultCategoryId: catConvenienceId },
    { id: payeeCornerPubId, name: 'The Craft Bar & Taphouse', defaultCategoryId: catBarId },
    { id: payeePastaBistroId, name: 'Bella Italia Restaurant', defaultCategoryId: catRestaurantId },
    { id: payeeMojoId, name: 'Mojo Coffee', defaultCategoryId: catCoffeeId },
    // Level 3 child defaults
    { id: payeeMercuryId, name: 'Mercury Energy', defaultCategoryId: catElectricityId },
    { id: payeeSparkId, name: 'Spark NZ', defaultCategoryId: catInternetId },
    // Income child default
    { id: payeeEmployerId, name: 'Employer Inc', defaultCategoryId: catSalaryId },
  ]).run();

  // 3. Account Groups
  const grpEverydayId = crypto.randomUUID();
  const grpSavingsId = crypto.randomUUID();
  const grpCardsId = crypto.randomUUID();

  db.insert(accountGroups).values([
    { id: grpEverydayId, name: 'Everyday Banking', icon: 'Wallet', sortOrder: 1 },
    { id: grpSavingsId, name: 'Savings & Goals', icon: 'PiggyBank', sortOrder: 2 },
    { id: grpCardsId, name: 'Credit Cards', icon: 'CreditCard', sortOrder: 3 },
  ]).run();

  // 4. Accounts
  const accCheckingId = crypto.randomUUID();
  const accSavingsId = crypto.randomUUID();
  const accCreditId = crypto.randomUUID();
  const accCashId = crypto.randomUUID();

  db.insert(accounts).values([
    { id: accCheckingId, groupId: grpEverydayId, name: 'Everyday Checking', type: 'checking', icon: 'Wallet', sortOrder: 1 },
    { id: accCashId, groupId: grpEverydayId, name: 'Cash Wallet', type: 'cash', icon: 'Banknote', sortOrder: 2 },
    { id: accSavingsId, groupId: grpSavingsId, name: 'High Interest Savings', type: 'savings', icon: 'PiggyBank', sortOrder: 1 },
    { id: accCreditId, groupId: grpCardsId, name: 'Visa Rewards Card', type: 'credit', icon: 'CreditCard', sortOrder: 1 },
  ]).run();

  // 5. Initial / Sample Transactions
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };

  // Starting balances
  db.insert(transactions).values([
    {
      id: crypto.randomUUID(),
      accountId: accCheckingId,
      amountCents: 250000, // $2,500.00
      date: daysAgo(30),
      notes: 'Initial starting balance',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      accountId: accSavingsId,
      amountCents: 850000, // $8,500.00
      date: daysAgo(30),
      notes: 'Initial savings balance',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      accountId: accCreditId,
      amountCents: -34020, // -$340.20
      date: daysAgo(30),
      notes: 'Previous statement balance',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      accountId: accCashId,
      amountCents: 12000, // $120.00
      date: daysAgo(30),
      notes: 'Cash on hand',
      isCleared: true,
    },
  ]).run();

  // Recent transactions (testing both parent and child category selection)
  db.insert(transactions).values([
    {
      id: crypto.randomUUID(),
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
      accountId: accCheckingId,
      payeeId: payeePaknsaveId,
      categoryId: catSupermarketId, // Child category
      amountCents: -18450, // -$184.50
      date: daysAgo(10),
      notes: 'Weekly supermarket groceries run',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      accountId: accCheckingId,
      payeeId: payeeMercuryId,
      categoryId: catElectricityId, // Level 3 child
      amountCents: -14520, // -$145.20
      date: daysAgo(8),
      notes: 'Electricity bill',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      accountId: accCreditId,
      payeeId: payeeLocalCornerId,
      categoryId: catConvenienceId, // Child category
      amountCents: -1850, // -$18.50
      date: daysAgo(6),
      notes: 'Milk & snacks',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      accountId: accCreditId,
      payeeId: payeeMojoId,
      categoryId: catCoffeeId, // Child category
      amountCents: -580, // -$5.80
      date: daysAgo(3),
      notes: 'Flat white',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      accountId: accCreditId,
      payeeId: payeePastaBistroId,
      categoryId: catRestaurantId, // Child category
      amountCents: -8900, // -$89.00
      date: daysAgo(2),
      notes: 'Dinner date with friends',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      accountId: accCreditId,
      payeeId: payeeCornerPubId,
      categoryId: catBarId, // Child category
      amountCents: -3400, // -$34.00
      date: daysAgo(1),
      notes: 'Friday drinks',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      accountId: accCheckingId,
      categoryId: catGroceriesId, // Parent category directly!
      amountCents: -4500, // -$45.00
      date: today,
      notes: 'General grocery market stall',
      isCleared: false,
    },
  ]).run();

  // Inter-account transfer: $400 from Checking to Savings
  const transferOutId = crypto.randomUUID();
  const transferInId = crypto.randomUUID();

  db.insert(transactions).values([
    {
      id: transferOutId,
      accountId: accCheckingId,
      amountCents: -40000, // -$400.00
      date: daysAgo(5),
      notes: 'Monthly savings transfer',
      isCleared: true,
      transferId: transferInId,
    },
    {
      id: transferInId,
      accountId: accSavingsId,
      amountCents: 40000, // +$400.00
      date: daysAgo(5),
      notes: 'Monthly savings transfer',
      isCleared: true,
      transferId: transferOutId,
    },
  ]).run();

  console.log('✅ Seed completed successfully!');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
