# SmartBiz — Retail Business Management System

A full-featured retail management PWA with POS, inventory tracking, analytics, multi-currency support, and AI-powered recommendations. Built with **Next.js 16**, **Prisma/SQLite**, **shadcn/ui**, and **TypeScript**.

## Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (React 19), shadcn/ui, Tailwind CSS 4, Zustand, Framer Motion, Recharts |
| **Backend** | Next.js API Routes (Edge-compatible), Server Actions |
| **Database** | SQLite via Prisma 6 ORM (better-sqlite3) |
| **Auth** | JWT (access + refresh tokens), bcryptjs, rate limiting, CSRF tokens, account lockout |
| **Validation** | Zod 4 schemas on every API endpoint |
| **i18n** | English + Swahili |
| **PWA** | Service worker, manifest, offline queue |
| **Deployment** | Render.com (free tier), persistent disk for SQLite |

### Project Structure

```
smartbiz/
├── prisma/
│   ├── schema.prisma          # Database schema (14 models)
│   └── seed.ts                # Demo data seeder
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   ├── logo.svg               # App logo
│   └── icon-{192,512}.png     # PWA icons
├── src/
│   ├── app/
│   │   ├── api/               # 40 API route files (see below)
│   │   ├── globals.css        # Tailwind + shadcn theme
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main entry
│   ├── components/            # React components (shadcn/ui)
│   │   ├── auth/              # Login, register forms
│   │   ├── layout/            # Sidebar, header, session timeout
│   │   └── ui/                # shadcn primitives
│   ├── hooks/                 # use-offline, use-currency, use-toast
│   ├── lib/
│   │   ├── auth.ts            # JWT, password hashing, lockout, RBAC
│   │   ├── auth-fetch.ts      # Client-side JWT auto-refresh
│   │   ├── api-client.ts      # Convenience API client
│   │   ├── audit-log.ts       # In-memory audit trail (37+ action types)
│   │   ├── csrf.ts            # CSRF token generation/validation
│   │   ├── currency.ts        # Multi-currency (9 E.African currencies)
│   │   ├── db.ts              # Prisma singleton
│   │   ├── rate-limit.ts      # In-memory sliding window rate limiter
│   │   ├── validation.ts      # Zod schemas for all entities
│   │   ├── utils.ts           # cn() utility
│   │   └── i18n/              # English + Swahili translations (649 keys)
│   ├── middleware.ts           # Auth, rate limiting, CSRF, security headers
│   └── stores/                # Zustand stores (app + POS)
├── .env.example               # Environment variable template
├── next.config.ts             # Next.js configuration
├── render.yaml                # Render.com deployment config
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── eslint.config.mjs
└── package.json
```

### API Routes (40 endpoints)

#### Auth (11 routes)
| Endpoint | Methods | Access |
|----------|---------|--------|
| `/api/auth/login` | POST | Public |
| `/api/auth/join` | POST | Public (self-registration) |
| `/api/auth/logout` | POST | Authenticated |
| `/api/auth/refresh` | POST | Public (token refresh) |
| `/api/auth/verify` | POST | Public (2FA TOTP) |
| `/api/auth/2fa` | POST | Authenticated |
| `/api/auth/change-password` | POST | Authenticated |
| `/api/auth/csrf` | GET | Authenticated |
| `/api/auth/sessions` | GET/DELETE | Authenticated |
| `/api/auth/activity` | GET | Authenticated |
| `/api/auth/security` | GET/POST | Authenticated |

#### Core Business (23 routes)
| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/companies` | GET/POST/PUT | Register, list, update companies |
| `/api/companies/[id]` | GET/PUT/DELETE | Company details, update, deactivate |
| `/api/branches` | GET/POST | List, create branches |
| `/api/branches/[id]` | GET/PUT/DELETE | Branch CRUD |
| `/api/users` | GET/POST | List, create users |
| `/api/users/[id]` | GET/PUT/DELETE | User CRUD |
| `/api/products` | GET/POST | List, create products |
| `/api/products/[id]` | GET/PUT/DELETE | Product CRUD |
| `/api/customers` | GET/POST | List, create customers |
| `/api/customers/[id]` | GET/PUT/DELETE | Customer CRUD |
| `/api/suppliers` | GET/POST | List, create suppliers |
| `/api/suppliers/[id]` | GET/PUT/DELETE | Supplier CRUD |
| `/api/expenses` | GET/POST | List, create expenses |
| `/api/expenses/[id]` | GET/PUT/DELETE | Expense CRUD |

#### Inventory & Sales (4 routes)
| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/inventory` | POST | Add inventory batch (stock-in) |
| `/api/shrinkage` | GET/POST | Record/list shrinkage (loss) |
| `/api/sales` | GET/POST | Create/list sales with items |
| `/api/notifications` | GET/PUT | List/mark notifications |

