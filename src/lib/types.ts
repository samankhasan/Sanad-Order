export type Role = 'admin' | 'operator' | 'customer'
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  shop_name: string | null
  username?: string | null
  address?: string | null
  city: string | null
  role: Role
  lang?: 'ku' | 'ar' | 'en'
  notifications_seen_at?: string
  blocked_at?: string | null
  avatar_url?: string | null
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

export interface Subcategory {
  id: string
  category_id: string
  name_ku: string
  name_ar: string | null
  name_en: string | null
  sort_order: number
  is_active: boolean
}

export interface Product {
  id: string
  category_id: string
  subcategory_id: string | null
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
  rating_avg?: number
  rating_count?: number
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
  payment_method?: string
  delivery?: DeliverySnapshot | null
  payment_status?: 'unpaid' | 'paid'
  paid_at?: string | null
  profiles?: Pick<Profile, 'full_name' | 'phone' | 'shop_name' | 'city' | 'address' | 'username'> | null
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

export interface AppNotification {
  id: string
  title: string
  body: string
  image_url: string | null
  link: string | null
  target_user: string | null
  created_by: string | null
  push_sent: number
  push_failed: number
  created_at: string
}

export interface HomeBanner {
  slot: number
  image_url: string | null
  link: string | null
  is_active: boolean
  updated_at: string
}

export interface SupportMessage {
  id: string
  user_id: string
  body: string
  reply: string | null
  replied_at: string | null
  status: 'open' | 'closed'
  created_at: string
  profiles?: Pick<Profile, 'full_name' | 'phone' | 'username' | 'avatar_url'> | null
}

export interface ProductReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer: string
  avatar_url: string | null
  verified: boolean
  mine: boolean
}

export interface RatingSummary { avg: number; total: number; s1: number; s2: number; s3: number; s4: number; s5: number }

export interface Reward {
  id: string
  user_id: string
  title: string
  body: string | null
  image_url: string | null
  created_at: string
  seen_at: string | null
}

export type GoalType = 'orders_count' | 'spend_total' | 'custom'

export interface Challenge {
  id: string
  title: string
  description: string | null
  image_url: string | null
  reward_text: string | null
  goal_type: GoalType
  goal_value: number | null
  starts_at: string
  ends_at: string
  is_active: boolean
  created_at: string
}

export interface MyChallenge extends Omit<Challenge, 'is_active' | 'created_at'> {
  joined: boolean
  progress: number
  completed: boolean
  participants: number
}

export interface PaymentMethod {
  code: string
  name_ku: string
  name_ar: string
  name_en: string
  logo_url: string | null
  is_enabled: boolean
  sort_order: number
}

export interface Address {
  id: string
  user_id: string
  label: string
  contact_name: string
  phone: string
  city: string | null
  details: string | null
  lat: number | null
  lng: number | null
  is_default: boolean
  created_at: string
}

/** Copy of the address stored on an order */
export interface DeliverySnapshot {
  label: string
  name: string
  phone: string
  city: string | null
  details: string | null
  lat: number | null
  lng: number | null
}
