'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Receipt,
  Plus,
  Loader2,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  DollarSign,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/stores/app-store'
import { useCurrency } from '@/hooks/use-currency'
import { useLanguage } from '@/lib/i18n/language-context'

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Maintenance', 'Other'] as const
type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Rent: 'bg-blue-100 text-blue-700 border-blue-200',
  Utilities: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Salaries: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Transport: 'bg-orange-100 text-orange-700 border-orange-200',
  Supplies: 'bg-purple-100 text-purple-700 border-purple-200',
  Maintenance: 'bg-red-100 text-red-700 border-red-200',
  Other: 'bg-gray-100 text-gray-700 border-gray-200',
}

const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  Rent: '🏠',
  Utilities: '💡',
  Salaries: '👥',
  Transport: '🚚',
  Supplies: '📦',
  Maintenance: '🔧',
  Other: '📋',
}

interface ExpenseRecord {
  id: string
  category: string
  description: string
  amount: number
  date: string
  branchId: string
  companyId: string
  receiptUrl: string | null
  createdAt: string
  updatedAt: string
  branch: {
    id: string
    name: string
    code: string
  }
}

interface ExpenseSummary {
  totalThisMonth: number
  byCategory: Record<string, number>
}

interface ExpenseListResponse {
  success: boolean
  data: ExpenseRecord[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  summary: ExpenseSummary
}

interface FormData {
  category: string
  description: string
  amount: string
  date: string
  branchId: string
}

const emptyForm: FormData = {
  category: '',
  description: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  branchId: '',
}

export function ExpensesView() {
  const isMobile = useIsMobile()
  const { currentBranchId, currentUser, branches } = useAppStore()
  const { formatDual, formatLocal } = useCurrency()
  const { t } = useLanguage()
  const companyId = currentUser?.companyId
  const isAdmin = currentUser?.role === 'CompanyAdmin'

  // Data state
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [summary, setSummary] = useState<ExpenseSummary>({ totalThisMonth: 0, byCategory: {} })
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, hasMore: false })
  const [page, setPage] = useState(0)

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (companyId) params.set('companyId', companyId)
      if (currentBranchId) params.set('branchId', currentBranchId)
      if (filterCategory && filterCategory !== 'all') params.set('category', filterCategory)
      if (filterDateFrom) params.set('dateFrom', new Date(filterDateFrom).toISOString())
      if (filterDateTo) params.set('dateTo', new Date(filterDateTo).toISOString())
      params.set('limit', String(pagination.limit))
      params.set('offset', String(page * pagination.limit))

      const res = await fetch(`/api/expenses?${params.toString()}`)
      const json: ExpenseListResponse = await res.json()
      if (json.success) {
        setExpenses(json.data)
        setPagination(json.pagination)
        setSummary(json.summary)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [companyId, currentBranchId, filterCategory, filterDateFrom, filterDateTo, page, pagination.limit])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [filterCategory, filterDateFrom, filterDateTo, currentBranchId])

  const openAddDialog = () => {
    setEditingExpense(null)
    setFormData({
      ...emptyForm,
      date: new Date().toISOString().split('T')[0],
      branchId: currentBranchId ?? (branches[0]?.id ?? ''),
    })
    setDialogOpen(true)
  }

  const openEditDialog = (expense: ExpenseRecord) => {
    setEditingExpense(expense)
    setFormData({
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
      date: new Date(expense.date).toISOString().split('T')[0],
      branchId: expense.branchId,
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.category || !formData.description || !formData.amount || !formData.branchId) {
      toast.error('Please fill in all required fields')
      return
    }

    if (Number(formData.amount) <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    setSubmitting(true)
    try {
      if (editingExpense) {
        // Update
        const res = await fetch(`/api/expenses/${editingExpense.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: formData.category,
            description: formData.description,
            amount: Number(formData.amount),
            date: formData.date,
            branchId: formData.branchId,
          }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success('Expense updated successfully')
          setDialogOpen(false)
          fetchExpenses()
        } else {
          toast.error('Failed to update expense', { description: json.error })
        }
      } else {
        // Create
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: formData.category,
            description: formData.description,
            amount: Number(formData.amount),
            date: formData.date,
            branchId: formData.branchId,
            companyId: companyId,
          }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success('Expense recorded successfully')
          if (Number(formData.amount) > 1000000) {
            toast.info('Large expense alert notification created', {
              description: 'Amount exceeds 1,000,000 threshold',
            })
          }
          setDialogOpen(false)
          fetchExpenses()
        } else {
          toast.error('Failed to record expense', { description: json.error })
        }
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/expenses/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('Expense deleted successfully')
        setDeleteTarget(null)
        fetchExpenses()
      } else {
        toast.error('Failed to delete expense', { description: json.error })
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const getCategoryBadge = (category: string) => {
    const cat = category as ExpenseCategory
    const colorClass = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other
    return (
      <Badge className={`${colorClass} text-xs font-medium`}>
        {CATEGORY_ICONS[cat] || '📋'} {category}
      </Badge>
    )
  }

  // Filter expenses by search query (client-side)
  const filteredExpenses = searchQuery
    ? expenses.filter(
        (e) =>
          e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.branch.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : expenses

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-6'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
            <Receipt className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Expense Tracking</h1>
            <p className="text-sm text-muted-foreground">
              Manage and track business expenses
            </p>
          </div>
        </div>
        <Button
          onClick={openAddDialog}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          {isMobile ? 'Add' : 'Add Expense'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total This Month</p>
                <p className="text-lg font-bold text-red-600">
                  {formatLocal(summary.totalThisMonth)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDual(summary.totalThisMonth)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top categories */}
        {Object.entries(summary.byCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([category, amount]) => (
            <Card key={category}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <span className="text-lg">
                      {CATEGORY_ICONS[category as ExpenseCategory] || '📋'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{category}</p>
                    <p className="text-lg font-bold truncate">
                      {formatLocal(amount)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDual(amount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Category Breakdown (mobile-friendly) */}
      {Object.keys(summary.byCategory).length > 3 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Category Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">
                        {CATEGORY_ICONS[category as ExpenseCategory] || '📋'}
                      </span>
                      <span className="text-sm font-medium truncate">{category}</span>
                    </div>
                    <span className="text-sm font-semibold shrink-0 ml-2">
                      {formatLocal(amount)}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Bar */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select
              value={filterCategory}
              onValueChange={setFilterCategory}
            >
              <SelectTrigger className="h-9 w-full sm:w-[160px] text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_ICONS[cat]} {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="h-9 text-sm w-full sm:w-auto"
              placeholder="From"
            />
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="h-9 text-sm w-full sm:w-auto"
              placeholder="To"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={fetchExpenses}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expenses List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Expenses ({pagination.total})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-muted animate-pulse rounded-lg"
                />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No expenses found</p>
              <p className="text-xs mt-1">
                {searchQuery || filterCategory !== 'all' || filterDateFrom || filterDateTo
                  ? 'Try adjusting your filters'
                  : 'Click "Add Expense" to record your first expense'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              {!isMobile && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="pb-3 text-xs font-medium text-muted-foreground">Category</th>
                        <th className="pb-3 text-xs font-medium text-muted-foreground">Description</th>
                        <th className="pb-3 text-xs font-medium text-muted-foreground">Branch</th>
                        <th className="pb-3 text-xs font-medium text-muted-foreground text-right">Amount</th>
                        <th className="pb-3 text-xs font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3 text-sm">
                            {new Date(expense.date).toLocaleDateString()}
                          </td>
                          <td className="py-3">
                            {getCategoryBadge(expense.category)}
                          </td>
                          <td className="py-3 text-sm max-w-[200px] truncate">
                            {expense.description}
                          </td>
                          <td className="py-3 text-sm text-muted-foreground">
                            {expense.branch?.name ?? '—'}
                          </td>
                          <td className="py-3 text-right">
                            <p className="text-sm font-semibold">
                              {formatLocal(expense.amount)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDual(expense.amount)}
                            </p>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(expense)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteTarget(expense)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mobile Card List */}
              {isMobile && (
                <div className="max-h-[500px] overflow-y-auto space-y-3">
                  {filteredExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-start justify-between p-4 rounded-lg border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getCategoryBadge(expense.category)}
                          <span className="text-xs text-muted-foreground">
                            {new Date(expense.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate">
                          {expense.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {expense.branch?.name ?? '—'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end shrink-0 ml-3">
                        <p className="text-sm font-bold">
                          {formatLocal(expense.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDual(expense.amount)}
                        </p>
                        <div className="flex items-center gap-1 mt-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(expense)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteTarget(expense)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    Showing {page * pagination.limit + 1}–{Math.min((page + 1) * pagination.limit, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              {editingExpense ? 'Edit Expense' : 'Add Expense'}
            </DialogTitle>
            <DialogDescription>
              {editingExpense
                ? 'Update the expense details below.'
                : 'Fill in the details to record a new expense.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_ICONS[cat]} {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Description *</Label>
              <Input
                placeholder="Brief description of the expense"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Amount *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  className="text-sm"
                />
                {formData.amount && Number(formData.amount) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ≈ {formatDual(Number(formData.amount))}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="text-sm"
                />
              </div>
            </div>

            {isAdmin && branches.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Branch *</Label>
                <Select
                  value={formData.branchId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, branchId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {Number(formData.amount) > 1000000 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-base">⚠️</span>
                <p className="text-xs text-amber-700">
                  This expense exceeds 1,000,000 and will trigger a notification alert.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingExpense ? (
                'Update Expense'
              ) : (
                'Record Expense'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
              {deleteTarget && (
                <span className="block mt-2 font-medium text-foreground">
                  {deleteTarget.description} — {formatLocal(deleteTarget.amount)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
