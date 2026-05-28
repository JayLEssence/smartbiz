'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { useLanguage } from '@/lib/i18n/language-context'
import { getAuthHeaders, checkUnauthorized } from '@/lib/auth-fetch'
import { useCurrency } from '@/hooks/use-currency'
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
  Copy,
  Check,
  Info,
  Download,
  Database,
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
  const { t } = useLanguage()
  switch (role) {
    case 'CompanyAdmin':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
          <Crown className="h-3 w-3" />
          {t('admin.companyAdmin')}
        </Badge>
      )
    case 'Manager':
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-1">
          <UserCheck className="h-3 w-3" />
          {t('admin.manager')}
        </Badge>
      )
    case 'Employee':
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 gap-1">
          <Users className="h-3 w-3" />
          {t('admin.employee')}
        </Badge>
      )
    default:
      return <Badge variant="outline">{role}</Badge>
  }
}

function TrendingBadge({ trending }: { trending: string }) {
  const { t } = useLanguage()
  switch (trending) {
    case 'up':
      return (
        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1 text-xs">
          <TrendingUp className="h-3 w-3" />
          {t('admin.trendingUp')}
        </Badge>
      )
    case 'down':
      return (
        <Badge className="bg-red-50 text-red-600 border-red-200 gap-1 text-xs">
          <TrendingDown className="h-3 w-3" />
          {t('admin.declining')}
        </Badge>
      )
    case 'stable':
      return (
        <Badge className="bg-gray-50 text-gray-600 border-gray-200 gap-1 text-xs">
          <Minus className="h-3 w-3" />
          {t('admin.stable')}
        </Badge>
      )
    case 'new':
      return (
        <Badge className="bg-teal-50 text-teal-600 border-teal-200 gap-1 text-xs">
          <Sparkles className="h-3 w-3" />
          {t('admin.newProduct')}
        </Badge>
      )
    case 'no-sales':
      return (
        <Badge className="bg-slate-50 text-slate-500 border-slate-200 gap-1 text-xs">
          <CircleOff className="h-3 w-3" />
          {t('admin.noSales')}
        </Badge>
      )
    default:
      return null
  }
}

// ============ Branch Code Copy Button ============

function BranchCodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea')
      textarea.value = code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 font-mono text-xs"
      onClick={handleCopy}
    >
      <span className="font-semibold text-emerald-700">{code}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  )
}

// ============ Main Component ============

