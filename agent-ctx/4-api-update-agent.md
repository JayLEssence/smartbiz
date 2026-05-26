---
Task ID: 4
Agent: API Update Agent
Task: Update all API routes for multi-branch support

Work Log:
- Updated /api/auth/login to include branch info (id, name, code, isHeadOffice) and branchId in user response
- Created /api/branches route with GET (list all branches with counts) and POST (create new branch)
- Created /api/branches/[id] route with GET (single branch details), PUT (update branch), DELETE (soft delete)
- Updated /api/products with branchId query filter, includeInactive toggle, trending calculation (last 7d vs previous 7d), PUT handler, DELETE handler (soft delete with trending info)
- Updated /api/inventory with branchId query filter and branchId in POST body
- Updated /api/sales with branchId query filter and branchId in POST body (falls back to user's branch)
- Updated /api/shrinkage with branchId query filter and branchId in POST body (falls back to product's branch)
- Updated /api/analytics/dashboard with branchId filter and branchSummary for cross-branch view
- Updated /api/analytics/best-sellers with branchId filter on sales
- Updated /api/analytics/trends with branchId filter on sales and product category queries
- Updated /api/analytics/dead-stock with branchId filter, includes branchId in response
- Updated /api/analytics/loss-report with branchId filter and lossByBranch cross-branch breakdown
- Updated /api/advisor/recommendations with branchId filter on all data queries
- Regenerated Prisma Client after schema changes
- All routes return branch info (id, name, code) in included relations
- Lint passes with zero errors
- Tested login API - returns branch info correctly
- Tested branches API - returns 3 branches with counts

Stage Summary:
- All 13 API route files updated for multi-branch support + 2 new branch route files created
- branchId query parameter added to all GET endpoints for filtering
- branchId accepted in POST bodies for sales, inventory, shrinkage (with fallbacks)
- Products API now includes trending field (up/down/stable/new/no-sales) comparing last 7 days vs previous 7 days
- Products API now supports PUT (update product details) and DELETE (soft delete with trending info)
- Branch routes support full CRUD with soft delete
- Dashboard returns branchSummary when no branchId filter is applied
- Loss report returns lossByBranch breakdown when no branchId filter is applied
