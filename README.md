# Buddy 💸

A clean, modern, local-first personal finance and transaction tracking application built for speed, clarity, and complete privacy.

Buddy gives you total control over your financial life. With multi-account tracking, nested hierarchical categories, smart amount-based payee categorization rules, linked inter-account transfers, and bulk CSV imports, Buddy eliminates financial clutter without sending your sensitive data to third-party servers.

---

## Key Highlights

- 🔒 **Local-First & Private**: Your financial data resides in a local SQLite database on your machine. No telemetry, no external accounts, no cloud lock-in.
- ⚡ **Blazing Fast**: Powered by Next.js Server Components, Server Actions, and SQLite Write-Ahead Logging (WAL) for near-instant reads and writes.
- 🎯 **Smart Categorization**: Set conditional amount rules on payees to automatically assign categories as you type.
- 🌳 **Multi-Level Categories**: Organize spending into nested category trees with automated rollup totals up the hierarchy.
- 🔄 **Double-Entry Transfers**: Transfer funds between accounts with synchronized, linked records.
- 📥 **Smart CSV Import**: Ingest bank statements seamlessly with automatic column normalization and entity resolution.

---

## Core Features

### 📊 Financial Overview & Dashboard
- **Instant Account Balances**: Real-time snapshot of balances across all active checking, savings, credit, and cash accounts.
- **Account Grouping**: Group accounts logically (e.g., *Everyday Banking*, *Savings & Goals*, *Credit Cards*) with aggregated totals.
- **Recent Activity Feed**: Quick glance at the latest inflow and outflow transactions.
- **Global Quick-Record**: Record an income, expense, or transfer from anywhere in the app with a single click.

### 💳 Account Management & Organization
- **Supported Account Types**: Everyday/Checking, High-Interest Savings, Credit Cards, Cash/Wallets, and Custom accounts.
- **Drag-and-Drop Reordering**: Intuitive visual reordering for both account groups and individual accounts.
- **Net Worth Exclusions**: Exclude specific accounts (e.g., tracking-only or business accounts) from your overall net worth calculations.
- **Custom Icons**: Personalize accounts and groups with a curated library of icons.
- **Account Archiving**: Hide inactive or closed accounts without breaking transaction history or category rollups.

### 🌳 Multi-Tier Category Hierarchy & Rollup Analytics
- **Unlimited Category Depth**: Create clean parent-child structures (e.g., `Housing` > `Utilities` > `Power & Electricity`).
- **Rollup Metrics**: Real-time calculations of total spending and transaction volume that roll up from descendant subcategories to their parents.
- **Collapsible Tree View**: Expand or collapse category nodes to keep your hierarchy structured and readable.
- **Flexible Assignment**: Assign transactions to specific granular subcategories or top-level parent categories directly.
- **Archival Protection**: Safely archive categories without deleting historical transactions.

### ⚡ Smart Payees & Rule-Based Auto-Categorization
- **Priority-Based Directory**:
  - **Highest**: Highlighted as quick-picks before typing in selection lists.
  - **Standard**: Regular auto-complete matching.
  - **Low**: Deprioritized to the bottom of suggestions.
  - **Archived**: Hidden from selection prompts while retained on existing transactions.
- **Conditional Amount Rules**: Define rules using comparison operators (`<=` or `>=`) with specific monetary thresholds (e.g., assign purchases $\le \$20.00$ to *Coffee & Snacks* and $\ge \$100.00$ to *Supermarket*).
- **Closest-Threshold Matching**: Buddy resolves the best-fitting category rule or falls back to the payee's default category.
- **Payee Insights**: Track transaction volume, total outflow, total inflow, and net balance per payee.

### 📒 Transactions Ledger & Linked Transfers
- **Instant In-Memory Search**: Filter transactions instantly across payees, categories, parent categories, accounts, and notes.
- **Multi-Dimensional Filters**: Narrow down your transactions by account, payee, date range, or category (including full category subtree matching).
- **Inter-Account Transfers**: Create synchronized transfers that automatically create paired debits and credits linked via a shared `transferId`.
- **Reconciliation & Cleared Status**: Toggle cleared/uncleared status directly in the ledger table.
- **Transaction Details Modal**: Inspect full transaction metadata, formatted timestamps, linked transfer partner, and quick navigation filters.

### 📥 Flexible CSV Import
- **Header Normalization**: Automatically recognizes standard bank export headers (Date, Payee, Description, Category, Account, Transfer Account, Notes, Amount).
- **Auto-Provisioning**: Automatically creates missing accounts, categories, or payees discovered during import.
- **Intelligent Note Merging**: Merges transaction descriptions and memo fields into clean, formatted transaction notes.
- **Automatic Rule Application**: Evaluates payee categorization rules on imported rows.
- **Pre-Import Verification**: Preview valid rows, invalid entries, and generated entities before committing data.

### 🎨 Responsive & Accessible UI
- Fully responsive design built with Tailwind CSS v4.
- Automatic Dark Mode support matching system preferences.
- Keyboard-friendly navigation and modal shortcuts (`Esc` to dismiss).

---

## Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Framework** | [Next.js](https://nextjs.org/) 16 (App Router) | React Server Components, Server Actions, streaming layouts |
| **UI Library** | [React](https://react.dev/) 19 | Client components, hooks, transitions, and optimistic UI |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) v4 | Utility-first responsive design with dark mode styling |
| **Icons** | [Lucide React](https://lucide.dev/) | Clean, consistent vector icons |
| **Database** | [SQLite](https://www.sqlite.org/) via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) | Fast, embedded, local database running in WAL mode |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) & Drizzle Kit | Type-safe SQL schema, migrations, and relational queries |
| **CSV Engine** | [PapaParse](https://www.papaparse.com/) | Robust client/server CSV streaming and parsing |
| **Language** | [TypeScript](https://www.typescriptlang.org/) 5 | Full-stack end-to-end type safety |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20.x or higher recommended)
- `npm` (or `pnpm` / `yarn` / `bun`)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/thealternator89/buddy.git
   cd buddy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Initialize the SQLite database:**
   Push the Drizzle schema to initialize your local SQLite database:
   ```bash
   npm run db:push
   ```

4. **(Optional) Seed sample data:**
   Populate your database with sample accounts, hierarchical categories, payees, and transactions:
   ```bash
   npm run db:seed
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser to view Buddy.

---

## Architecture & Deep Dive

For an in-depth explanation of Buddy's internal technical architecture, domain models, database schema, category rollup algorithms, payee rule engine, and full codebase file structure, see:

📖 **[Technical Architecture & Deep Dive](docs/ARCHITECTURE.MD)**

---

## Configuration & Customization

- **Currency & Locale**: Adjust default currency code, symbol, and formatting in [`lib/constants.ts`](lib/constants.ts):
  ```typescript
  export const APP_CONFIG = {
    currency: {
      code: 'NZD',
      symbol: '$',
      locale: 'en-NZ',
    },
    // ...
  };
  ```
- **Database Location**: Buddy defaults to storing data at `./data/buddy.db`. You can override this by setting the `DATABASE_URL` environment variable.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js development server at `http://localhost:3000` |
| `npm run build` | Compiles the production build |
| `npm run start` | Runs the compiled production server |
| `npm run lint` | Runs ESLint checks across the codebase |
| `npm run db:push` | Applies schema changes directly to the local SQLite database |
| `npm run db:seed` | Resets and seeds the local database with sample categories, payees, and transactions |
