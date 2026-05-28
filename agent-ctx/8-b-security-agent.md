# Task 8-b: Add Authentication and Authorization to API Routes (Sales, Expenses, Suppliers)

## Agent: Security Agent

## Summary

Successfully added authentication, authorization, input validation, and audit logging to all 5 API route files for sales, expenses, and suppliers.

## Changes Made

### 1. `src/lib/audit-log.ts`
- Added `SUPPLIER_DELETED` to `AuditAction` type union

### 2. `src/app/api/sales/route.ts`
- **GET**: Added `authenticateRequest` — filters by `auth.user.companyId`; employees restricted to own branch
- **POST**: Added `authenticateRequest` — uses `safeValidate(saleCreateSchema)`, overrides `companyId` from auth token, employees restricted to own branch, sanitizes `customerName`, logs `SALE_CREATED`, logs `SUSPICIOUS_ACTIVITY` for cross-branch attempts

### 3. `src/app/api/expenses/route.ts`
- **GET**: Added `authenticateRequest` — requires `isManagerOrAbove`, filters by `auth.user.companyId`
- **POST**: Added `authenticateRequest` — requires `isManagerOrAbove`, uses `safeValidate(expenseCreateSchema)`, overrides `companyId`, verifies branch ownership, sanitizes `description`, logs `EXPENSE_CREATED`, logs `SUSPICIOUS_ACTIVITY`

### 4. `src/app/api/expenses/[id]/route.ts`
- **GET**: Added `authenticateRequest` — requires `isManagerOrAbove`, verifies tenant isolation
- **PUT**: Added `authenticateRequest` — requires `isManagerOrAbove`, verifies tenant isolation, sanitizes `description`, logs `EXPENSE_UPDATED`, logs `SUSPICIOUS_ACTIVITY`
- **DELETE**: Added `authenticateRequest` — requires `isManagerOrAbove`, verifies tenant isolation, logs `EXPENSE_DELETED`, logs `SUSPICIOUS_ACTIVITY`

### 5. `src/app/api/suppliers/route.ts`
- **GET**: Added `authenticateRequest` — requires `isManagerOrAbove`, filters by `auth.user.companyId`
- **POST**: Added `authenticateRequest` — requires `isCompanyAdmin`, uses `safeValidate(supplierCreateSchema)`, overrides `companyId`, sanitizes all string fields, logs `SUPPLIER_CREATED`

### 6. `src/app/api/suppliers/[id]/route.ts`
- **GET**: Added `authenticateRequest` — requires `isManagerOrAbove`, verifies tenant isolation
- **PUT**: Added `authenticateRequest` — requires `isCompanyAdmin`, verifies tenant isolation, sanitizes all string fields, logs `SUPPLIER_UPDATED`, logs `SUSPICIOUS_ACTIVITY`
- **DELETE**: Added `authenticateRequest` — requires `isCompanyAdmin`, verifies tenant isolation, logs `SUPPLIER_DELETED`, logs `SUSPICIOUS_ACTIVITY`

## Security Rules Enforced
- **Tenant Isolation**: `companyId` is ALWAYS taken from the auth token, never from request body
- **Role-Based Access**: Sales (all users, branch-limited for employees), Expenses (Manager+), Suppliers (Manager+ for read, Admin for mutations)
- **Input Validation**: Zod schemas via `safeValidate()` on all POST handlers
- **String Sanitization**: `sanitizeString()` on all user-provided string inputs
- **Audit Logging**: All mutation operations logged with user, company, and request info
- **Suspicious Activity**: Cross-company/cross-branch attempts logged as `SUSPICIOUS_ACTIVITY`

## Verification
- `bun run lint` passes with zero errors
- Dev server running successfully on port 3000
