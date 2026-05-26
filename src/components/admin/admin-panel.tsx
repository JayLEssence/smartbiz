'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Settings,
  Building2,
  Users,
  Package,
  ShieldAlert,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Search,
  MapPin,
  Phone,
  Receipt,
  Mail,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  CircleOff,
  Save,
  Crown,
  UserCheck,
  UserX,
} from 'lucide-react'

// ============ Types ============

interface CompanyData {
  id: string
  name: string
  industry: string | null
  email: string | null
  phone: string | null
  address: string | null
  logoUrl: string | null
  plan: string
  isActive: boolean
  _count?: {
    branches: number
    users: number
    products: number
  }
}

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

interface UserData {
  id: string
  email: string
  name: string
  role: string
  branchId: string
  companyId: string
  isActive: boolean
  branch: {
    id: string
    name: string
    code: string
    isHeadOffice: boolean
  }
  _count?: {
    sales: number
  }
}

interface ProductData {
  id: string
  name: string
  sku: string
  barcode: string | null
  category: string
  currentStockLevel: number
  reorderThreshold: number
  defaultSalePrice: number
  branchId: string
  companyId: string
  isActive: boolean
  trending: 'up' | 'down' | 'stable' | 'new' | 'no-sales'
  recentSalesQty: number
  previousSalesQty: number
}

// ============ Helper Components ============

function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case 'CompanyAdmin':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
          <Crown className="h-3 w-3" />
          Admin
        </Badge>
      )
    case 'Manager':
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-1">
          <UserCheck className="h-3 w-3" />
          Manager
        </Badge>
      )
    case 'Employee':
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 gap-1">
          <Users className="h-3 w-3" />
          Employee
        </Badge>
      )
    default:
      return <Badge variant="outline">{role}</Badge>
  }
}

function TrendingBadge({ trending }: { trending: string }) {
  switch (trending) {
    case 'up':
      return (
        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1 text-xs">
          <TrendingUp className="h-3 w-3" />
          Trending Up
        </Badge>
      )
    case 'down':
      return (
        <Badge className="bg-red-50 text-red-600 border-red-200 gap-1 text-xs">
          <TrendingDown className="h-3 w-3" />
          Declining
        </Badge>
      )
    case 'stable':
      return (
        <Badge className="bg-gray-50 text-gray-600 border-gray-200 gap-1 text-xs">
          <Minus className="h-3 w-3" />
          Stable
        </Badge>
      )
    case 'new':
      return (
        <Badge className="bg-teal-50 text-teal-600 border-teal-200 gap-1 text-xs">
          <Sparkles className="h-3 w-3" />
          New
        </Badge>
      )
    case 'no-sales':
      return (
        <Badge className="bg-slate-50 text-slate-500 border-slate-200 gap-1 text-xs">
          <CircleOff className="h-3 w-3" />
          No Sales
        </Badge>
      )
    default:
      return null
  }
}

// ============ Main Component ============

