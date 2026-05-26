# Task 6 - Frontend Access Control Agent

## Task: Update all frontend views with company/branch context and proper access control

## Summary
Implemented comprehensive role-based access control (RBAC) across all 15+ frontend components, with companyId passed to all API calls for proper multi-tenant data isolation, and Employee branch locking enforced at the store level.

## Key Changes

### Role Definitions Enforced:
- **CompanyAdmin**: Full access to all views (POS, Dashboard, Inventory, Shrinkage, Analytics, Advisor, Branches, Admin)
- **Manager**: Access to POS, Dashboard, Inventory, Shrinkage, Analytics (blocked from Advisor, Branches, Admin)
- **Employee**: Access to POS and Dashboard only (blocked from all management views)

### Files Modified (17 total):

1. **app-store.ts**: Employee auto-lock to branch in setUser/setCurrentBranchId
2. **app-header.tsx**: Branch selector hidden for Employee; "All Branches" only for CompanyAdmin
3. **app-sidebar.tsx**: Role-filtered nav items with adminOnly/managerOnly flags
4. **page.tsx**: AccessDenied component + role-based view routing
5. **pos-view.tsx**: companyId added to API calls
6. **checkout-dialog.tsx**: companyId in sale POST body
7. **product-search.tsx**: companyId prop for product searches
8. **inventory-view.tsx**: companyId + role-based tab visibility (Stock In/Add Product hidden for Employee)
9. **add-product-form.tsx**: companyId in product creation
10. **stock-in-form.tsx**: companyId prop + passes to API
11. **product-list.tsx**: companyId prop + delete button only for Manager+
12. **shrinkage-view.tsx**: companyId in all API calls
13. **dashboard-view.tsx**: companyId in dashboard API call
14. **analytics-view.tsx**: companyId + passed to sub-charts
15. **best-sellers-chart.tsx**: companyId prop
16. **sales-trend-chart.tsx**: companyId prop
17. **dead-stock-list.tsx**: companyId prop
18. **advisor-view.tsx**: companyId in recommendations API
19. **branches-view.tsx**: companyId in branches fetch

### Access Control Pattern:
```typescript
// In page.tsx renderView()
const isEmployee = currentUser?.role === 'Employee'
const isAdmin = currentUser?.role === 'CompanyAdmin'

case 'inventory':
  if (isEmployee) return <AccessDenied message="..." />
  return <InventoryView />
case 'advisor':
  if (!isAdmin) return <AccessDenied message="..." />
  return <AdvisorView />
```

### companyId Passing Pattern:
```typescript
const companyId = currentUser?.companyId
const params = new URLSearchParams()
if (companyId) params.set('companyId', companyId)
if (currentBranchId) params.set('branchId', currentBranchId)
```

## Lint: Zero errors
## Dev Server: Compiling successfully
