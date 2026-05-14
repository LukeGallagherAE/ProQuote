# ProQuote - Field Service Management Platform

A full-featured field service management platform for tradespeople — similar to Tradify or ServiceMate. Manage jobs, customers, quotes, invoices, scheduling, and your team in one place.

## Features

- **Dashboard** — Live stats, revenue chart, upcoming jobs, recent activity
- **Jobs** — Create, assign, schedule and track jobs with status/priority
- **Customers** — Full CRM with job and invoice history
- **Quotes** — Create line-item quotes, mark sent/accepted/rejected
- **Invoices** — Invoice customers, track payments, mark paid
- **Schedule** — Calendar view of all scheduled jobs
- **Team** — Manage team members and their roles
- **Reports** — Revenue charts, completion rates, business KPIs

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Prisma** + SQLite (zero-config local database)
- **NextAuth.js v4** (JWT credentials auth)
- **Recharts** (charts)
- **Lucide React** (icons)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env.local

# 3. Create the database
npm run db:push

# 4. Seed demo data
npm run db:seed

# 5. Start the dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000)

## Demo Login

| Email | Password | Role |
|-------|----------|------|
| admin@proquote.com | admin123 | Admin |
| james@proquote.com | password123 | Technician |
| sarah@proquote.com | password123 | Technician |

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/     # All authenticated pages
│   │   ├── dashboard/
│   │   ├── jobs/
│   │   ├── customers/
│   │   ├── quotes/
│   │   ├── invoices/
│   │   ├── schedule/
│   │   ├── team/
│   │   └── reports/
│   ├── api/             # REST API routes
│   └── login/
├── components/
│   ├── sidebar.tsx
│   └── header.tsx
└── lib/
    ├── auth.ts
    ├── prisma.ts
    └── utils.ts

prisma/
├── schema.prisma
└── seed.ts
```