export function AdminPanel() {
  const isMobile = useIsMobile()
  const { currentUser } = useAppStore()

  const companyId = currentUser?.companyId
  const isAdmin = currentUser?.role === 'CompanyAdmin'

  // ============ Company Settings State ============
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [companyLoading, setCompanyLoading] = useState(true)
  const [companyForm, setCompanyForm] = useState({
    name: '',
    industry: '',
    email: '',
    phone: '',
    address: '',
  })
  const [companySaving, setCompanySaving] = useState(false)

  // ============ Branches State ============
  const [branches, setBranches] = useState<BranchData[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [branchSearch, setBranchSearch] = useState('')
  const [addBranchOpen, setAddBranchOpen] = useState(false)
  const [editBranchOpen, setEditBranchOpen] = useState(false)
  const [deactivateBranchOpen, setDeactivateBranchOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<BranchData | null>(null)
  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    isHeadOffice: false,
  })
  const [branchSubmitting, setBranchSubmitting] = useState(false)

  // ============ Users State ============
  const [users, setUsers] = useState<UserData[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [editUserOpen, setEditUserOpen] = useState(false)
  const [deactivateUserOpen, setDeactivateUserOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Employee',
    branchId: '',
  })
  const [userSubmitting, setUserSubmitting] = useState(false)

  // ============ Products State ============
  const [products, setProducts] = useState<ProductData[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productSearch, setProductSearch] = useState('')
  const [productBranchFilter, setProductBranchFilter] = useState<string>('all')
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [deleteProductOpen, setDeleteProductOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null)
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: '',
    currentStockLevel: 0,
    reorderThreshold: 10,
    defaultSalePrice: 0,
    branchId: '',
  })
  const [productSubmitting, setProductSubmitting] = useState(false)

  // ============ Data Fetching ============

  const fetchCompany = useCallback(async () => {
    if (!companyId) return
    setCompanyLoading(true)
    try {
      const res = await fetch(`/api/companies/${companyId}`)
      const json = await res.json()
      if (json.success) {
        setCompany(json.data)
        setCompanyForm({
          name: json.data.name || '',
          industry: json.data.industry || '',
          email: json.data.email || '',
          phone: json.data.phone || '',
          address: json.data.address || '',
        })
      }
    } catch {
      toast.error('Failed to load company info')
    } finally {
      setCompanyLoading(false)
    }
  }, [companyId])

  const fetchBranches = useCallback(async () => {
    if (!companyId) return
    setBranchesLoading(true)
    try {
      const res = await fetch(`/api/branches?companyId=${companyId}&includeInactive=true`)
      const json = await res.json()
      if (json.success) {
        setBranches(json.data)
      }
    } catch {
      toast.error('Failed to load branches')
    } finally {
      setBranchesLoading(false)
    }
  }, [companyId])

  const fetchUsers = useCallback(async () => {
    if (!companyId) return
    setUsersLoading(true)
    try {
      const res = await fetch(`/api/users?companyId=${companyId}&includeInactive=true`)
      const json = await res.json()
      if (json.success) {
        setUsers(json.data)
      }
    } catch {
      toast.error('Failed to load users')
    } finally {
      setUsersLoading(false)
    }
  }, [companyId])

  const fetchProducts = useCallback(async () => {
    if (!companyId) return
    setProductsLoading(true)
    try {
      const params = new URLSearchParams({ companyId, includeInactive: 'true' })
      if (productBranchFilter && productBranchFilter !== 'all') {
        params.set('branchId', productBranchFilter)
      }
      const res = await fetch(`/api/products?${params}`)
      const json = await res.json()
      if (json.success) {
        setProducts(json.data)
      }
    } catch {
      toast.error('Failed to load products')
    } finally {
      setProductsLoading(false)
    }
  }, [companyId, productBranchFilter])

  useEffect(() => {
    if (isAdmin && companyId) {
      fetchCompany()
      fetchBranches()
      fetchUsers()
      fetchProducts()
    }
  }, [isAdmin, companyId, fetchCompany, fetchBranches, fetchUsers, fetchProducts])

  // ============ Access Denied ============

  if (!isAdmin) {
    return (
      <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <ShieldAlert className="h-16 w-16 opacity-30" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-sm text-center max-w-sm">
            Only company administrators can access the Admin Control Panel. Please contact your
            system administrator if you need access.
          </p>
        </div>
      </div>
    )
  }

  // ============ Company Handlers ============

  const handleSaveCompany = async () => {
    if (!companyId) return
    setCompanySaving(true)
    try {
      const res = await fetch('/api/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: companyId,
          name: companyForm.name,
          industry: companyForm.industry || null,
          email: companyForm.email || null,
          phone: companyForm.phone || null,
          address: companyForm.address || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Company settings saved successfully')
        fetchCompany()
      } else {
        toast.error(json.error || 'Failed to save company settings')
      }
    } catch {
      toast.error('Failed to save company settings')
    } finally {
      setCompanySaving(false)
    }
  }

  // ============ Branch Handlers ============

  const handleAddBranch = async () => {
    if (!branchForm.name.trim() || !branchForm.code.trim()) {
      toast.error('Branch name and code are required')
      return
    }
    setBranchSubmitting(true)
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: branchForm.name.trim(),
          code: branchForm.code.trim(),
          address: branchForm.address.trim() || undefined,
          phone: branchForm.phone.trim() || undefined,
          isHeadOffice: branchForm.isHeadOffice,
          companyId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Branch "${branchForm.name}" created successfully`)
        setAddBranchOpen(false)
        setBranchForm({ name: '', code: '', address: '', phone: '', isHeadOffice: false })
        fetchBranches()
      } else {
        toast.error(json.error || 'Failed to create branch')
      }
    } catch {
      toast.error('Failed to create branch')
    } finally {
      setBranchSubmitting(false)
    }
  }

  const handleEditBranch = async () => {
    if (!selectedBranch || !branchForm.name.trim()) {
      toast.error('Branch name is required')
      return
    }
    setBranchSubmitting(true)
    try {
      const res = await fetch(`/api/branches/${selectedBranch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: branchForm.name.trim(),
          address: branchForm.address.trim() || null,
          phone: branchForm.phone.trim() || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Branch "${branchForm.name}" updated successfully`)
        setEditBranchOpen(false)
        setSelectedBranch(null)
        fetchBranches()
      } else {
        toast.error(json.error || 'Failed to update branch')
      }
    } catch {
      toast.error('Failed to update branch')
    } finally {
      setBranchSubmitting(false)
    }
  }

  const handleDeactivateBranch = async () => {
    if (!selectedBranch) return
    setBranchSubmitting(true)
    try {
      const res = await fetch(`/api/branches/${selectedBranch.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success(`Branch "${selectedBranch.name}" deactivated`)
        setDeactivateBranchOpen(false)
        setSelectedBranch(null)
        fetchBranches()
      } else {
        toast.error(json.error || 'Failed to deactivate branch')
      }
    } catch {
      toast.error('Failed to deactivate branch')
    } finally {
      setBranchSubmitting(false)
    }
  }

  // ============ User Handlers ============

  const handleAddUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.role || !userForm.branchId) {
      toast.error('Name, email, role, and branch assignment are required')
      return
    }
    setUserSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          password: userForm.password || 'demo-password',
          role: userForm.role,
          branchId: userForm.branchId,
          companyId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`User "${userForm.name}" created successfully`)
        setAddUserOpen(false)
        setUserForm({ name: '', email: '', password: '', role: 'Employee', branchId: '' })
        fetchUsers()
        fetchBranches()
      } else {
        toast.error(json.error || 'Failed to create user')
      }
    } catch {
      toast.error('Failed to create user')
    } finally {
      setUserSubmitting(false)
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser) return
    setUserSubmitting(true)
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userForm.name.trim() || undefined,
          role: userForm.role,
          branchId: userForm.branchId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`User "${userForm.name}" updated successfully`)
        setEditUserOpen(false)
        setSelectedUser(null)
        fetchUsers()
        fetchBranches()
      } else {
        toast.error(json.error || 'Failed to update user')
      }
    } catch {
      toast.error('Failed to update user')
    } finally {
      setUserSubmitting(false)
    }
  }

  const handleDeactivateUser = async () => {
    if (!selectedUser) return
    setUserSubmitting(true)
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success(`User "${selectedUser.name}" deactivated`)
        setDeactivateUserOpen(false)
        setSelectedUser(null)
        fetchUsers()
        fetchBranches()
      } else {
        toast.error(json.error || 'Failed to deactivate user')
      }
    } catch {
      toast.error('Failed to deactivate user')
    } finally {
      setUserSubmitting(false)
    }
  }

  // ============ Product Handlers ============

  const handleAddProduct = async () => {
    if (!productForm.name.trim() || !productForm.sku.trim() || !productForm.category.trim() || !productForm.branchId) {
      toast.error('Name, SKU, category, and branch are required')
      return
    }
    setProductSubmitting(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productForm.name.trim(),
          sku: productForm.sku.trim(),
          barcode: productForm.barcode.trim() || undefined,
          category: productForm.category.trim(),
          currentStockLevel: Number(productForm.currentStockLevel),
          reorderThreshold: Number(productForm.reorderThreshold),
          defaultSalePrice: Number(productForm.defaultSalePrice),
          branchId: productForm.branchId,
          companyId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Product "${productForm.name}" registered successfully`)
        setAddProductOpen(false)
        setProductForm({
          name: '', sku: '', barcode: '', category: '',
          currentStockLevel: 0, reorderThreshold: 10, defaultSalePrice: 0, branchId: '',
        })
        fetchProducts()
        fetchBranches()
      } else {
        toast.error(json.error || 'Failed to register product')
      }
    } catch {
      toast.error('Failed to register product')
    } finally {
      setProductSubmitting(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return
    setProductSubmitting(true)
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success(`Product "${selectedProduct.name}" deactivated`)
        setDeleteProductOpen(false)
        setSelectedProduct(null)
        fetchProducts()
        fetchBranches()
      } else {
        toast.error(json.error || 'Failed to remove product')
      }
    } catch {
      toast.error('Failed to remove product')
    } finally {
      setProductSubmitting(false)
    }
  }

  // ============ Filtered Lists ============

  const filteredBranches = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(branchSearch.toLowerCase()) ||
      b.code.toLowerCase().includes(branchSearch.toLowerCase()) ||
      (b.address && b.address.toLowerCase().includes(branchSearch.toLowerCase()))
  )

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.branch?.name.toLowerCase().includes(userSearch.toLowerCase())
  )

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase())
  )

  const categories = ['Beverages', 'Snacks', 'Dairy', 'Bakery', 'Household', 'Personal Care', 'Electronics', 'Stationery', 'Other']

  // ============ Render ============

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6 text-emerald-600" />
        <h1 className="text-xl font-bold">Admin Control Panel</h1>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="company" className="text-xs sm:text-sm gap-1 py-2">
            <Settings className="h-3.5 w-3.5 hidden sm:inline" />
            Company
          </TabsTrigger>
          <TabsTrigger value="branches" className="text-xs sm:text-sm gap-1 py-2">
            <Building2 className="h-3.5 w-3.5 hidden sm:inline" />
            Branches
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm gap-1 py-2">
            <Users className="h-3.5 w-3.5 hidden sm:inline" />
            Users
          </TabsTrigger>
          <TabsTrigger value="products" className="text-xs sm:text-sm gap-1 py-2">
            <Package className="h-3.5 w-3.5 hidden sm:inline" />
            Products
          </TabsTrigger>
        </TabsList>

        {/* ============ TAB 1: Company Settings ============ */}
        <TabsContent value="company">
          {companyLoading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-emerald-600" />
                      Company Settings
                    </CardTitle>
                    <CardDescription>Manage your company information and plan</CardDescription>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 capitalize">
                    {company?.plan || 'free'} Plan
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">
                      Company Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="company-name"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-industry">Industry</Label>
                    <Input
                      id="company-industry"
                      value={companyForm.industry}
                      onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                      placeholder="e.g. Retail, Wholesale"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="company-email"
                        type="email"
                        value={companyForm.email}
                        onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                        className="pl-9"
                        placeholder="company@example.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-phone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="company-phone"
                        value={companyForm.phone}
                        onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                        className="pl-9"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-address">Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="company-address"
                      value={companyForm.address}
                      onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                      className="pl-9"
                      placeholder="Full address"
                    />
                  </div>
                </div>

                {/* Company Stats */}
                {company?._count && (
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t">
                    <div className="flex flex-col items-center rounded-lg bg-muted/50 py-3 px-2">
                      <Building2 className="h-4 w-4 text-emerald-600 mb-1" />
                      <span className="text-lg font-semibold">{company._count.branches}</span>
                      <span className="text-xs text-muted-foreground">Branches</span>
                    </div>
                    <div className="flex flex-col items-center rounded-lg bg-muted/50 py-3 px-2">
                      <Users className="h-4 w-4 text-teal-600 mb-1" />
                      <span className="text-lg font-semibold">{company._count.users}</span>
                      <span className="text-xs text-muted-foreground">Users</span>
                    </div>
                    <div className="flex flex-col items-center rounded-lg bg-muted/50 py-3 px-2">
                      <Package className="h-4 w-4 text-stone-600 mb-1" />
                      <span className="text-lg font-semibold">{company._count.products}</span>
                      <span className="text-xs text-muted-foreground">Products</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveCompany}
                    disabled={companySaving}
                    className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                  >
                    <Save className="h-4 w-4" />
                    {companySaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ TAB 2: Branches Management ============ */}
        <TabsContent value="branches">
          {/* Header actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search branches..."
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchBranches}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  setBranchForm({ name: '', code: '', address: '', phone: '', isHeadOffice: false })
                  setAddBranchOpen(true)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add Branch
              </Button>
            </div>
          </div>

          {branchesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <Building2 className="h-16 w-16 opacity-30" />
              <h3 className="text-lg font-medium">No branches found</h3>
              <p className="text-sm">
                {branchSearch ? 'Try adjusting your search query' : 'Create your first branch to get started'}
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
                  {branch.isHeadOffice && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                  )}
                  <CardContent className="pt-5 pb-4 px-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base truncate">{branch.name}</h3>
                          <Badge variant="outline" className="text-xs font-mono bg-emerald-50 text-emerald-700 border-emerald-200">
                            {branch.code}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {branch.isHeadOffice && (
                            <Badge className="bg-emerald-600 text-white text-xs">Head Office</Badge>
                          )}
                          {!branch.isActive && (
                            <Badge variant="destructive" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedBranch(branch)
                            setBranchForm({
                              name: branch.name,
                              code: branch.code,
                              address: branch.address || '',
                              phone: branch.phone || '',
                              isHeadOffice: branch.isHeadOffice,
                            })
                            setEditBranchOpen(true)
                          }}
                          title="Edit branch"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {branch.isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedBranch(branch)
                              setDeactivateBranchOpen(true)
                            }}
                            title="Deactivate branch"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
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
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center rounded-lg bg-muted/50 py-2 px-1">
                        <Users className="h-3.5 w-3.5 text-emerald-600 mb-1" />
                        <span className="text-sm font-semibold">{branch._count.users}</span>
                        <span className="text-xs text-muted-foreground">Users</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-muted/50 py-2 px-1">
                        <Package className="h-3.5 w-3.5 text-teal-600 mb-1" />
                        <span className="text-sm font-semibold">{branch._count.products}</span>
                        <span className="text-xs text-muted-foreground">Products</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-muted/50 py-2 px-1">
                        <Receipt className="h-3.5 w-3.5 text-stone-600 mb-1" />
                        <span className="text-sm font-semibold">{branch._count.sales}</span>
                        <span className="text-xs text-muted-foreground">Sales</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============ TAB 3: Users Management ============ */}
        <TabsContent value="users">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchUsers}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  setUserForm({ name: '', email: '', password: '', role: 'Employee', branchId: '' })
                  setAddUserOpen(true)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </div>
          </div>

          {usersLoading ? (
            <Card>
              <CardContent className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <Users className="h-16 w-16 opacity-30" />
              <h3 className="text-lg font-medium">No users found</h3>
              <p className="text-sm">
                {userSearch ? 'Try adjusting your search query' : 'Add your first user to get started'}
              </p>
            </div>
          ) : isMobile ? (
            /* Mobile: Card layout */
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <Card key={user.id} className={!user.isActive ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold truncate">{user.name}</span>
                          <RoleBadge role={user.role} />
                          {!user.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Branch: {user.branch?.name || 'N/A'}
                          {user.branch?.isHeadOffice && ' (HQ)'}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedUser(user)
                            setUserForm({
                              name: user.name,
                              email: user.email,
                              password: '',
                              role: user.role,
                              branchId: user.branchId,
                            })
                            setEditUserOpen(true)
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {user.isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedUser(user)
                              setDeactivateUserOpen(true)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Desktop: Table layout */
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className={!user.isActive ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell><RoleBadge role={user.role} /></TableCell>
                        <TableCell>
                          <span className="text-sm">{user.branch?.name || 'N/A'}</span>
                          {user.branch?.isHeadOffice && (
                            <Badge className="ml-1 bg-emerald-50 text-emerald-600 text-[10px] px-1 py-0">HQ</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedUser(user)
                                setUserForm({
                                  name: user.name,
                                  email: user.email,
                                  password: '',
                                  role: user.role,
                                  branchId: user.branchId,
                                })
                                setEditUserOpen(true)
                              }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            {user.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setSelectedUser(user)
                                  setDeactivateUserOpen(true)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ TAB 4: Products Overview ============ */}
        <TabsContent value="products">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex flex-1 gap-2 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={productBranchFilter} onValueChange={setProductBranchFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Branches</SelectItem>
                  {branches.filter(b => b.isActive).map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchProducts}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  setProductForm({
                    name: '', sku: '', barcode: '', category: '',
                    currentStockLevel: 0, reorderThreshold: 10, defaultSalePrice: 0, branchId: '',
                  })
                  setAddProductOpen(true)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Register Product
              </Button>
            </div>
          </div>

          {productsLoading ? (
            <Card>
              <CardContent className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <Package className="h-16 w-16 opacity-30" />
              <h3 className="text-lg font-medium">No products found</h3>
              <p className="text-sm">
                {productSearch || productBranchFilter !== 'all'
                  ? 'Try adjusting your search or filter'
                  : 'Register your first product to get started'}
              </p>
            </div>
          ) : isMobile ? (
            /* Mobile: Card layout */
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {filteredProducts.map((product) => (
                <Card key={product.id} className={!product.isActive ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold truncate">{product.name}</span>
                          <TrendingBadge trending={product.trending} />
                          {!product.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>SKU: {product.sku}</span>
                          <span>•</span>
                          <span>{product.category}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          <span>Stock: <strong>{product.currentStockLevel}</strong></span>
                          <span>Price: <strong>${product.defaultSalePrice.toFixed(2)}</strong></span>
                        </div>
                      </div>
                      {product.isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                          onClick={() => {
                            setSelectedProduct(product)
                            setDeleteProductOpen(true)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Desktop: Table layout */
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[60vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Trending</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <TableRow key={product.id} className={!product.isActive ? 'opacity-60' : ''}>
                          <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                          <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                          <TableCell className="text-sm">{product.category}</TableCell>
                          <TableCell>
                            <span className={`font-semibold ${product.currentStockLevel <= product.reorderThreshold ? 'text-red-600' : ''}`}>
                              {product.currentStockLevel}
                            </span>
                          </TableCell>
                          <TableCell>${product.defaultSalePrice.toFixed(2)}</TableCell>
                          <TableCell><TrendingBadge trending={product.trending} /></TableCell>
                          <TableCell>
                            {product.isActive ? (
                              <Badge variant="outline" className="text-emerald-600 border-emerald-200">Active</Badge>
                            ) : (
                              <Badge variant="destructive">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {product.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setSelectedProduct(product)
                                  setDeleteProductOpen(true)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ============ DIALOGS ============ */}

      {/* Add Branch Dialog */}
      <Dialog open={addBranchOpen} onOpenChange={setAddBranchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              Add New Branch
            </DialogTitle>
            <DialogDescription>Create a new branch location for your company.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="branch-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="branch-name"
                  placeholder="Branch name"
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-code">Code <span className="text-destructive">*</span></Label>
                <Input
                  id="branch-code"
                  placeholder="e.g. NY01"
                  value={branchForm.code}
                  onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                  className="uppercase"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-address">Address</Label>
              <Input
                id="branch-address"
                placeholder="Street address"
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-phone">Phone</Label>
              <Input
                id="branch-phone"
                placeholder="Phone number"
                value={branchForm.phone}
                onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="branch-headoffice"
                checked={branchForm.isHeadOffice}
                onCheckedChange={(checked) => setBranchForm({ ...branchForm, isHeadOffice: checked })}
              />
              <Label htmlFor="branch-headoffice" className="cursor-pointer">This is the head office</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBranchOpen(false)} disabled={branchSubmitting}>Cancel</Button>
            <Button onClick={handleAddBranch} disabled={branchSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {branchSubmitting ? 'Creating...' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={editBranchOpen} onOpenChange={setEditBranchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-emerald-600" />
              Edit Branch
            </DialogTitle>
            <DialogDescription>Update branch information for {selectedBranch?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-branch-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="edit-branch-name"
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-code">Code</Label>
              <Input id="edit-branch-code" value={branchForm.code} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Branch code cannot be changed after creation.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-address">Address</Label>
              <Input
                id="edit-branch-address"
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-phone">Phone</Label>
              <Input
                id="edit-branch-phone"
                value={branchForm.phone}
                onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBranchOpen(false)} disabled={branchSubmitting}>Cancel</Button>
            <Button onClick={handleEditBranch} disabled={branchSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {branchSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Branch Confirmation */}
      <AlertDialog open={deactivateBranchOpen} onOpenChange={setDeactivateBranchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Deactivate Branch
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <span className="font-semibold text-foreground">{selectedBranch?.name}</span> ({selectedBranch?.code}).
              Deactivating a branch will prevent its data from showing in regular views.
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
                <p className="text-xs text-amber-600 font-medium mt-1">Warning: This is the head office branch.</p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={branchSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateBranch}
              disabled={branchSubmitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {branchSubmitting ? 'Deactivating...' : 'Deactivate Branch'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add User Dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Add New User
            </DialogTitle>
            <DialogDescription>Create a new user account for your company.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="user-name"
                placeholder="Full name"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="user-email"
                type="email"
                placeholder="user@company.com"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                placeholder="Leave blank for demo password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">In demo mode, a default password is used if left blank.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="user-role">Role <span className="text-destructive">*</span></Label>
                <Select value={userForm.role} onValueChange={(val) => setUserForm({ ...userForm, role: val })}>
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CompanyAdmin">Company Admin</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-branch">Branch <span className="text-destructive">*</span></Label>
                <Select value={userForm.branchId} onValueChange={(val) => setUserForm({ ...userForm, branchId: val })}>
                  <SelectTrigger id="user-branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.filter(b => b.isActive).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} {b.isHeadOffice ? '(HQ)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)} disabled={userSubmitting}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={userSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {userSubmitting ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-emerald-600" />
              Edit User
            </DialogTitle>
            <DialogDescription>Update user information for {selectedUser?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-user-name">Name</Label>
              <Input
                id="edit-user-name"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-user-email">Email</Label>
              <Input id="edit-user-email" value={userForm.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email cannot be changed after creation.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-user-role">Role</Label>
                <Select value={userForm.role} onValueChange={(val) => setUserForm({ ...userForm, role: val })}>
                  <SelectTrigger id="edit-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CompanyAdmin">Company Admin</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-branch">Branch</Label>
                <Select value={userForm.branchId} onValueChange={(val) => setUserForm({ ...userForm, branchId: val })}>
                  <SelectTrigger id="edit-user-branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.filter(b => b.isActive).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} {b.isHeadOffice ? '(HQ)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserOpen(false)} disabled={userSubmitting}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={userSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {userSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate User Confirmation */}
      <AlertDialog open={deactivateUserOpen} onOpenChange={setDeactivateUserOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" />
              Deactivate User
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <span className="font-semibold text-foreground">{selectedUser?.name}</span> ({selectedUser?.email}).
              They will no longer be able to log in or appear in active user lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedUser && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Role:</span>
                <RoleBadge role={selectedUser.role} />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Branch:</span>
                <span>{selectedUser.branch?.name || 'N/A'}</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={userSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateUser}
              disabled={userSubmitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {userSubmitting ? 'Deactivating...' : 'Deactivate User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Product Dialog */}
      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              Register New Product
            </DialogTitle>
            <DialogDescription>Add a new product to your company inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="product-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="product-name"
                  placeholder="Product name"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-sku">SKU <span className="text-destructive">*</span></Label>
                <Input
                  id="product-sku"
                  placeholder="e.g. BEV-001"
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value.toUpperCase() })}
                  className="uppercase"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="product-barcode">Barcode</Label>
                <Input
                  id="product-barcode"
                  placeholder="Optional"
                  value={productForm.barcode}
                  onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category">Category <span className="text-destructive">*</span></Label>
                <Select value={productForm.category} onValueChange={(val) => setProductForm({ ...productForm, category: val })}>
                  <SelectTrigger id="product-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="product-stock">Initial Stock <span className="text-destructive">*</span></Label>
                <Input
                  id="product-stock"
                  type="number"
                  min="0"
                  value={productForm.currentStockLevel}
                  onChange={(e) => setProductForm({ ...productForm, currentStockLevel: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-reorder">Reorder At</Label>
                <Input
                  id="product-reorder"
                  type="number"
                  min="0"
                  value={productForm.reorderThreshold}
                  onChange={(e) => setProductForm({ ...productForm, reorderThreshold: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-price">Sale Price <span className="text-destructive">*</span></Label>
                <Input
                  id="product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.defaultSalePrice}
                  onChange={(e) => setProductForm({ ...productForm, defaultSalePrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-branch">Branch <span className="text-destructive">*</span></Label>
              <Select value={productForm.branchId} onValueChange={(val) => setProductForm({ ...productForm, branchId: val })}>
                <SelectTrigger id="product-branch">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.filter(b => b.isActive).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} {b.isHeadOffice ? '(HQ)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProductOpen(false)} disabled={productSubmitting}>Cancel</Button>
            <Button onClick={handleAddProduct} disabled={productSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {productSubmitting ? 'Registering...' : 'Register Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Product Confirmation */}
      <AlertDialog open={deleteProductOpen} onOpenChange={setDeleteProductOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Remove Product
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <span className="font-semibold text-foreground">{selectedProduct?.name}</span> (SKU: {selectedProduct?.sku}).
              The product will no longer appear in active inventory or POS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedProduct && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Stock:</span>
                <span className="text-sm font-semibold">{selectedProduct.currentStockLevel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sale Price:</span>
                <span className="text-sm font-semibold">${selectedProduct.defaultSalePrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Trending:</span>
                <TrendingBadge trending={selectedProduct.trending} />
              </div>
              {selectedProduct.trending === 'down' && (
                <p className="text-xs text-amber-600 font-medium mt-1">
                  Warning: This product has declining sales. Consider running a promotion before removing.
                </p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={productSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              disabled={productSubmitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {productSubmitting ? 'Removing...' : 'Remove Product'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
