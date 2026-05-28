# Task 8-c: API Authentication & Authorization

## Agent: Security Agent

## Summary
Added authentication, authorization, input validation, and audit logging to 5 API route files.

## Changes Made

### Supporting Files
- **`src/lib/audit-log.ts`**: Added `CUSTOMER_DELETED` and `NOTIFICATION_READ` audit action types
- **`src/lib/validation.ts`**: Added `customerUpdateSchema` for customer update validation

### API Route Files Updated

1. **`src/app/api/customers/route.ts`**
   - GET: `authenticateRequest` + `isManagerOrAbove` check, filters by `auth.user.companyId`
   - POST: `authenticateRequest` + `isManagerOrAbove` check, `safeValidate(customerCreateSchema)`, companyId from token only, `sanitizeString()` on all strings, `CUSTOMER_CREATED` audit log

2. **`src/app/api/customers/[id]/route.ts`**
   - GET: `authenticateRequest` + `isManagerOrAbove` check, verifies customer.companyId === auth.user.companyId
   - PUT: `authenticateRequest` + `isManagerOrAbove` check, `safeValidate(customerUpdateSchema)`, ownership verification, sanitization, `CUSTOMER_UPDATED` audit log
   - DELETE: `authenticateRequest` + `isManagerOrAbove` check, ownership verification, `CUSTOMER_DELETED` audit log

3. **`src/app/api/branches/route.ts`**
   - GET: `authenticateRequest`, all authenticated users, filters by `auth.user.companyId`
   - POST: `authenticateRequest` + `isCompanyAdmin` check, `safeValidate(branchCreateSchema)`, companyId from token only, sanitization, `BRANCH_CREATED` audit log

4. **`src/app/api/branches/[id]/route.ts`**
   - GET: `authenticateRequest`, verifies branch.companyId === auth.user.companyId
   - PUT: `authenticateRequest` + `isCompanyAdmin` check, `safeValidate(branchUpdateSchema)`, ownership verification, sanitization, `BRANCH_UPDATED` audit log
   - DELETE: `authenticateRequest` + `isCompanyAdmin` check, ownership verification, `BRANCH_DEACTIVATED` audit log

5. **`src/app/api/notifications/route.ts`**
   - GET: `authenticateRequest`, all authenticated users, companyId from token only
   - PUT: `authenticateRequest`, any user can mark as read, `safeValidate(notificationUpdateSchema)` for markRead, companyId from token only, `NOTIFICATION_READ` audit log

## Security Rules Enforced
- **companyId ALWAYS from auth token** — never trusted from request body or query params
- **Branch management**: Admin-only (create, update, delete)
- **Customer management**: Manager+ only (read, create, update, delete)
- **Notifications**: Any authenticated user can view and mark as read
- **Input validation**: Zod schemas via `safeValidate()` on all mutation handlers
- **String sanitization**: `sanitizeString()` on all string inputs
- **Audit logging**: All mutation operations logged with user info, IP, user-agent
- **Company data isolation**: All GET handlers filter by authenticated user's companyId
