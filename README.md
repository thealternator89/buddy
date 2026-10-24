# Buddy 💸

A clean, modern, multi-user personal finance and transaction tracking application built for speed, clarity, and control.

Buddy gives you complete visibility and control over your financial life. Designed from the ground up as a cloud-ready, multi-user web application—with full support for self-hosting—Buddy combines multi-account tracking, nested alphabetical categories, smart payee categorization rules, scheduled recurring transactions, versioned budgets, and bulk CSV imports. With built-in authentication and strict per-user tenant isolation in PostgreSQL, Buddy eliminates financial clutter while keeping your data under your own control without relying on third-party financial aggregators.

---

## Key Highlights

- 🔐 **Multi-User Authentication**: Built-in Email & Password authentication with database-backed sessions and strict per-user tenant isolation.
- 🐘 **PostgreSQL Backed**: Fully relational database powered by PostgreSQL (`postgres.js`) and Drizzle ORM, with local Docker Compose support and auto-provisioning.
- ⚡ **Blazing Fast**: Powered by Next.js 16 Server Components and Server Actions with Proxy route protection (`proxy.ts`).
- ⏰ **Scheduled & Recurring Transactions**: Plan recurring bills, subscriptions, transfers, and income with an overview due carousel and 1-click posting.
- 🎯 **Versioned Spending Budgets**: Track weekly, monthly, and yearly budgets with dual concentric progress rings, days-remaining pacing, and non-destructive versioning.
- 🛡️ **Budget Exemptions**: Flag one-off, emergency, or reimbursable transactions as exempt from budgets without excluding entire accounts from net worth.
- 🌳 **Multi-Level Alphabetical Categories**: Organize spending into nested category trees automatically sorted alphabetically across all branches with rollup metrics.
- 🎯 **Smart Categorization**: Set conditional amount rules on payees to automatically assign categories as you type.
- 🔄 **Double-Entry Transfers**: Transfer funds between accounts with synchronized, linked records.
- 📥 **Smart CSV Import**: Ingest bank statements seamlessly with automatic column normalization and entity resolution.

---

## Core Features

### 🔐 Multi-User Authentication & Data Privacy
- **Self-Contained Authentication**: Built-in Email & Password registration and sign-in with no external third-party identity dependencies.
- **Strong Cryptography**: Passwords hashed with Node's native `crypto.scrypt` with a cryptographically secure 16-byte random salt and verified via constant-time comparison (`crypto.timingSafeEqual`).
- **Database-Backed Sessions**: Session tokens hashed with SHA-256 and stored in the PostgreSQL `sessions` table, transmitted via secure `httpOnly` cookies (`buddy_session`).
- **Proxy Route Protection**: Integrated Next.js 16 `proxy.ts` middleware protecting private application routes (`/`, `/transactions`, `/accounts`, `/manage`, `/budgets`, `/scheduled`) and redirecting unauthenticated requests to `/login`.
- **Strict Tenant Isolation**: All domain tables (`account_groups`, `accounts`, `categories`, `payees`, `payee_rules`, `transactions`, `scheduled_transactions`, `budgets`, `budget_versions`) enforce `user_id` foreign keys with cascade deletion.

### 📊 Financial Overview & Dashboard
- **Instant Account Balances**: Real-time snapshot of balances across all active checking, savings, credit, and cash accounts.
- **Account Grouping**: Group accounts logically (e.g., *Everyday Banking*, *Savings & Goals*, *Credit Cards*) with aggregated totals.
- **Due Scheduled Carousel**: Interactive carousel banner on the dashboard surfacing upcoming and overdue recurring transactions with 1-click posting or skipping.
- **Active Budget Status**: At-a-glance budget progress cards sorted by highest spending utilization.
- **Recent Activity Feed**: Quick glance at the latest inflow and outflow transactions.
- **Global Quick-Record**: Record an income, expense, or transfer from anywhere in the app with a single click.

### 💳 Account Management & Organization
- **Supported Account Types**: Everyday/Checking, High-Interest Savings, Credit Cards, Cash/Wallets, and Custom accounts.
- **Drag-and-Drop Reordering**: Intuitive visual reordering for both account groups and individual accounts.
- **Net Worth Exclusions**: Exclude specific accounts (e.g., tracking-only or business accounts) from your overall net worth calculations.
- **Custom Icons**: Personalize accounts and groups with a curated library of icons.
- **Account Archiving**: Hide inactive or closed accounts without breaking transaction history or category rollups.

