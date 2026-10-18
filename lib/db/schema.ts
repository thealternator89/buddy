import { relations } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)]
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accountGroups: many(accountGroups),
  accounts: many(accounts),
  categories: many(categories),
  payees: many(payees),
  payeeRules: many(payeeRules),
  transactions: many(transactions),
  scheduledTransactions: many(scheduledTransactions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountGroups = pgTable(
  'account_groups',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('account_groups_user_id_idx').on(table.userId)]
);

export const accountGroupsRelations = relations(accountGroups, ({ one, many }) => ({
  user: one(users, {
    fields: [accountGroups.userId],
    references: [users.id],
  }),
  accounts: many(accounts),
}));

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: text('group_id').references(() => accountGroups.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    type: text('type', { enum: ['checking', 'savings', 'credit', 'cash', 'other'] })
      .notNull()
      .default('checking'),
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0),
    excludeFromNetWorth: boolean('exclude_from_net_worth').notNull().default(false),
    creditLimitCents: integer('credit_limit_cents'),
    balanceDisplayMode: text('balance_display_mode', { enum: ['actual', 'available'] })
      .notNull()
      .default('actual'),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('accounts_user_id_idx').on(table.userId)]
);

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  group: one(accountGroups, {
    fields: [accounts.groupId],
    references: [accountGroups.id],
  }),
  transactions: many(transactions),
}));

export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('categories_user_id_idx').on(table.userId)]
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryHierarchy',
  }),
  children: many(categories, {
    relationName: 'categoryHierarchy',
  }),
  transactions: many(transactions),
  payeeRules: many(payeeRules),
}));

export const payees = pgTable(
  'payees',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    defaultCategoryId: text('default_category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    priority: integer('priority').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('payees_user_id_idx').on(table.userId),
    uniqueIndex('payees_user_id_name_idx').on(table.userId, table.name),
  ]
);

export const payeeRules = pgTable(
  'payee_rules',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    payeeId: text('payee_id')
      .notNull()
      .references(() => payees.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    operator: text('operator', { enum: ['lte', 'gte'] }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('payee_rules_user_id_idx').on(table.userId),
    index('payee_rules_payee_id_idx').on(table.payeeId),
  ]
);

export const payeeRulesRelations = relations(payeeRules, ({ one }) => ({
  user: one(users, {
    fields: [payeeRules.userId],
    references: [users.id],
  }),
  payee: one(payees, {
    fields: [payeeRules.payeeId],
    references: [payees.id],
  }),
  category: one(categories, {
    fields: [payeeRules.categoryId],
    references: [categories.id],
  }),
}));

export const payeesRelations = relations(payees, ({ one, many }) => ({
  user: one(users, {
    fields: [payees.userId],
    references: [users.id],
  }),
  defaultCategory: one(categories, {
    fields: [payees.defaultCategoryId],
    references: [categories.id],
  }),
  transactions: many(transactions),
  rules: many(payeeRules),
}));

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    payeeId: text('payee_id').references(() => payees.id, { onDelete: 'set null' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    amountCents: integer('amount_cents').notNull(), // Negative = Outflow, Positive = Inflow
    date: text('date').notNull(), // YYYY-MM-DD
    notes: text('notes'),
    isCleared: boolean('is_cleared').notNull().default(true),
    transferId: text('transfer_id'), // Paired transaction id for inter-account transfers
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('transactions_user_id_date_idx').on(table.userId, table.date),
    index('transactions_user_id_account_id_idx').on(table.userId, table.accountId),
  ]
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  payee: one(payees, {
    fields: [transactions.payeeId],
    references: [payees.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const scheduledTransactions = pgTable(
  'scheduled_transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    transferAccountId: text('transfer_account_id').references(() => accounts.id, {
      onDelete: 'cascade',
    }),
    payeeId: text('payee_id').references(() => payees.id, { onDelete: 'set null' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    amountCents: integer('amount_cents').notNull(), // Negative = Outflow/Transfer, Positive = Inflow
    frequency: text('frequency', {
      enum: ['once', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'],
    }).notNull(),
    startDate: text('start_date').notNull(), // YYYY-MM-DD
    nextDueDate: text('next_due_date').notNull(), // YYYY-MM-DD
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('scheduled_tx_user_id_due_date_idx').on(table.userId, table.nextDueDate),
    index('scheduled_tx_user_id_account_id_idx').on(table.userId, table.accountId),
  ]
);

export const scheduledTransactionsRelations = relations(scheduledTransactions, ({ one }) => ({
  user: one(users, {
    fields: [scheduledTransactions.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [scheduledTransactions.accountId],
    references: [accounts.id],
  }),
  transferAccount: one(accounts, {
    fields: [scheduledTransactions.transferAccountId],
    references: [accounts.id],
  }),
  payee: one(payees, {
    fields: [scheduledTransactions.payeeId],
    references: [payees.id],
  }),
  category: one(categories, {
    fields: [scheduledTransactions.categoryId],
    references: [categories.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type AccountGroup = typeof accountGroups.$inferSelect;
export type NewAccountGroup = typeof accountGroups.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Payee = typeof payees.$inferSelect;
export type PayeeRule = typeof payeeRules.$inferSelect;
export type NewPayeeRule = typeof payeeRules.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type ScheduledTransaction = typeof scheduledTransactions.$inferSelect;
export type NewScheduledTransaction = typeof scheduledTransactions.$inferInsert;
export type BalanceDisplayMode = 'actual' | 'available';
