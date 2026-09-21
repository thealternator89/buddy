import { relations } from 'drizzle-orm';
import { AnySQLiteColumn, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const accountGroups = sqliteTable('account_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const accountGroupsRelations = relations(accountGroups, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  groupId: text('group_id').references(() => accountGroups.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['checking', 'savings', 'credit', 'cash', 'other'] })
    .notNull()
    .default('checking'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  excludeFromNetWorth: integer('exclude_from_net_worth', { mode: 'boolean' })
    .notNull()
    .default(false),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  group: one(accountGroups, {
    fields: [accounts.groupId],
    references: [accountGroups.id],
  }),
  transactions: many(transactions),
}));

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  parentId: text('parent_id').references((): AnySQLiteColumn => categories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
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

export const payees = sqliteTable('payees', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  defaultCategoryId: text('default_category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  priority: integer('priority').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const payeeRules = sqliteTable('payee_rules', {
  id: text('id').primaryKey(),
  payeeId: text('payee_id')
    .notNull()
    .references(() => payees.id, { onDelete: 'cascade' }),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  operator: text('operator', { enum: ['lte', 'gte'] }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const payeeRulesRelations = relations(payeeRules, ({ one }) => ({
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
  defaultCategory: one(categories, {
    fields: [payees.defaultCategoryId],
    references: [categories.id],
  }),
  transactions: many(transactions),
  rules: many(payeeRules),
}));

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  payeeId: text('payee_id').references(() => payees.id, { onDelete: 'set null' }),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  amountCents: integer('amount_cents').notNull(), // Negative = Outflow, Positive = Inflow
  date: text('date').notNull(), // YYYY-MM-DD
  notes: text('notes'),
  isCleared: integer('is_cleared', { mode: 'boolean' }).notNull().default(true),
  transferId: text('transfer_id'), // Paired transaction id for inter-account transfers
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
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

