import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'

type Kind = 'success' | 'error'
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: Kind }[]>([])
  const push = useCallback((msg: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map(t => (
          <div key={t.id} className="toast-in pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-2xl dark:bg-white dark:text-ink">
            {t.kind === 'success' ? <CheckCircle2 className="size-5 text-emerald-400 dark:text-emerald-600" /> : <AlertCircle className="size-5 text-rose-400 dark:text-rose-600" />}
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
