export type Role = 'admin' | 'customer'
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  shop_name: string | null
  city: string | null
  role: Role
  created_at: string
}

export interface Category {
  id: string
  slug: string
  name_en: string
  name_ku: string
  name_ar: string
  logo: string | null
  accent: string
  sort_order: number
  is_active: boolean
}

export interface Product {
  id: string
  category_id: string
  name: string
  description: string | null
  sku: string | null
  size: string | null
  unit: string
  price: number
  image_url: string | null
  in_stock: boolean
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Order {
  id: string
  order_no: number
  user_id: string
  status: OrderStatus
  note: string | null
  total: number
  items_count: number
  created_at: string
  updated_at: string
  profiles?: Pick<Profile, 'full_name' | 'phone' | 'shop_name' | 'city'> | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  category_id: string | null
  product_name: string
  size: string | null
  unit: string | null
  unit_price: number
  quantity: number
  line_total: number
}

export const ORDER_FLOW: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'on_the_way', 'delivered']
export const UNITS = ['piece', 'box', 'gallon', 'bucket', 'can', 'kg', 'liter', 'set', 'meter'] as const
