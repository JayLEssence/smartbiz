'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/auth-fetch'
import { useAppStore } from '@/stores/app-store'
import { useCurrency } from '@/hooks/use-currency'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Users,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Star,
  RefreshCw,
  ShieldAlert,
  Search,
  AlertTriangle,
  DollarSign,
  Award,
} from 'lucide-react'

interface CustomerData {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  loyaltyPoints: number
  creditBalance: number
  creditLimit: number
  branchId: string
  companyId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  branch: {
    id: string
    name: string
    code: string
  }
}

interface CustomerForm {
  name: string
  email: string
  phone: string
  address: string
  creditLimit: number
  branchId: string
}

interface SummaryData {
  totalCustomers: number
  totalCreditOutstanding: number
  totalLoyaltyPoints: number
}

const emptyForm: CustomerForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  creditLimit: 0,
  branchId: '',
}

export function CustomersView() {
  const isMobile = useIsMobile()
  const { t } = useLanguage()
  const { currentUser, currentBranchId, branches } = useAppStore()
  const { formatDual } = useCurrency()

  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [summary, setSummary] = useState<SummaryData>({
    totalCustomers: 0,
    totalCreditOutstanding: 0,
    totalLoyaltyPoints: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterBranchId, setFilterBranchId] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null)

  // Form states
  const [addForm, setAddForm] = useState<CustomerForm>(emptyForm)
  const [editForm, setEditForm] = useState<CustomerForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const isEmployee = currentUser?.role === 'Employee'
  const isManager = currentUser?.role === 'Manager'
  const isAdmin = currentUser?.role === 'CompanyAdmin'
  const companyId = currentUser?.companyId

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (companyId) params.set('companyId', companyId)
      if (filterBranchId && filterBranchId !== 'all') params.set('branchId', filterBranchId)
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (showInactive) params.set('includeInactive', 'true')

      const res = await apiGet(`/api/customers?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setCustomers(json.data)
        if (json.summary) {
          setSummary(json.summary)
        }
      }
    } catch {
      toast.error(t('customers.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [companyId, filterBranchId, searchQuery, showInactive, t])

  useEffect(() => {
    if (!isEmployee) {
      fetchCustomers()
    }
  }, [isEmployee, fetchCustomers])

  // Access denied for Employee users
  if (isEmployee) {
    return (
      <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <ShieldAlert className="h-16 w-16 opacity-30" />
          <h2 className="text-xl font-semibold">{t('customers.accessDenied')}</h2>
          <p className="text-sm text-center max-w-sm">
            {t('customers.managerOnlyAccess')}
          </p>
        </div>
      </div>
    )
  }

  const handleAddCustomer = async () => {
    if (!addForm.name.trim()) {
      toast.error(t('customers.nameRequired'))
      return
    }

    const targetBranchId = addForm.branchId || (currentBranchId ?? '')

    if (!targetBranchId) {
      toast.error(t('customers.selectBranch'))
      return
    }

    setSubmitting(true)
    try {
      const res = await apiPost('/api/customers', {
          name: addForm.name.trim(),
          email: addForm.email.trim() || undefined,
          phone: addForm.phone.trim() || undefined,
          address: addForm.address.trim() || undefined,
          creditLimit: addForm.creditLimit || 0,
          branchId: targetBranchId,
          companyId: companyId,
        })
      const json = await res.json()

      if (json.success) {
        toast.success(t('customers.customerCreated'))
        setAddDialogOpen(false)
        setAddForm(emptyForm)
        fetchCustomers()
      } else {
        toast.error(json.error || t('customers.failedToCreate'))
      }
    } catch {
      toast.error(t('customers.failedToCreate'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditCustomer = async () => {
    if (!selectedCustomer || !editForm.name.trim()) {
      toast.error(t('customers.nameRequired'))
      return
    }

    setSubmitting(true)
    try {
      const res = await apiPut(`/api/customers/${selectedCustomer.id}`, {
          name: editForm.name.trim(),
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
          creditLimit: editForm.creditLimit,
        })
      const json = await res.json()

      if (json.success) {
        toast.success(t('customers.customerUpdated'))
        setEditDialogOpen(false)
        setSelectedCustomer(null)
        setEditForm(emptyForm)
        fetchCustomers()
      } else {
        toast.error(json.error || t('customers.failedToUpdate'))
      }
    } catch {
      toast.error(t('customers.failedToUpdate'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivateCustomer = async () => {
    if (!selectedCustomer) return

    setSubmitting(true)
    try {
      const res = await apiDelete(`/api/customers/${selectedCustomer.id}`)
      const json = await res.json()

      if (json.success) {
        toast.success(t('customers.customerDeactivated'))
        setDeactivateDialogOpen(false)
        setSelectedCustomer(null)
        fetchCustomers()
      } else {
        toast.error(json.error || t('customers.failedToDeactivate'))
      }
    } catch {
      toast.error(t('customers.failedToDeactivate'))
    } finally {
      setSubmitting(false)
    }
  }

  const openEditDialog = (customer: CustomerData) => {
    setSelectedCustomer(customer)
    setEditForm({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      creditLimit: customer.creditLimit,
      branchId: customer.branchId,
    })
    setEditDialogOpen(true)
  }

  const openDeactivateDialog = (customer: CustomerData) => {
    setSelectedCustomer(customer)
    setDeactivateDialogOpen(true)
  }

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-emerald-600" />
          <h1 className="text-xl font-bold">{t('customers.customerManagement')}</h1>
        </div>
        <Button
          onClick={() => {
            setAddForm({
              ...emptyForm,
              branchId: currentBranchId ?? '',
            })
            setAddDialogOpen(true)
          }}
          className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {t('customers.addCustomer')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('customers.totalCustomers')}</p>
                <p className="text-2xl font-bold">{summary.totalCustomers ?? 0}</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('customers.creditOutstanding')}</p>
                <p className="text-2xl font-bold">{formatDual(summary.totalCreditOutstanding ?? 0)}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                (summary.totalCreditOutstanding ?? 0) > 0
                  ? 'bg-red-50 text-red-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}>
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('customers.loyaltyPoints')}</p>
                <p className="text-2xl font-bold">{(summary.totalLoyaltyPoints ?? 0).toLocaleString()}</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Star className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('customers.searchCustomers')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          {(isAdmin || isManager) && (
            <Select
              value={filterBranchId}
              onValueChange={setFilterBranchId}
            >
              <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                <SelectValue placeholder={t('customers.allBranches')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('customers.allBranches')}</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-2">
            <Switch
              checked={showInactive}
              onCheckedChange={setShowInactive}
              id="show-inactive"
            />
            <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
              {t('customers.showInactive')}
            </Label>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={fetchCustomers}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Customer Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <Users className="h-16 w-16 opacity-30" />
          <h3 className="text-lg font-medium">{t('customers.noCustomers')}</h3>
          <p className="text-sm">
            {searchQuery
              ? t('customers.tryAdjusting')
              : t('customers.createFirst')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((customer) => (
            <Card
              key={customer.id}
              className={`relative overflow-hidden transition-shadow hover:shadow-md ${
                !customer.isActive ? 'opacity-70' : ''
              }`}
            >
              {/* Credit warning accent bar */}
              {(customer.creditBalance ?? 0) > 0 && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
              )}

              <CardContent className="pt-5 pb-4 px-4">
                {/* Customer Name & Badges */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base truncate">
                        {customer.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {customer.loyaltyPoints > 0 && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs gap-1">
                          <Star className="h-3 w-3" />
                          {(customer.loyaltyPoints ?? 0).toLocaleString()} {t('customers.points')}
                        </Badge>
                      )}
                      {!customer.isActive && (
                        <Badge variant="destructive" className="text-xs">
                          {t('customers.inactive')}
                        </Badge>
                      )}
                      {customer.isActive && (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                          {t('customers.active')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(customer)}
                      title={t('customers.editCustomer')}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    {customer.isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDeactivateDialog(customer)}
                        title={t('customers.deactivateCustomer')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-1.5 mb-3 text-sm">
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{customer.address}</span>
                    </div>
                  )}
                </div>

                {/* Credit & Loyalty Info */}
                <div className="space-y-2">
                  {/* Credit Balance - prominent display */}
                  <div className={`rounded-lg p-3 ${
                    (customer.creditBalance ?? 0) > 0
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-emerald-50/50 border border-emerald-100'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium flex items-center gap-1.5">
                        <CreditCard className={`h-3.5 w-3.5 ${
                          (customer.creditBalance ?? 0) > 0 ? 'text-red-500' : 'text-emerald-500'
                        }`} />
                        {t('customers.creditBalance')}
                      </span>
                      {(customer.creditBalance ?? 0) > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t('customers.creditWarning')}
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm font-bold ${
                      (customer.creditBalance ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}>
                      {formatDual(customer.creditBalance ?? 0)}
                    </p>
                  </div>

                  {/* Credit Limit & Loyalty side by side */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/50 py-2 px-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{t('customers.creditLimit')}</span>
                      </div>
                      <p className="text-xs font-semibold">
                        {formatDual(customer.creditLimit ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 py-2 px-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Award className="h-3 w-3 text-amber-600" />
                        <span className="text-xs text-muted-foreground">{t('customers.loyaltyPoints')}</span>
                      </div>
                      <p className="text-xs font-semibold">
                        {(customer.loyaltyPoints ?? 0).toLocaleString()} {t('customers.points')}
                      </p>
                    </div>
                  </div>

                  {/* Branch info */}
                  {customer.branch && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                      <MapPin className="h-3 w-3" />
                      <span>{customer.branch.name}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              {t('customers.addNewCustomer')}
            </DialogTitle>
            <DialogDescription>
              {t('customers.createCustomerExplanation')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-name">
                {t('customers.name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-name"
                placeholder="John Doe"
                value={addForm.name}
                onChange={(e) =>
                  setAddForm({ ...addForm, name: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="add-phone">{t('customers.phone')}</Label>
                <Input
                  id="add-phone"
                  placeholder={t('customers.phonePlaceholder')}
                  value={addForm.phone}
                  onChange={(e) =>
                    setAddForm({ ...addForm, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-email">{t('customers.email')}</Label>
                <Input
                  id="add-email"
                  type="email"
                  placeholder={t('customers.emailPlaceholder')}
                  value={addForm.email}
                  onChange={(e) =>
                    setAddForm({ ...addForm, email: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-address">{t('customers.address')}</Label>
              <Input
                id="add-address"
                placeholder={t('customers.addressPlaceholder')}
                value={addForm.address}
                onChange={(e) =>
                  setAddForm({ ...addForm, address: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="add-creditLimit">{t('customers.creditLimit')}</Label>
                <Input
                  id="add-creditLimit"
                  type="number"
                  min="0"
                  placeholder={t('customers.creditLimitPlaceholder')}
                  value={addForm.creditLimit || ''}
                  onChange={(e) =>
                    setAddForm({ ...addForm, creditLimit: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              {(isAdmin || isManager) && branches.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="add-branch">{t('customers.branch')}</Label>
                  <Select
                    value={addForm.branchId || currentBranchId || ''}
                    onValueChange={(val) => setAddForm({ ...addForm, branchId: val })}
                  >
                    <SelectTrigger id="add-branch">
                      <SelectValue placeholder={t('customers.selectBranch')} />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={submitting}
            >
              {t('customers.cancel')}
            </Button>
            <Button
              onClick={handleAddCustomer}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? t('customers.creating') : t('customers.createCustomer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-emerald-600" />
              {t('customers.editCustomer')}
            </DialogTitle>
            <DialogDescription>
              {t('customers.updateCustomerInfo')}{' '}
              <span className="font-semibold text-foreground">
                {selectedCustomer?.name}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                {t('customers.name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="Customer name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">{t('customers.phone')}</Label>
                <Input
                  id="edit-phone"
                  placeholder={t('customers.phonePlaceholder')}
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">{t('customers.email')}</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder={t('customers.emailPlaceholder')}
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">{t('customers.address')}</Label>
              <Input
                id="edit-address"
                placeholder={t('customers.addressPlaceholder')}
                value={editForm.address}
                onChange={(e) =>
                  setEditForm({ ...editForm, address: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-creditLimit">{t('customers.creditLimit')}</Label>
              <Input
                id="edit-creditLimit"
                type="number"
                min="0"
                placeholder={t('customers.creditLimitPlaceholder')}
                value={editForm.creditLimit || ''}
                onChange={(e) =>
                  setEditForm({ ...editForm, creditLimit: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            {/* Show current branch (read-only in edit) */}
            {selectedCustomer?.branch && (
              <div className="space-y-2">
                <Label>{t('customers.branch')}</Label>
                <Input
                  value={selectedCustomer.branch.name}
                  disabled
                  className="bg-muted"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={submitting}
            >
              {t('customers.cancel')}
            </Button>
            <Button
              onClick={handleEditCustomer}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? t('customers.saving') : t('customers.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              {t('customers.deactivateCustomer')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('customers.deactivateExplanation')}{' '}
              <span className="font-semibold text-foreground">
                {selectedCustomer?.name}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedCustomer && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-red-500" />
                  <span>{t('customers.creditBalance')}: <strong>{formatDual(selectedCustomer.creditBalance ?? 0)}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  <span>{(selectedCustomer.loyaltyPoints ?? 0).toLocaleString()} {t('customers.points')}</span>
                </div>
              </div>
              {(selectedCustomer.creditBalance ?? 0) > 0 && (
                <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  This customer has outstanding credit balance.
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{t('customers.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateCustomer}
              disabled={submitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {submitting ? t('customers.deactivating') : t('customers.deactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
