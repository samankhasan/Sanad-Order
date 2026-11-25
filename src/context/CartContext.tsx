import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Product } from '../lib/types'

export interface CartLine {
  product: Product
  quantity: number
}

interface Cart {
  lines: CartLine[]
  count: number
  total: number
  qtyOf: (id: string) => number
  add: (p: Product, qty?: number) => void
  setQty: (id: string, qty: number) => void
  remove: (id: string) => void
  clear: () => void
}

const Ctx = createContext<Cart | null>(null)
const KEY = 'so.cart.v1'

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)) } catch { /* ignore */ }
  }, [lines])

  const value = useMemo<Cart>(() => ({
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    total: lines.reduce((s, l) => s + l.quantity * Number(l.product.price), 0),
    qtyOf: id => lines.find(l => l.product.id === id)?.quantity ?? 0,
    add: (p, qty = 1) => setLines(ls => {
      const i = ls.findIndex(l => l.product.id === p.id)
      if (i === -1) return [...ls, { product: p, quantity: qty }]
      const copy = [...ls]
      copy[i] = { product: p, quantity: copy[i].quantity + qty }
      return copy
    }),
    setQty: (id, qty) => setLines(ls => qty <= 0
      ? ls.filter(l => l.product.id !== id)
      : ls.map(l => (l.product.id === id ? { ...l, quantity: qty } : l))),
    remove: id => setLines(ls => ls.filter(l => l.product.id !== id)),
    clear: () => setLines([])
  }), [lines])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCart outside provider')
  return c
}