#### Analytics & Reports (8 routes)
| Endpoint | Description |
|----------|-------------|
| `/api/reports` | Business reports (summary, sales, expenses) |
| `/api/data/export` | CSV export (products, sales, expenses) |
| `/api/analytics/dashboard` | KPIs (today's sales, top products, low stock) |
| `/api/analytics/best-sellers` | Best-selling products |
| `/api/analytics/trends` | Sales trends over time |
| `/api/analytics/dead-stock` | Products with no recent sales |
| `/api/analytics/loss-report` | Shrinkage + expired stock |
| `/api/business/health-score` | Composite business health metric |
| `/api/advisor/recommendations` | AI-powered restock/pricing recommendations |

## Security Features

### Authentication
- **JWT access tokens** (24h expiry) + **refresh tokens** (7d expiry)
- Password hashing with **bcryptjs** (12 salt rounds)
- **Account lockout**: 5 failed attempts → 15-minute lockout
- **2FA** support (TOTP)
- **Session management**: list active sessions, terminate remotely

### Authorization (Role-Based Access Control)
| Role | Permissions |
|------|-------------|
| **CompanyAdmin** | Full access to all company data, settings, user management |
| **BranchManager** | Manage branch data, expenses, sales, inventory |
| **Employee** | Process sales, view assigned branch data |

### Tenant Isolation (Multi-Company)
Every database query is scoped to the authenticated user's `companyId`. Cross-company access attempts are logged as suspicious activity. All `[id]` routes validate resource ownership before returning data.

### Input Validation
All POST/PUT/PATCH endpoints use **Zod 4 schemas**. Invalid input returns structured error messages.

### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| Login | 10 req / 15 min |
| Join/Register | 5 / 3 req per hour |
| API reads | 200 req / min |
| API writes (POST/PUT/DELETE) | 30 req / min |
| AI Advisor | 10 req / min |

### CSRF Protection
- Cryptographically random CSRF tokens bound to session IDs (1hr TTL)
- Required on state-changing requests without Authorization header
- Token endpoint: `GET /api/auth/csrf`

### Security Headers
All API responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(), geolocation=()`
- `Content-Security-Policy` (relaxed for PWA compatibility)

### Audit Logging
37+ action types tracked with user ID, email, IP address, user agent, and details. Includes security-specific summary dashboard.

## Data Model (14 tables)

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Company` | name, industry, plan, currency, country, exchangeRate | Tenant entity |
| `Branch` | name, code (unique), companyId | Physical/logical store |
| `User` | email, role, branchId, companyId failedLoginAttempts, lockedUntil | Employee accounts |
| `Session` | userId, tokenHash, expiresAt | Active sessions |
| `AuditLog` | action, userId, companyId, details, ipAddress | Immutable audit trail |
| `Product` | name, sku, barcode, category, currentStockLevel, branchId | Sellable items |
| `InventoryBatch` | productId, quantityAdded, purchasePricePerUnit, supplierId | Stock-in records |
| `Sale` | totalAmount, discount, userId, branchId, paymentMethod | POS transactions |
| `SaleItem` | saleId, productId, quantitySold, salePricePerUnit | Line items |
| `Shrinkage` | productId, quantityLost, reason, branchId | Inventory loss |
| `Expense` | category, description, amount, branchId, receiptUrl | Operational costs |
| `Supplier` | name, email, phone, companyId | Product vendors |
| `Customer` | name, email, phone, loyaltyPoints, creditBalance, branchId | Clients |
| `Notification` | type, title, message, isRead, companyId | In-app alerts |

## Deployment to Render.com

### Prerequisites
- A [Render.com](https://render.com) account (free tier works)
- This repository pushed to GitHub/GitLab

### One-Click Deploy

1. Push this repository to GitHub
2. Log in to [Render Dashboard](https://dashboard.render.com)
3. Click **New +** → **Blueprint** (uses `render.yaml`)
4. Connect your GitHub repository
5. Render auto-detects the `render.yaml` configuration
6. Click **Apply** — deployment starts automatically

### Manual Deploy (Alternative)

1. Click **New +** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `smartbiz`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npx prisma db push && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. Add **Environment Variables**:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: `file:/opt/render/project/data/smartbiz.db`
   - `JWT_SECRET`: Click **Generate Value**
   - `JWT_REFRESH_SECRET`: Click **Generate Value**
   - `NEXT_PUBLIC_APP_URL`: `https://smartbiz.onrender.com` (adjust to your URL)
5. Add a **Disk**:
   - **Name**: `smartbiz-data`
   - **Mount Path**: `/opt/render/project/data`
   - **Size GB**: 1
6. Click **Create Web Service**

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite database path (use persistent disk in production) |
| `JWT_SECRET` | Yes | JWT signing secret (use Render's auto-generate) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token secret (use Render's auto-generate) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of your app |
| `NODE_ENV` | Yes | `production` |

### Post-Deploy

1. After deployment, visit your Render URL
2. **Create your first company** via the registration form
3. Log in with the admin credentials you created
4. Start adding branches, products, and users

### Data Persistence

SQLite data is stored on Render's **persistent disk** at `/opt/render/project/data/smartbiz.db`. This survives server restarts and redeploys. To reset, SSH into the instance and delete the database file.

### Important Notes

- **Free tier** spins down after 15 min of inactivity. First request after idle will be slow (~30s cold start).
- **Upgrade** to a paid plan ($7/mo+) for zero-downtime and no cold starts.
- The `render.yaml` blueprint keeps your deploy configuration in version control.
- JWT secrets are auto-generated on first deploy via `generateValue: true`.

## Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Push database schema
npx prisma db push

# Seed demo data
npx prisma db seed

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## License

Proprietary — all rights reserved.
