import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Category, HomeBanner, PaymentMethod, Product, Subcategory } from './types'

let categoriesCache: Category[] | null = null

export function useCategories() {
  const [data, setData] = useState<Category[] | null>(categoriesCache)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setError(null)
    const { data, error } = await supabase.from('categories').select('*').order('sort_order')
    if (error) { setError(error.message); return }
    categoriesCache = data as Category[]
    setData(categoriesCache)
  }, [])
  useEffect(() => { load() }, [load])
  return { categories: data, error, reload: load }
}

export function useProducts(categoryId?: string | null, opts: { includeHidden?: boolean } = {}) {
  const [data, setData] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setError(null)
    let q = supabase.from('products').select('*').order('sort_order').order('created_at', { ascending: false })
    if (categoryId) q = q.eq('category_id', categoryId)
    if (!opts.includeHidden) q = q.eq('is_active', true)
    const { data, error } = await q
    if (error) { setError(error.message); return }
    setData(data as Product[])
  }, [categoryId, opts.includeHidden])
  useEffect(() => { load() }, [load])
  return { products: data, error, reload: load }
}

export function useSubcategories(categoryId?: string | null, opts: { includeHidden?: boolean } = {}) {
  const [data, setData] = useState<Subcategory[] | null>(null)
  const load = useCallback(async () => {
    let q = supabase.from('subcategories').select('*').order('sort_order').order('created_at')
    if (categoryId) q = q.eq('category_id', categoryId)
    if (!opts.includeHidden) q = q.eq('is_active', true)
    const { data } = await q
    setData((data as Subcategory[]) ?? [])
  }, [categoryId, opts.includeHidden])
  useEffect(() => { load() }, [load])
  return { subcategories: data, reload: load }
}

/** Best sellers (ranked by quantity sold, server side). */
export function usePopularProducts(limit = 10) {
  const [data, setData] = useState<Product[] | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('popular_products', { p_limit: limit })
    setData((data as Product[]) ?? [])
  }, [limit])
  useEffect(() => { load() }, [load])
  return { popular: data, reload: load }
}

/** Home-page ad banners (2 slots). Admins also get hidden / empty slots. */
export function useBanners(all = false) {
  const [data, setData] = useState<HomeBanner[] | null>(null)
  const load = useCallback(async () => {
    let q = supabase.from('home_banners').select('*').order('slot')
    if (!all) q = q.eq('is_active', true).not('image_url', 'is', null)
    const { data } = await q
    setData((data as HomeBanner[]) ?? [])
  }, [all])
  useEffect(() => { load() }, [load])
  return { banners: data, reload: load }
}

let paymentCache: PaymentMethod[] | null = null
/** Payment methods (cash, FIB, Super Qi, FastPay…) with their logos and availability. */
export function usePaymentMethods() {
  const [data, setData] = useState<PaymentMethod[] | null>(paymentCache)
  const load = useCallback(async () => {
    const { data } = await supabase.from('payment_methods').select('*').order('sort_order')
    paymentCache = (data as PaymentMethod[]) ?? []
    setData(paymentCache)
  }, [])
  useEffect(() => { load() }, [load])
  return { methods: data, reload: load }
}
