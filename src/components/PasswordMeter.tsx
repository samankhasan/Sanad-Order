import { ShieldCheck, ShieldAlert } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { pwRuleIssue, pwScore, type PwIssue } from '../lib/password'
import { cn } from '../lib/format'

const COLORS = ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500']
const LABELS = ['pwVeryWeak', 'pwWeak', 'pwFair', 'pwGood', 'pwStrong'] as const

/** Live strength bar + the first rule still missing (or the server-side issue, e.g. leaked). */
export default function PasswordMeter({ value, issue }: { value: string; issue?: PwIssue | null }) {
  const { t } = usePrefs()
  if (!value) return <p className="px-1 text-[11px] text-2">{t('passwordHint')}</p>
  const score = pwScore(value)
  const problem = issue ?? pwRuleIssue(value)
  return (
    <div className="space-y-1.5 px-1" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3, 4].map(i => <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= Math.max(score, 1) ? COLORS[score] : 'bg-black/10 dark:bg-white/10')} />)}
        </div>
        <span className={cn('shrink-0 text-[11px] font-bold', score >= 3 ? 'text-emerald-600 dark:text-emerald-400' : score === 2 ? 'text-amber-600' : 'text-rose-600')}>{t(LABELS[score])}</span>
      </div>
      <p className={cn('flex items-start gap-1 text-[11px] font-semibold', problem ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
        {problem ? <ShieldAlert className="mt-px size-3.5 shrink-0" /> : <ShieldCheck className="mt-px size-3.5 shrink-0" />}
        {problem ? t(problem) : t('pwOk')}
      </p>
    </div>
  )
}