export function AdminPanel() {
  const isMobile = useIsMobile()
  const { currentUser } = useAppStore()
  const { t } = useLanguage()
  const { formatDualUSD } = useCurrency()

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

  // ============ Category Translation Map ============
  const categoryKeyMap: Record<string, string> = {
    'Beverages': 'admin.catBeverages',
    'Snacks': 'admin.catSnacks',
    'Dairy': 'admin.catDairy',
    'Bakery': 'admin.catBakery',
    'Household': 'admin.catHousehold',
    'Personal Care': 'admin.catPersonalCare',
    'Electronics': 'admin.catElectronics',
    'Stationery': 'admin.catStationery',
    'Other': 'admin.catOther',
  }

  // ============ Data Fetching ============

  const fetchCompany = useCallback(async () => {
    if (!companyId) return
    setCompanyLoading(true)
    try {
      const res = await fetch(`/api/companies/${companyId}`, { headers: getAuthHeaders() })
      if (checkUnauthorized(res)) return
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
      toast.error(t('admin.failedToLoadCompany'))
    } finally {
      setCompanyLoading(false)
    }
  }, [companyId, t])

  const fetchBranches = useCallback(async () => {
    if (!companyId) return
    setBranchesLoading(true)
    try {
      const res = await fetch(`/api/branches?companyId=${companyId}&includeInactive=true`, { headers: getAuthHeaders() })
      if (checkUnauthorized(res)) return
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
      const res = await fetch(`/api/users?companyId=${companyId}&includeInactive=true`, { headers: getAuthHeaders() })
      if (checkUnauthorized(res)) return
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
      const res = await fetch(`/api/products?${params}`, { headers: getAuthHeaders() })
      if (checkUnauthorized(res)) return
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
          <h2 className="text-xl font-semibold">{t('admin.accessDenied')}</h2>
          <p className="text-sm text-center max-w-sm">
            {t('admin.accessDeniedExplanation')}
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
        headers: getAuthHeaders(),
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
        toast.success(t('admin.companySaved'))
        fetchCompany()
      } else {
        toast.error(json.error || t('admin.failedToSaveCompany'))
      }
    } catch {
      toast.error(t('admin.failedToSaveCompany'))
    } finally {
      setCompanySaving(false)
    }
  }

  // ============ Branch Handlers ============

  const handleAddBranch = async () => {
    if (!branchForm.name.trim() || !branchForm.code.trim()) {
      toast.error(t('admin.branchNameCodeRequired'))
      return
    }
    setBranchSubmitting(true)
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: getAuthHeaders(),
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
        toast.success(t('admin.branchCreated'))
        setAddBranchOpen(false)
        setBranchForm({ name: '', code: '', address: '', phone: '', isHeadOffice: false })
        fetchBranches()
      } else {
        toast.error(json.error || t('admin.failedToCreateBranch'))
      }
    } catch {
      toast.error(t('admin.failedToCreateBranch'))
    } finally {
      setBranchSubmitting(false)
    }
  }

  const handleEditBranch = async () => {
    if (!selectedBranch || !branchForm.name.trim()) {
      toast.error(t('admin.branchNameRequired'))
      return
    }
    setBranchSubmitting(true)
    try {
      const res = await fetch(`/api/branches/${selectedBranch.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: branchForm.name.trim(),
          address: branchForm.address.trim() || null,
          phone: branchForm.phone.trim() || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(t('admin.branchUpdated'))
        setEditBranchOpen(false)
        setSelectedBranch(null)
        fetchBranches()
      } else {
        toast.error(json.error || t('admin.failedToUpdateBranch'))
      }
    } catch {
      toast.error(t('admin.failedToUpdateBranch'))
    } finally {
      setBranchSubmitting(false)
    }
  }

  const handleDeactivateBranch = async () => {
    if (!selectedBranch) return
    setBranchSubmitting(true)
    try {
      const res = await fetch(`/api/branches/${selectedBranch.id}`, { method: 'DELETE', headers: getAuthHeaders() })
      if (checkUnauthorized(res)) return
      const json = await res.json()
      if (json.success) {
        toast.success(t('admin.branchDeactivated'))
        setDeactivateBranchOpen(false)
        setSelectedBranch(null)
        fetchBranches()
      } else {
        toast.error(json.error || t('admin.failedToDeactivateBranch'))
      }
    } catch {
      toast.error(t('admin.failedToDeactivateBranch'))
    } finally {
      setBranchSubmitting(false)
    }
  }

  // ============ User Handlers ============

  const handleAddUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.role || !userForm.branchId) {
      toast.error(t('admin.userDataRequired'))
      return
    }
    setUserSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
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
        toast.success(t('admin.userCreated'))
        setAddUserOpen(false)
        setUserForm({ name: '', email: '', password: '', role: 'Employee', branchId: '' })
        fetchUsers()
        fetchBranches()
      } else {
        toast.error(json.error || t('admin.failedToCreateUser'))
      }
    } catch {
      toast.error(t('admin.failedToCreateUser'))
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
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: userForm.name.trim() || undefined,
          role: userForm.role,
          branchId: userForm.branchId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(t('admin.userUpdated'))
        setEditUserOpen(false)
        setSelectedUser(null)
        fetchUsers()
        fetchBranches()
      } else {
        toast.error(json.error || t('admin.failedToUpdateUser'))
      }
    } catch {
      toast.error(t('admin.failedToUpdateUser'))
    } finally {
      setUserSubmitting(false)
    }
  }

  const handleDeactivateUser = async () => {
    if (!selectedUser) return
    setUserSubmitting(true)
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, { method: 'DELETE', headers: getAuthHeaders() })
      if (checkUnauthorized(res)) return
      const json = await res.json()
      if (json.success) {
        toast.success(t('admin.userDeactivated'))
        setDeactivateUserOpen(false)
        setSelectedUser(null)
        fetchUsers()
        fetchBranches()
      } else {
        toast.error(json.error || t('admin.failedToDeactivateUser'))
      }
    } catch {
      toast.error(t('admin.failedToDeactivateUser'))
    } finally {
      setUserSubmitting(false)
    }
  }

  const handlePromoteUser = async (user: UserData, newRole: string) => {
    setUserSubmitting(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role: newRole }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(newRole === 'Manager' ? t('admin.promotedToManager') : t('admin.demotedToEmployee'))
        fetchUsers()
      } else {
        toast.error(json.error || t('admin.failedToUpdateUser'))
      }
    } catch {
      toast.error(t('admin.failedToUpdateUser'))
    } finally {
      setUserSubmitting(false)
    }
  }

  // ============ Product Handlers ============

  const handleAddProduct = async () => {
    if (!productForm.name.trim() || !productForm.sku.trim() || !productForm.category.trim() || !productForm.branchId) {
      toast.error(t('admin.productRequired'))
      return
    }
    setProductSubmitting(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: getAuthHeaders(),
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
        toast.success(t('admin.productRegistered'))
        setAddProductOpen(false)
        setProductForm({
          name: '', sku: '', barcode: '', category: '',
          currentStockLevel: 0, reorderThreshold: 10, defaultSalePrice: 0, branchId: '',
        })
        fetchProducts()
        fetchBranches()
      } else {
        toast.error(json.error || t('admin.failedToRegisterProduct'))
      }
    } catch {
      toast.error(t('admin.failedToRegisterProduct'))
    } finally {
      setProductSubmitting(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return
    setProductSubmitting(true)
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, { method: 'DELETE', headers: getAuthHeaders() })
      if (checkUnauthorized(res)) return
      const json = await res.json()
      if (json.success) {
        toast.success(t('admin.productDeactivated'))
        setDeleteProductOpen(false)
        setSelectedProduct(null)
        fetchProducts()
        fetchBranches()
      } else {
        toast.error(json.error || t('admin.failedToRemoveProduct'))
      }
    } catch {
      toast.error(t('admin.failedToRemoveProduct'))
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
        <h1 className="text-xl font-bold">{t('admin.adminControlPanel')}</h1>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="company" className="text-xs sm:text-sm gap-1 py-2">
            <Settings className="h-3.5 w-3.5 hidden sm:inline" />
            {t('admin.company')}
          </TabsTrigger>
          <TabsTrigger value="branches" className="text-xs sm:text-sm gap-1 py-2">
            <Building2 className="h-3.5 w-3.5 hidden sm:inline" />
            {t('admin.branches')}
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm gap-1 py-2">
            <Users className="h-3.5 w-3.5 hidden sm:inline" />
            {t('admin.users')}
          </TabsTrigger>
          <TabsTrigger value="products" className="text-xs sm:text-sm gap-1 py-2">
            <Package className="h-3.5 w-3.5 hidden sm:inline" />
            {t('admin.products')}
          </TabsTrigger>
          <TabsTrigger value="data" className="text-xs sm:text-sm gap-1 py-2">
            <Download className="h-3.5 w-3.5 hidden sm:inline" />
            Data
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
                      {t('admin.companySettings')}
                    </CardTitle>
                    <CardDescription>{t('admin.manageCompanyInfo')}</CardDescription>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 capitalize">
                    {company?.plan || 'free'} {t('admin.plan')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">
                      {t('admin.companyName')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="company-name"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-industry">{t('admin.industry')}</Label>
                    <Input
                      id="company-industry"
                      value={companyForm.industry}
                      onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                      placeholder="e.g. Retail, Wholesale"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-email">{t('admin.email')}</Label>
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
                    <Label htmlFor="company-phone">{t('admin.phone')}</Label>
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
                  <Label htmlFor="company-address">{t('admin.address')}</Label>
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
                      <span className="text-xs text-muted-foreground">{t('admin.branches')}</span>
                    </div>
                    <div className="flex flex-col items-center rounded-lg bg-muted/50 py-3 px-2">
                      <Users className="h-4 w-4 text-teal-600 mb-1" />
                      <span className="text-lg font-semibold">{company._count.users}</span>
                      <span className="text-xs text-muted-foreground">{t('admin.users')}</span>
                    </div>
                    <div className="flex flex-col items-center rounded-lg bg-muted/50 py-3 px-2">
                      <Package className="h-4 w-4 text-stone-600 mb-1" />
                      <span className="text-lg font-semibold">{company._count.products}</span>
                      <span className="text-xs text-muted-foreground">{t('admin.products')}</span>
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
                    {companySaving ? t('admin.saving') : t('admin.saveChanges')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ TAB 2: Branches Management ============ */}
        <TabsContent value="branches">
          {/* Employee Access Guide */}
          <div className="flex items-start gap-3 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 p-3 mb-4">
            <Users className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
            <div className="text-xs text-teal-700 dark:text-teal-400">
              <span className="font-medium">{t('admin.howEmployeesJoin')}</span>{' '}
              {t('admin.howEmployeesJoinExplanation')}
            </div>
          </div>
          {/* Header actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.searchBranches')}
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
                {t('admin.addBranch')}
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
              <h3 className="text-lg font-medium">{t('admin.noBranches')}</h3>
              <p className="text-sm">
                {branchSearch ? t('admin.tryAdjustingSearch') : t('admin.createFirstBranch')}
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
                            <Badge className="bg-emerald-600 text-white text-xs">{t('admin.headOffice')}</Badge>
                          )}
                          {!branch.isActive && (
                            <Badge variant="destructive" className="text-xs">{t('admin.inactive')}</Badge>
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
                          title={t('admin.editBranch')}
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
                            title={t('admin.deactivateBranch')}
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
                        <span className="text-xs text-muted-foreground">{t('admin.users')}</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-muted/50 py-2 px-1">
                        <Package className="h-3.5 w-3.5 text-teal-600 mb-1" />
                        <span className="text-sm font-semibold">{branch._count.products}</span>
                        <span className="text-xs text-muted-foreground">{t('admin.products')}</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-muted/50 py-2 px-1">
                        <Receipt className="h-3.5 w-3.5 text-stone-600 mb-1" />
                        <span className="text-sm font-semibold">{branch._count.sales}</span>
                        <span className="text-xs text-muted-foreground">Sales</span>
                      </div>
                    </div>
                    {/* Employee Join Code */}
                    {branch.isActive && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">{t('admin.employeeJoinCode')}</span>
                          <BranchCodeCopyButton code={branch.code} />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Info className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-[10px] text-muted-foreground">{t('admin.shareCodeWithEmployees')}</span>
                        </div>
                      </div>
                    )}
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
                placeholder={t('admin.searchUsers')}
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
                {t('admin.addUser')}
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
              <h3 className="text-lg font-medium">{t('admin.noUsers')}</h3>
              <p className="text-sm">
                {userSearch ? t('admin.tryAdjustingSearch') : t('admin.addFirstUser')}
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
                          {!user.isActive && <Badge variant="destructive" className="text-xs">{t('admin.inactive')}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('admin.branches')}: {user.branch?.name || t('admin.notApplicable')}
                          {user.branch?.isHeadOffice && ` (${t('admin.hq')})`}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {user.isActive && user.role === 'Employee' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={() => handlePromoteUser(user, 'Manager')}
                            disabled={userSubmitting}
                            title={t('admin.promoteToManager')}
                          >
                            <Crown className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {user.isActive && user.role === 'Manager' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-slate-600 hover:bg-slate-50"
                            onClick={() => handlePromoteUser(user, 'Employee')}
                            disabled={userSubmitting}
                            title={t('admin.demoteToEmployee')}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
                      <TableHead>{t('admin.fullName')}</TableHead>
                      <TableHead>{t('admin.email')}</TableHead>
                      <TableHead>{t('admin.role')}</TableHead>
                      <TableHead>{t('admin.branches')}</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">{t('admin.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className={!user.isActive ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell><RoleBadge role={user.role} /></TableCell>
                        <TableCell>
                          <span className="text-sm">{user.branch?.name || t('admin.notApplicable')}</span>
                          {user.branch?.isHeadOffice && (
                            <Badge className="ml-1 bg-emerald-50 text-emerald-600 text-[10px] px-1 py-0">{t('admin.hq')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200">{t('admin.active')}</Badge>
                          ) : (
                            <Badge variant="destructive">{t('admin.inactive')}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {user.isActive && user.role === 'Employee' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => handlePromoteUser(user, 'Manager')}
                                disabled={userSubmitting}
                                title={t('admin.promoteToManager')}
                              >
                                <Crown className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {user.isActive && user.role === 'Manager' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-slate-600 hover:bg-slate-50"
                                onClick={() => handlePromoteUser(user, 'Employee')}
                                disabled={userSubmitting}
                                title={t('admin.demoteToEmployee')}
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                              </Button>
                            )}
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
                  placeholder={t('admin.searchProducts')}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={productBranchFilter} onValueChange={setProductBranchFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                  <SelectValue placeholder={t('admin.allBranches')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">{t('admin.allBranches')}</SelectItem>
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
                {t('admin.registerProduct')}
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
              <h3 className="text-lg font-medium">{t('admin.noProducts')}</h3>
              <p className="text-sm">
                {productSearch || productBranchFilter !== 'all'
                  ? t('admin.tryAdjustingFilter')
                  : t('admin.registerFirstProduct')}
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
                          {!product.isActive && <Badge variant="destructive" className="text-xs">{t('admin.inactive')}</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>SKU: {product.sku}</span>
                          <span>•</span>
                          <span>{t(categoryKeyMap[product.category] || product.category)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          <span>{t('admin.currentStock')}: <strong>{product.currentStockLevel ?? 0}</strong></span>
                          <span>{t('admin.salePrice')}: <strong>{formatDualUSD(product.defaultSalePrice ?? 0)}</strong></span>
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
                        <TableHead>{t('admin.products')}</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>{t('admin.category')}</TableHead>
                        <TableHead>{t('admin.currentStock')}</TableHead>
                        <TableHead>{t('admin.salePrice')}</TableHead>
                        <TableHead>{t('admin.trending')}</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">{t('admin.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <TableRow key={product.id} className={!product.isActive ? 'opacity-60' : ''}>
                          <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                          <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                          <TableCell className="text-sm">{t(categoryKeyMap[product.category] || product.category)}</TableCell>
                          <TableCell>
                            <span className={`font-semibold ${(product.currentStockLevel ?? 0) <= (product.reorderThreshold ?? 0) ? 'text-red-600' : ''}`}>
                              {product.currentStockLevel ?? 0}
                            </span>
                          </TableCell>
                          <TableCell>{formatDualUSD(product.defaultSalePrice ?? 0)}</TableCell>
                          <TableCell><TrendingBadge trending={product.trending} /></TableCell>
                          <TableCell>
                            {product.isActive ? (
                              <Badge variant="outline" className="text-emerald-600 border-emerald-200">{t('admin.active')}</Badge>
                            ) : (
                              <Badge variant="destructive">{t('admin.inactive')}</Badge>
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
        {/* ============ TAB 5: Data Export ============ */}
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-emerald-600" />
                Data Export
              </CardTitle>
              <CardDescription>
                Export your business data for backup, analysis, or migration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { type: 'all', label: 'Complete Export', desc: 'All data (sales, products, customers, expenses)', icon: Database },
                  { type: 'sales', label: 'Sales Data', desc: 'All sales transactions with items', icon: Receipt },
                  { type: 'products', label: 'Product Catalog', desc: 'All products with stock levels', icon: Package },
                  { type: 'customers', label: 'Customer Data', desc: 'All customers with loyalty info', icon: Users },
                  { type: 'expenses', label: 'Expense Records', desc: 'All expense transactions', icon: Receipt },
                ].map((item) => (
                  <div key={item.type} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                      <item.icon className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            const token = JSON.parse(localStorage.getItem('smartbiz_session') || '{}')?.token
                            window.open(`/api/data/export?type=${item.type}&format=json&XTransformPort=`, '_blank')
                            // For JSON, use fetch
                            fetch(`/api/data/export?type=${item.type}&format=json`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            })
                            .then(r => r.json())
                            .then(json => {
                              if (json.success) {
                                const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `smartbiz-${item.type}-export-${new Date().toISOString().split('T')[0]}.json`
                                a.click()
                                URL.revokeObjectURL(url)
                                toast.success(`${item.label} exported successfully`)
                              } else {
                                toast.error(json.error || 'Export failed')
                              }
                            })
                            .catch(() => toast.error('Export failed'))
                          }}
                        >
                          JSON
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            const token = JSON.parse(localStorage.getItem('smartbiz_session') || '{}')?.token
                            fetch(`/api/data/export?type=${item.type}&format=csv`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            })
                            .then(r => r.text())
                            .then(csv => {
                              const blob = new Blob([csv], { type: 'text/csv' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `smartbiz-${item.type}-export-${new Date().toISOString().split('T')[0]}.csv`
                              a.click()
                              URL.revokeObjectURL(url)
                              toast.success(`${item.label} exported as CSV`)
                            })
                            .catch(() => toast.error('Export failed'))
                          }}
                        >
                          CSV
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* ============ DIALOGS ============ */}

      {/* Add Branch Dialog */}
      <Dialog open={addBranchOpen} onOpenChange={setAddBranchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              {t('admin.addNewBranch')}
            </DialogTitle>
            <DialogDescription>{t('admin.createBranchExplanation')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="branch-name">{t('admin.branchName')} <span className="text-destructive">*</span></Label>
                <Input
                  id="branch-name"
                  placeholder={t('admin.branchName')}
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-code">{t('admin.branchCode')} <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="branch-address">{t('admin.branchAddress')}</Label>
              <Input
                id="branch-address"
                placeholder={t('admin.branchAddress')}
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-phone">{t('admin.branchPhone')}</Label>
              <Input
                id="branch-phone"
                placeholder={t('admin.branchPhone')}
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
              <Label htmlFor="branch-headoffice" className="cursor-pointer">{t('admin.isHeadOffice')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBranchOpen(false)} disabled={branchSubmitting}>{t('admin.cancel')}</Button>
            <Button onClick={handleAddBranch} disabled={branchSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {branchSubmitting ? t('admin.creating') : t('admin.createBranch')}
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
              {t('admin.editBranch')}
            </DialogTitle>
            <DialogDescription>{t('admin.editBranchInfo')} {selectedBranch?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-branch-name">{t('admin.branchName')} <span className="text-destructive">*</span></Label>
              <Input
                id="edit-branch-name"
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-code">{t('admin.branchCode')}</Label>
              <Input id="edit-branch-code" value={branchForm.code} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">{t('admin.codeCannotChange')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-address">{t('admin.branchAddress')}</Label>
              <Input
                id="edit-branch-address"
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-phone">{t('admin.branchPhone')}</Label>
              <Input
                id="edit-branch-phone"
                value={branchForm.phone}
                onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBranchOpen(false)} disabled={branchSubmitting}>{t('admin.cancel')}</Button>
            <Button onClick={handleEditBranch} disabled={branchSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {branchSubmitting ? t('admin.saving') : t('branches.saveChanges')}
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
              {t('admin.deactivateBranch')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <span className="font-semibold text-foreground">{selectedBranch?.name}</span> ({selectedBranch?.code}).
              Deactivating a branch will prevent its data from showing in regular views.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedBranch && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium mb-2">{t('admin.branchDataHidden')}</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{selectedBranch._count.users} {t('admin.users')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-teal-600" />
                  <span>{selectedBranch._count.products} {t('admin.products')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-stone-600" />
                  <span>{selectedBranch._count.sales} Sales</span>
                </div>
              </div>
              {selectedBranch.isHeadOffice && (
                <p className="text-xs text-amber-600 font-medium mt-1">{t('admin.warningHeadOffice')}</p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={branchSubmitting}>{t('admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateBranch}
              disabled={branchSubmitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {branchSubmitting ? t('admin.deactivating') : t('admin.deactivateBranch')}
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
              {t('admin.addNewUser')}
            </DialogTitle>
            <DialogDescription>{t('admin.createUserExplanation')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">{t('admin.fullName')} <span className="text-destructive">*</span></Label>
              <Input
                id="user-name"
                placeholder={t('admin.fullName')}
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">{t('admin.email')} <span className="text-destructive">*</span></Label>
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
                placeholder={t('admin.leaveBlankDemo')}
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t('admin.leaveBlankDemo')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="user-role">{t('admin.role')} <span className="text-destructive">*</span></Label>
                <Select value={userForm.role} onValueChange={(val) => setUserForm({ ...userForm, role: val })}>
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder={t('admin.role')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CompanyAdmin">{t('admin.companyAdmin')}</SelectItem>
                    <SelectItem value="Manager">{t('admin.manager')}</SelectItem>
                    <SelectItem value="Employee">{t('admin.employee')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-branch">{t('admin.selectBranch')} <span className="text-destructive">*</span></Label>
                <Select value={userForm.branchId} onValueChange={(val) => setUserForm({ ...userForm, branchId: val })}>
                  <SelectTrigger id="user-branch">
                    <SelectValue placeholder={t('admin.selectBranch')} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.filter(b => b.isActive).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} {b.isHeadOffice ? `(${t('admin.hq')})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)} disabled={userSubmitting}>{t('admin.cancel')}</Button>
            <Button onClick={handleAddUser} disabled={userSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {userSubmitting ? t('admin.creating') : t('admin.createUser')}
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
              {t('admin.editUser')}
            </DialogTitle>
            <DialogDescription>{t('admin.editUserExplanation')} {selectedUser?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-user-name">{t('admin.fullName')}</Label>
              <Input
                id="edit-user-name"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-user-email">{t('admin.email')}</Label>
              <Input id="edit-user-email" value={userForm.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">{t('admin.emailCannotChange')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-user-role">{t('admin.role')}</Label>
                <Select value={userForm.role} onValueChange={(val) => setUserForm({ ...userForm, role: val })}>
                  <SelectTrigger id="edit-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CompanyAdmin">{t('admin.companyAdmin')}</SelectItem>
                    <SelectItem value="Manager">{t('admin.manager')}</SelectItem>
                    <SelectItem value="Employee">{t('admin.employee')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-branch">{t('admin.selectBranch')}</Label>
                <Select value={userForm.branchId} onValueChange={(val) => setUserForm({ ...userForm, branchId: val })}>
                  <SelectTrigger id="edit-user-branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.filter(b => b.isActive).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} {b.isHeadOffice ? `(${t('admin.hq')})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserOpen(false)} disabled={userSubmitting}>{t('admin.cancel')}</Button>
            <Button onClick={handleEditUser} disabled={userSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {userSubmitting ? t('admin.saving') : t('admin.saveChanges')}
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
              {t('admin.deactivateUser')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <span className="font-semibold text-foreground">{selectedUser?.name}</span> ({selectedUser?.email}).
              {t('admin.deactivateUserExplanation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedUser && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('admin.role')}:</span>
                <RoleBadge role={selectedUser.role} />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('admin.branches')}:</span>
                <span>{selectedUser.branch?.name || t('admin.notApplicable')}</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={userSubmitting}>{t('admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateUser}
              disabled={userSubmitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {userSubmitting ? t('admin.deactivating') : t('admin.deactivateUser')}
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
              {t('admin.registerNewProduct')}
            </DialogTitle>
            <DialogDescription>{t('admin.registerProductExplanation')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="product-name">{t('admin.branchName')} <span className="text-destructive">*</span></Label>
                <Input
                  id="product-name"
                  placeholder={t('admin.branchName')}
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
                <Label htmlFor="product-barcode">{t('admin.barcode')}</Label>
                <Input
                  id="product-barcode"
                  placeholder={t('admin.optional')}
                  value={productForm.barcode}
                  onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category">{t('admin.category')} <span className="text-destructive">*</span></Label>
                <Select value={productForm.category} onValueChange={(val) => setProductForm({ ...productForm, category: val })}>
                  <SelectTrigger id="product-category">
                    <SelectValue placeholder={t('admin.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{t(categoryKeyMap[cat] || cat)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="product-stock">{t('admin.initialStock')} <span className="text-destructive">*</span></Label>
                <Input
                  id="product-stock"
                  type="number"
                  min="0"
                  value={productForm.currentStockLevel}
                  onChange={(e) => setProductForm({ ...productForm, currentStockLevel: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-reorder">{t('admin.reorderAt')}</Label>
                <Input
                  id="product-reorder"
                  type="number"
                  min="0"
                  value={productForm.reorderThreshold}
                  onChange={(e) => setProductForm({ ...productForm, reorderThreshold: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-price">{t('admin.salePrice')} <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="product-branch">{t('admin.selectBranch')} <span className="text-destructive">*</span></Label>
              <Select value={productForm.branchId} onValueChange={(val) => setProductForm({ ...productForm, branchId: val })}>
                <SelectTrigger id="product-branch">
                  <SelectValue placeholder={t('admin.selectBranch')} />
                </SelectTrigger>
                <SelectContent>
                  {branches.filter(b => b.isActive).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} {b.isHeadOffice ? `(${t('admin.hq')})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProductOpen(false)} disabled={productSubmitting}>{t('admin.cancel')}</Button>
            <Button onClick={handleAddProduct} disabled={productSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {productSubmitting ? t('admin.registering') : t('admin.registerProductBtn')}
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
              {t('admin.removeProduct')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <span className="font-semibold text-foreground">{selectedProduct?.name}</span> (SKU: {selectedProduct?.sku}).
              {t('admin.removeProductExplanation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedProduct && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('admin.currentStock')}:</span>
                <span className="text-sm font-semibold">{selectedProduct.currentStockLevel ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('admin.salePrice')}:</span>
                <span className="text-sm font-semibold">{formatDualUSD(selectedProduct.defaultSalePrice ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('admin.trending')}:</span>
                <TrendingBadge trending={selectedProduct.trending} />
              </div>
              {selectedProduct.trending === 'down' && (
                <p className="text-xs text-amber-600 font-medium mt-1">
                  {t('admin.warningDeclining')}
                </p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={productSubmitting}>{t('admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              disabled={productSubmitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {productSubmitting ? t('admin.removing') : t('admin.removeProductBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
