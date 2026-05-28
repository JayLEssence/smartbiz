import { z } from 'zod'

// ============================================
// INPUT VALIDATION SCHEMAS
// ============================================

// Reusable validators
const emailSchema = z.string().email('Invalid email format').toLowerCase().trim()
const nameSchema = z.string().min(2, 'Name must be at least 2 characters').max(100).trim()
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
const branchCodeSchema = z.string().min(2, 'Branch code must be at least 2 characters').max(20).toUpperCase().trim()
const phoneSchema = z.string().max(20).optional()
const urlSchema = z.string().url('Invalid URL format').optional().or(z.literal(''))
const positiveNumber = z.number().positive('Must be a positive number')
const nonNegativeNumber = z.number().nonnegative('Must be a non-negative number')

// Auth schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const joinSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  branchCode: branchCodeSchema,
})

export const registerSchema = z.object({
  name: nameSchema,
  industry: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: phoneSchema,
  address: z.string().max(200).optional(),
  adminName: nameSchema,
  adminEmail: emailSchema,
  adminPassword: passwordSchema,
  currency: z.string().length(3).optional(),
  currencySymbol: z.string().max(5).optional(),
  country: z.string().max(50).optional(),
  exchangeRate: z.number().positive().optional(),
})

// Company schemas
export const companyUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  industry: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  logoUrl: urlSchema.nullable(),
  currency: z.string().length(3).optional(),
  currencySymbol: z.string().max(5).optional(),
  country: z.string().max(50).optional(),
  exchangeRate: z.number().positive().optional(),
})

// Branch schemas
export const branchCreateSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(100),
  code: branchCodeSchema,
  address: z.string().max(200).optional(),
  phone: phoneSchema,
  companyId: z.string().min(1),
  isHeadOffice: z.boolean().optional(),
})

export const branchUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(200).optional(),
  phone: phoneSchema,
  isActive: z.boolean().optional(),
})

// User schemas
export const userCreateSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['CompanyAdmin', 'BranchManager', 'Employee']),
  branchId: z.string().min(1),
  companyId: z.string().min(1),
})

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  name: nameSchema.optional(),
  role: z.enum(['CompanyAdmin', 'BranchManager', 'Employee']).optional(),
  branchId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
})

// Product schemas
export const productCreateSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  sku: z.string().min(1, 'SKU is required').max(50),
  barcode: z.string().max(50).optional().nullable(),
  category: z.string().min(1, 'Category is required').max(50),
  currentStockLevel: z.number().int().nonnegative().default(0),
  reorderThreshold: z.number().int().nonnegative().default(10),
  defaultSalePrice: nonNegativeNumber.default(0),
  branchId: z.string().min(1),
  companyId: z.string().min(1),
})

export const productUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  sku: z.string().min(1).max(50).optional(),
  barcode: z.string().max(50).optional().nullable(),
  category: z.string().min(1).max(50).optional(),
  currentStockLevel: z.number().int().nonnegative().optional(),
  reorderThreshold: z.number().int().nonnegative().optional(),
  defaultSalePrice: nonNegativeNumber.optional(),
  isActive: z.boolean().optional(),
})

// Sale schema
export const saleCreateSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantitySold: z.number().int().positive(),
    salePricePerUnit: nonNegativeNumber,
    costPricePerUnit: nonNegativeNumber,
  })).min(1, 'At least one item is required'),
  branchId: z.string().min(1),
  companyId: z.string().min(1),
  paymentMethod: z.enum(['Cash', 'M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Card', 'Credit']).default('Cash'),
  customerName: z.string().max(100).optional(),
  discount: nonNegativeNumber.default(0),
})

// Inventory batch schema
export const inventoryBatchSchema = z.object({
  productId: z.string().min(1),
  quantityAdded: z.number().int().positive(),
  purchasePricePerUnit: nonNegativeNumber,
  supplierId: z.string().optional(),
  branchId: z.string().min(1),
  supplierName: z.string().max(100).optional(),
})

// Shrinkage schema
export const shrinkageCreateSchema = z.object({
  productId: z.string().min(1),
  quantityLost: z.number().int().positive(),
  reason: z.string().min(1, 'Reason is required').max(200),
  branchId: z.string().min(1),
})

// Expense schema
export const expenseCreateSchema = z.object({
  category: z.enum(['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Maintenance', 'Other']),
  description: z.string().min(1, 'Description is required').max(200),
  amount: positiveNumber,
  date: z.string().optional(),
  branchId: z.string().min(1),
  companyId: z.string().min(1),
  receiptUrl: urlSchema,
})

export const expenseUpdateSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Maintenance', 'Other']).optional(),
  description: z.string().min(1).max(200).optional(),
  amount: positiveNumber.optional(),
  date: z.string().optional(),
  branchId: z.string().min(1).optional(),
})

// Supplier schema
export const supplierCreateSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: phoneSchema,
  address: z.string().max(200).optional(),
  companyId: z.string().min(1),
})

// Customer schema
export const customerCreateSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: phoneSchema,
  address: z.string().max(200).optional(),
  loyaltyPoints: z.number().int().nonnegative().optional(),
  creditBalance: nonNegativeNumber.optional(),
  creditLimit: nonNegativeNumber.optional(),
  branchId: z.string().min(1),
  companyId: z.string().min(1),
})

// Customer update schema
export const customerUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Customer name is required').max(100).optional(),
  email: z.string().email().optional().or(z.literal('')).optional(),
  phone: phoneSchema,
  address: z.string().max(200).optional(),
  loyaltyPoints: z.number().int().nonnegative().optional(),
  creditBalance: nonNegativeNumber.optional(),
  creditLimit: nonNegativeNumber.optional(),
  isActive: z.boolean().optional(),
})

// Notification update schema
export const notificationUpdateSchema = z.object({
  ids: z.array(z.string()).min(1),
  isRead: z.boolean(),
})

// Password change schema
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

// Sanitize string - strip HTML tags and dangerous characters
export function sanitizeString(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

// Validate and sanitize - returns sanitized data or throws ZodError
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data)
}

// Safe validate - returns success/error without throwing
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
  return { success: false, errors }
}