### ⏰ Scheduled & Recurring Transactions
- **Flexible Recurrence Frequencies**: Automate recurring financial activity with support for `Weekly`, `Fortnightly (Every 2 weeks)`, `Monthly`, `Quarterly (Every 3 months)`, `Yearly`, and `One-off (Once)` schedules.
- **Smart Recurrence Math**: Robust calendar progression handling leap years and month-end clamping (e.g. transactions anchored to the 31st clamp safely to the 28th/29th in February and re-anchor in March).
- **Overview Due Carousel**: Surfaces due and overdue payments directly on your dashboard with contextual badges (*Due today*, *Overdue by X days*, *In X days*).
- **1-Click Posting & Skipping**: Post transactions immediately using today's date in a single click, or skip an occurrence to advance directly to the next scheduled date.
- **Adjustable Pre-Fill**: Click "Adjust" on any due item to open the transaction modal pre-filled with the scheduled account, payee, category, amount, and notes for modification before saving.
- **Scheduled Transfers**: Set up recurring transfers between accounts alongside standard income and expenses.
- **Dedicated Management Page**: Dedicated `/scheduled` view to search, review, create, edit, or delete recurring schedules.

### 🎯 Versioned Budgets & Dual Progress Tracking
- **Flexible Budget Cycles**: Define spending targets across Weekly (Monday–Sunday), Monthly (calendar month), or Yearly (Jan 1–Dec 31) periods.
- **Hierarchical Category Selection**: Bundle multiple categories and entire subcategory trees into a single budget with recursive net spending calculations.
- **Dual Concentric Progress Rings**: Visual indicators showing actual spending percentage (color-coded green `<75%`, amber `75%–99%`, red `≥100%`) alongside an inner ring tracking elapsed time in the budget period.
- **Days Remaining Pacing**: Real-time counter of days remaining in the cycle to help evaluate spending pace without subjective labels.
- **Budget-Exempt Transactions**: Exclude one-off, emergency, or reimbursed transactions from budget tracking so they don't skew periodic targets.
- **Historical Versioning & Edit Strategies**: Protect historical reports when budget targets change. Choose to apply changes starting from the current budget cycle (`current_cycle`) or cleanly replace all versions (`replace_all`).
- **Responsive Dashboard Overview**: Priority budget status widget on the overview dashboard sorted by highest percentage used.

### 🌳 Multi-Tier Category Hierarchy & Rollup Analytics
- **Unlimited Category Depth**: Create clean parent-child structures (e.g., `Housing` > `Utilities` > `Power & Electricity`).
- **Automatic Alphabetical Sorting Everywhere**: Categories are automatically organized alphabetically by name at the root level and within all sub-branches. Tree views, category dropdowns, comboboxes, and filter pickers maintain clean alphabetical ordering without manual sorting overhead.
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
- **Exempt from Budgets**: Flag transactions as exempt from budgets when recording or editing. Paired transfer legs stay synchronized automatically, and distinct "Budget Exempt" badges are displayed across ledger rows, mobile cards, and details modals.
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
| **Framework** | [Next.js](https://nextjs.org/) 16 (App Router) | React Server Components, Server Actions, Proxy route protection |
| **UI Library** | [React](https://react.dev/) 19 | Client components, hooks, transitions, and optimistic UI |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) v4 | Utility-first responsive design with dark mode styling |
| **Icons** | [Lucide React](https://lucide.dev/) | Clean, consistent vector icons |
| **Database** | [PostgreSQL](https://www.postgresql.org/) via [`postgres`](https://github.com/porsager/postgres) | Multi-user relational database for cloud or self-hosted deployments |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) & Drizzle Kit | Type-safe SQL schema, migrations, and relational queries |
| **Authentication** | Session-Based Auth (`crypto.scrypt`) | Self-contained Email & Password authentication stored in PostgreSQL |
| **CSV Engine** | [PapaParse](https://www.papaparse.com/) | Robust client/server CSV streaming and parsing |
| **Language** | [TypeScript](https://www.typescriptlang.org/) 5 | Full-stack end-to-end type safety |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20.x or higher recommended)
- A running **PostgreSQL** database (local, Docker, or hosted on Neon / Supabase / Railway / Render)

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

3. **Configure environment variables:**
   Copy `.env.example` to `.env` and set your PostgreSQL `DATABASE_URL`:
   ```bash
   cp .env.example .env
   ```
   *(Optional)* Start a local PostgreSQL instance with Docker Compose:
   ```bash
   docker compose up -d
   ```

4. **Push the PostgreSQL schema:**
   ```bash
   npm run db:push
   ```

5. **(Optional) Seed demo user & sample data:**
   Populate the database with a demo user (`demo@buddy.local` / `password123`) and sample accounts, categories, payees, and transactions:
   ```bash
   npm run db:seed
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser to sign in or create a new account.

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
- **Database Connection**: Set `DATABASE_URL` in `.env` (defaults to `postgresql://postgres:postgres@localhost:5432/buddy`).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js development server at `http://localhost:3000` |
| `npm run build` | Compiles the production build |
| `npm run start` | Runs the compiled production server |
| `npm run lint` | Runs ESLint checks across the codebase |
| `npm run db:push` | Applies Drizzle schema changes to the PostgreSQL database |
| `npm run db:seed` | Seeds a demo user (`demo@buddy.local` / `password123`) with sample financial data |

