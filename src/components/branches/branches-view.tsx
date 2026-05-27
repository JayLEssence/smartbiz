'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Building2,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Users,
  Package,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Search,
} from 'lucide-react'

interface BranchData {
  id: string
  name: string
  code: string
  address: string | null
  phone: string | null
  isHeadOffice: boolean
  isActive: boolean
  _count: {
    users: number
    products: number
    sales: number
  }
}

interface BranchForm {
  name: string
  code: string
  address: string
  phone: string
  isHeadOffice: boolean
}

const emptyForm: BranchForm = {
  name: '',
  code: '',
  address: '',
  phone: '',
  isHeadOffice: false,
}

export function BranchesView() {
  const isMobile = useIsMobile()
  const { currentUser } = useAppStore()

  const [branches, setBranches] = useState<BranchData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(true)

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<BranchData | null>(null)

  // Form states
  const [addForm, setAddForm] = useState<BranchForm>(emptyForm)
  const [editForm, setEditForm] = useState<BranchForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = currentUser?.role === 'CompanyAdmin'

  const companyId = currentUser?.companyId

  const fetchBranches = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ includeInactive: String(showInactive) })
      if (companyId) params.set('companyId', companyId)
      const res = await fetch(`/api/branches?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setBranches(json.data)
      }
    } catch {
      toast.error('Failed to load branches')
    } finally {
      setLoading(false)
    }
  }, [showInactive, companyId])

  useEffect(() => {
    if (isAdmin) {
      fetchBranches()
    }
  }, [isAdmin, fetchBranches])

  // Access denied for non-admin users
  if (!isAdmin) {
    return (
      <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <ShieldAlert className="h-16 w-16 opacity-30" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-sm text-center max-w-sm">
            Only administrators can manage branches. Please contact your system
            administrator if you need access.
          </p>
        </div>
      </div>
    )
  }

  const handleAddBranch = async () => {
    if (!addForm.name.trim() || !addForm.code.trim()) {
      toast.error('Branch name and code are required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          code: addForm.code.trim(),
          address: addForm.address.trim() || undefined,
          phone: addForm.phone.trim() || undefined,
          isHeadOffice: addForm.isHeadOffice,
          companyId: companyId,
        }),
      })
      const json = await res.json()

      if (json.success) {
        toast.success(`Branch "${addForm.name}" created successfully`)
        setAddDialogOpen(false)
        setAddForm(emptyForm)
        fetchBranches()
      } else {
        toast.error(json.error || 'Failed to create branch')
      }
    } catch {
      toast.error('Failed to create branch')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditBranch = async () => {
    if (!selectedBranch || !editForm.name.trim()) {
      toast.error('Branch name is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/branches/${selectedBranch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          address: editForm.address.trim() || null,
          phone: editForm.phone.trim() || null,
        }),
      })
      const json = await res.json()

      if (json.success) {
        toast.success(`Branch "${editForm.name}" updated successfully`)
        setEditDialogOpen(false)
        setSelectedBranch(null)
        setEditForm(emptyForm)
        fetchBranches()
      } else {
        toast.error(json.error || 'Failed to update branch')
      }
    } catch {
      toast.error('Failed to update branch')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivateBranch = async () => {
    if (!selectedBranch) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/branches/${selectedBranch.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (json.success) {
        toast.success(`Branch "${selectedBranch.name}" deactivated`)
        setDeleteDialogOpen(false)
        setSelectedBranch(null)
        fetchBranches()
      } else {
        toast.error(json.error || 'Failed to deactivate branch')
      }
    } catch {
      toast.error('Failed to deactivate branch')
    } finally {
      setSubmitting(false)
    }
  }

  const openEditDialog = (branch: BranchData) => {
    setSelectedBranch(branch)
    setEditForm({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      phone: branch.phone || '',
      isHeadOffice: branch.isHeadOffice,
    })
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (branch: BranchData) => {
    setSelectedBranch(branch)
    setDeleteDialogOpen(true)
  }

  // Filter branches by search query
  const filteredBranches = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.address && b.address.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-emerald-600" />
          <h1 className="text-xl font-bold">Branch Management</h1>
        </div>
        <Button
          onClick={() => {
            setAddForm(emptyForm)
            setAddDialogOpen(true)
          }}
          className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Branch
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search branches by name, code, or address..."
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
              id="show-inactive"
            />
            <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
              Show inactive
            </Label>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={fetchBranches}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Branch Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <Building2 className="h-16 w-16 opacity-30" />
          <h3 className="text-lg font-medium">No branches found</h3>
          <p className="text-sm">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Create your first branch to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredBranches.map((branch) => (
            <Card
              key={branch.id}
              className={`relative overflow-hidden transition-shadow hover:shadow-md ${
                !branch.isActive ? 'opacity-70' : ''
              }`}
            >
              {/* Head office accent bar */}
              {branch.isHeadOffice && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
              )}

              <CardContent className="pt-5 pb-4 px-4">
                {/* Branch Name & Badges */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base truncate">
                        {branch.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-xs font-mono bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        {branch.code}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {branch.isHeadOffice && (
                        <Badge className="bg-emerald-600 text-white text-xs">
                          Head Office
                        </Badge>
                      )}
                      {!branch.isActive && (
                        <Badge variant="destructive" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(branch)}
                      title="Edit branch"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    {branch.isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(branch)}
                        title="Deactivate branch"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Address & Phone */}
                <div className="space-y-1.5 mb-4 text-sm">
                  {branch.address && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center rounded-lg bg-muted/50 py-2 px-1">
                    <Users className="h-3.5 w-3.5 text-emerald-600 mb-1" />
                    <span className="text-sm font-semibold">
                      {branch._count.users}
                    </span>
                    <span className="text-xs text-muted-foreground">Users</span>
                  </div>
                  <div className="flex flex-col items-center rounded-lg bg-muted/50 py-2 px-1">
                    <Package className="h-3.5 w-3.5 text-teal-600 mb-1" />
                    <span className="text-sm font-semibold">
                      {branch._count.products}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Products
                    </span>
                  </div>
                  <div className="flex flex-col items-center rounded-lg bg-muted/50 py-2 px-1">
                    <Receipt className="h-3.5 w-3.5 text-stone-600 mb-1" />
                    <span className="text-sm font-semibold">
                      {branch._count.sales}
                    </span>
                    <span className="text-xs text-muted-foreground">Sales</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Branch Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              Add New Branch
            </DialogTitle>
            <DialogDescription>
              Create a new branch location for your retail business.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="add-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-name"
                  placeholder="Branch name"
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm({ ...addForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-code">
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-code"
                  placeholder="e.g. NY01"
                  value={addForm.code}
                  onChange={(e) =>
                    setAddForm({ ...addForm, code: e.target.value.toUpperCase() })
                  }
                  className="uppercase"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-address">Address</Label>
              <Input
                id="add-address"
                placeholder="Street address"
                value={addForm.address}
                onChange={(e) =>
                  setAddForm({ ...addForm, address: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-phone">Phone</Label>
              <Input
                id="add-phone"
                placeholder="Phone number"
                value={addForm.phone}
                onChange={(e) =>
                  setAddForm({ ...addForm, phone: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="add-headoffice"
                checked={addForm.isHeadOffice}
                onCheckedChange={(checked) =>
                  setAddForm({ ...addForm, isHeadOffice: checked })
                }
              />
              <Label htmlFor="add-headoffice" className="cursor-pointer">
                This is the head office
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddBranch}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? 'Creating...' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-emerald-600" />
              Edit Branch
            </DialogTitle>
            <DialogDescription>
              Update branch information for {selectedBranch?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="Branch name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-code">Code</Label>
              <Input
                id="edit-code"
                value={editForm.code}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Branch code cannot be changed after creation.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                placeholder="Street address"
                value={editForm.address}
                onChange={(e) =>
                  setEditForm({ ...editForm, address: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                placeholder="Phone number"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
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
              Cancel
            </Button>
            <Button
              onClick={handleEditBranch}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Deactivate Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Deactivate Branch
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate{' '}
              <span className="font-semibold text-foreground">
                {selectedBranch?.name}
              </span>{' '}
              ({selectedBranch?.code}). Deactivating a branch will prevent its
              data from showing in regular views.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedBranch && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium mb-2">Branch data that will be hidden:</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{selectedBranch._count.users} users</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-teal-600" />
                  <span>{selectedBranch._count.products} products</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-stone-600" />
                  <span>{selectedBranch._count.sales} sales</span>
                </div>
              </div>
              {selectedBranch.isHeadOffice && (
                <p className="text-xs text-amber-600 font-medium mt-1">
                  Warning: This is the head office branch.
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateBranch}
              disabled={submitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {submitting ? 'Deactivating...' : 'Deactivate Branch'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
