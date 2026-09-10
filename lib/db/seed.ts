import { db } from './index';
import { accounts, categories, categoryGroups, payees, transactions } from './schema';
import crypto from 'crypto';

export async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing records if any
  db.delete(transactions).run();
  db.delete(payees).run();
  db.delete(categories).run();
  db.delete(categoryGroups).run();
  db.delete(accounts).run();

  // 1. Category Groups
  const groupEssentialsId = crypto.randomUUID();
  const groupLifestyleId = crypto.randomUUID();
  const groupIncomeId = crypto.randomUUID();

  db.insert(categoryGroups).values([
    { id: groupEssentialsId, name: 'Essentials', sortOrder: 1 },
    { id: groupLifestyleId, name: 'Lifestyle & Discretionary', sortOrder: 2 },
    { id: groupIncomeId, name: 'Income', sortOrder: 3 },
  ]).run();

  // 2. Categories
  const catGroceriesId = crypto.randomUUID();
  const catRentId = crypto.randomUUID();
  const catUtilitiesId = crypto.randomUUID();
  const catInternetId = crypto.randomUUID();
  const catTransportId = crypto.randomUUID();

  const catDiningId = crypto.randomUUID();
  const catCoffeeId = crypto.randomUUID();
  const catSubsId = crypto.randomUUID();
  const catShoppingId = crypto.randomUUID();

  const catSalaryId = crypto.randomUUID();
  const catInterestId = crypto.randomUUID();
  const catOtherIncomeId = crypto.randomUUID();

  db.insert(categories).values([
    // Essentials
    { id: catGroceriesId, groupId: groupEssentialsId, name: 'Groceries & Supermarket', sortOrder: 1 },
    { id: catRentId, groupId: groupEssentialsId, name: 'Rent / Mortgage', sortOrder: 2 },
    { id: catUtilitiesId, groupId: groupEssentialsId, name: 'Utilities & Power', sortOrder: 3 },
    { id: catInternetId, groupId: groupEssentialsId, name: 'Internet & Mobile', sortOrder: 4 },
    { id: catTransportId, groupId: groupEssentialsId, name: 'Transport & Fuel', sortOrder: 5 },
    // Lifestyle
    { id: catDiningId, groupId: groupLifestyleId, name: 'Dining Out & Takeaways', sortOrder: 1 },
    { id: catCoffeeId, groupId: groupLifestyleId, name: 'Coffee & Snacks', sortOrder: 2 },
    { id: catSubsId, groupId: groupLifestyleId, name: 'Subscriptions', sortOrder: 3 },
    { id: catShoppingId, groupId: groupLifestyleId, name: 'Shopping & Clothes', sortOrder: 4 },
    // Income
    { id: catSalaryId, groupId: groupIncomeId, name: 'Salary & Wages', sortOrder: 1 },
    { id: catInterestId, groupId: groupIncomeId, name: 'Interest & Dividends', sortOrder: 2 },
    { id: catOtherIncomeId, groupId: groupIncomeId, name: 'Other Income', sortOrder: 3 },
  ]).run();

  // 3. Payees
  const payeePaknsaveId = crypto.randomUUID();
  const payeeCountdownId = crypto.randomUUID();
  const payeeMercuryId = crypto.randomUUID();
  const payeeSparkId = crypto.randomUUID();
  const payeeZId = crypto.randomUUID();
  const payeeMojoId = crypto.randomUUID();
  const payeeNetflixId = crypto.randomUUID();
  const payeeEmployerId = crypto.randomUUID();

  db.insert(payees).values([
    { id: payeePaknsaveId, name: "Pak'nSave", defaultCategoryId: catGroceriesId },
    { id: payeeCountdownId, name: 'Woolworths / Countdown', defaultCategoryId: catGroceriesId },
    { id: payeeMercuryId, name: 'Mercury Energy', defaultCategoryId: catUtilitiesId },
    { id: payeeSparkId, name: 'Spark NZ', defaultCategoryId: catInternetId },
    { id: payeeZId, name: 'Z Energy', defaultCategoryId: catTransportId },
    { id: payeeMojoId, name: 'Mojo Coffee', defaultCategoryId: catCoffeeId },
    { id: payeeNetflixId, name: 'Netflix', defaultCategoryId: catSubsId },
    { id: payeeEmployerId, name: 'Employer Inc', defaultCategoryId: catSalaryId },
  ]).run();

  // 4. Accounts
  const accCheckingId = crypto.randomUUID();
  const accSavingsId = crypto.randomUUID();
  const accCreditId = crypto.randomUUID();
  const accCashId = crypto.randomUUID();

  db.insert(accounts).values([
    { id: accCheckingId, name: 'Everyday Checking', type: 'checking' },
    { id: accSavingsId, name: 'High Interest Savings', type: 'savings' },
    { id: accCreditId, name: 'Visa Rewards Card', type: 'credit' },
    { id: accCashId, name: 'Cash Wallet', type: 'cash' },
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

  // Recent transactions
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
      categoryId: catGroceriesId,
      amountCents: -18450, // -$184.50
      date: daysAgo(10),
      notes: 'Weekly groceries run',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      accountId: accCheckingId,
      payeeId: payeeMercuryId,
      categoryId: catUtilitiesId,
      amountCents: -14520, // -$145.20
      date: daysAgo(8),
      notes: 'Electricity bill',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
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
      accountId: accCreditId,
      payeeId: payeeNetflixId,
      categoryId: catSubsId,
      amountCents: -2299, // -$22.99
      date: daysAgo(2),
      notes: 'Standard plan',
      isCleared: true,
    },
    {
      id: crypto.randomUUID(),
      accountId: accCheckingId,
      payeeId: payeeZId,
      categoryId: catTransportId,
      amountCents: -8500, // -$85.00
      date: today,
      notes: 'Petrol fill up',
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
