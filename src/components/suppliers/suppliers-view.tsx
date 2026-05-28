'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/auth-fetch'
import { useAppStore } from '@/stores/app-store'
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
  Truck,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
  ShieldAlert,
  Search,
  Package,
} from 'lucide-react'

interface SupplierData {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  companyId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: {
    inventoryBatches: number
  }
}

interface SupplierForm {
  name: string
  email: string
  phone: string
  address: string
}

const emptyForm: SupplierForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
}

export function SuppliersView() {
  const isMobile = useIsMobile()
  const { t } = useLanguage()
  const { currentUser } = useAppStore()

  const [suppliers, setSuppliers] = useState<SupplierData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierData | null>(null)

  // Form states
  const [addForm, setAddForm] = useState<SupplierForm>(emptyForm)
  const [editForm, setEditForm] = useState<SupplierForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = currentUser?.role === 'CompanyAdmin'
  const companyId = currentUser?.companyId

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ includeInactive: String(showInactive) })
      if (companyId) params.set('companyId', companyId)
      if (searchQuery) params.set('search', searchQuery)
      const res = await apiGet(`/api/suppliers?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setSuppliers(json.data)
      }
    } catch {
      toast.error(t('suppliers.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [showInactive, companyId, searchQuery, t])

  useEffect(() => {
    if (isAdmin) {
      fetchSuppliers()
    }
  }, [isAdmin, fetchSuppliers])

  // Access denied for non-admin users
  if (!isAdmin) {
    return (
      <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <ShieldAlert className="h-16 w-16 opacity-30" />
          <h2 className="text-xl font-semibold">{t('suppliers.accessDenied')}</h2>
          <p className="text-sm text-center max-w-sm">
            {t('suppliers.adminOnlyAccess')}
          </p>
        </div>
      </div>
    )
  }

  const handleAddSupplier = async () => {
    if (!addForm.name.trim()) {
      toast.error(t('suppliers.nameRequired'))
      return
    }

    setSubmitting(true)
    try {
      const res = await apiPost('/api/suppliers', {
          name: addForm.name.trim(),
          email: addForm.email.trim() || undefined,
          phone: addForm.phone.trim() || undefined,
          address: addForm.address.trim() || undefined,
          companyId: companyId,
        })
      const json = await res.json()

      if (json.success) {
        toast.success(t('suppliers.supplierCreated'))
        setAddDialogOpen(false)
        setAddForm(emptyForm)
        fetchSuppliers()
      } else {
        toast.error(json.error || t('suppliers.failedToCreate'))
      }
    } catch {
      toast.error(t('suppliers.failedToCreate'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSupplier = async () => {
    if (!selectedSupplier || !editForm.name.trim()) {
      toast.error(t('suppliers.nameRequired'))
      return
    }

    setSubmitting(true)
    try {
      const res = await apiPut(`/api/suppliers/${selectedSupplier.id}`, {
          name: editForm.name.trim(),
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
        })
      const json = await res.json()

      if (json.success) {
        toast.success(t('suppliers.supplierUpdated'))
        setEditDialogOpen(false)
        setSelectedSupplier(null)
        setEditForm(emptyForm)
        fetchSuppliers()
      } else {
        toast.error(json.error || t('suppliers.failedToUpdate'))
      }
    } catch {
      toast.error(t('suppliers.failedToUpdate'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivateSupplier = async () => {
    if (!selectedSupplier) return

    setSubmitting(true)
    try {
      const res = await apiDelete(`/api/suppliers/${selectedSupplier.id}`)
      const json = await res.json()

      if (json.success) {
        toast.success(t('suppliers.supplierDeactivated'))
        setDeactivateDialogOpen(false)
        setSelectedSupplier(null)
        fetchSuppliers()
      } else {
        toast.error(json.error || t('suppliers.failedToDeactivate'))
      }
    } catch {
      toast.error(t('suppliers.failedToDeactivate'))
    } finally {
      setSubmitting(false)
    }
  }

  const openEditDialog = (supplier: SupplierData) => {
    setSelectedSupplier(supplier)
    setEditForm({
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
    })
    setEditDialogOpen(true)
  }

  const openDeactivateDialog = (supplier: SupplierData) => {
    setSelectedSupplier(supplier)
    setDeactivateDialogOpen(true)
  }

  // Filter suppliers by search query on client side as well
  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q))
    )
  })

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-emerald-600" />
          <h1 className="text-xl font-bold">{t('suppliers.supplierManagement')}</h1>
        </div>
        <Button
          onClick={() => {
            setAddForm(emptyForm)
            setAddDialogOpen(true)
          }}
          className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {t('suppliers.addSupplier')}
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('suppliers.searchSuppliers')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={showInactive}
              onCheckedChange={setShowInactive}
              id="show-inactive-suppliers"
            />
            <Label htmlFor="show-inactive-suppliers" className="text-sm cursor-pointer">
              {t('suppliers.showInactive')}
            </Label>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={fetchSuppliers}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Supplier Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <Truck className="h-16 w-16 opacity-30" />
          <h3 className="text-lg font-medium">{t('suppliers.noSuppliers')}</h3>
          <p className="text-sm">
            {searchQuery
              ? t('suppliers.tryAdjusting')
              : t('suppliers.createFirst')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <Card
              key={supplier.id}
              className={`relative overflow-hidden transition-shadow hover:shadow-md rounded-xl ${
                !supplier.isActive ? 'opacity-70' : ''
              }`}
            >
              {/* Active accent bar */}
              {supplier.isActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
              )}
              {!supplier.isActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-muted-foreground/30" />
              )}

              <CardContent className="pt-5 pb-4 px-4">
                {/* Supplier Name & Badges */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base truncate">
                        {supplier.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {supplier.isActive ? (
                        <Badge className="bg-emerald-600 text-white text-xs">
                          {t('suppliers.active')}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          {t('suppliers.inactive')}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        <Package className="h-3 w-3 mr-1" />
                        {supplier._count?.inventoryBatches ?? 0} {t('suppliers.deliveries').toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(supplier)}
                      title={t('suppliers.editSupplier')}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    {supplier.isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDeactivateDialog(supplier)}
                        title={t('suppliers.deactivateSupplier')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Email, Phone, Address */}
                <div className="space-y-1.5 text-sm">
                  {supplier.email && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{supplier.address}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Supplier Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-emerald-600" />
              {t('suppliers.addNewSupplier')}
            </DialogTitle>
            <DialogDescription>
              {t('suppliers.createSupplierExplanation')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-name">
                {t('suppliers.name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-name"
                placeholder="Supplier name"
                value={addForm.name}
                onChange={(e) =>
                  setAddForm({ ...addForm, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-email">{t('suppliers.email')}</Label>
              <Input
                id="add-email"
                placeholder={t('suppliers.emailPlaceholder')}
                type="email"
                value={addForm.email}
                onChange={(e) =>
                  setAddForm({ ...addForm, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-phone">{t('suppliers.phone')}</Label>
              <Input
                id="add-phone"
                placeholder={t('suppliers.phonePlaceholder')}
                value={addForm.phone}
                onChange={(e) =>
                  setAddForm({ ...addForm, phone: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-address">{t('suppliers.address')}</Label>
              <Input
                id="add-address"
                placeholder={t('suppliers.addressPlaceholder')}
                value={addForm.address}
                onChange={(e) =>
                  setAddForm({ ...addForm, address: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={submitting}
            >
              {t('suppliers.cancel')}
            </Button>
            <Button
              onClick={handleAddSupplier}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? t('suppliers.creating') : t('suppliers.createSupplier')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-emerald-600" />
              {t('suppliers.editSupplier')}
            </DialogTitle>
            <DialogDescription>
              {t('suppliers.updateSupplierInfo')} {selectedSupplier?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                {t('suppliers.name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="Supplier name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">{t('suppliers.email')}</Label>
              <Input
                id="edit-email"
                placeholder={t('suppliers.emailPlaceholder')}
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">{t('suppliers.phone')}</Label>
              <Input
                id="edit-phone"
                placeholder={t('suppliers.phonePlaceholder')}
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">{t('suppliers.address')}</Label>
              <Input
                id="edit-address"
                placeholder={t('suppliers.addressPlaceholder')}
                value={editForm.address}
                onChange={(e) =>
                  setEditForm({ ...editForm, address: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={submitting}
            >
              {t('suppliers.cancel')}
            </Button>
            <Button
              onClick={handleEditSupplier}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? t('suppliers.saving') : t('suppliers.saveChanges')}
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
              {t('suppliers.deactivateSupplier')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('suppliers.supplierDataHidden')}{' '}
              <span className="font-semibold text-foreground">
                {selectedSupplier?.name}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedSupplier && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium mb-2">{t('suppliers.supplierDataHidden')}</p>
              <div className="flex items-center gap-1.5 text-sm">
                <Package className="h-3.5 w-3.5 text-emerald-600" />
                <span>{selectedSupplier._count?.inventoryBatches ?? 0} {t('suppliers.deliveries').toLowerCase()}</span>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{t('suppliers.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateSupplier}
              disabled={submitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {submitting ? t('suppliers.deactivating') : t('suppliers.deactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
