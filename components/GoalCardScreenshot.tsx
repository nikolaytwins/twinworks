'use client'

/**
 * Компактная плашка цели для скриншота: уже и выше, чем на дашборде.
 * Размеры 1 в 1 под макет (белая карточка, иконка слева, "X of Y ₽", подпись снизу).
 */
export interface GoalCardScreenshotProps {
  currentAmount: number
  targetAmount: number
  label: string
  className?: string
}

function GoalIcon() {
  return (
    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-500">
        {/* Гора + флажок на вершине */}
        <path d="M5 20L12 9L19 20H5Z" fill="currentColor" />
        <path d="M12 9l2.5-4 1.5 4H12z" fill="currentColor" />
      </svg>
    </div>
  )
}

function formatAmount(n: number): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

export function GoalCardScreenshot({ currentAmount, targetAmount, label, className = '' }: GoalCardScreenshotProps) {
  const progress = targetAmount > 0 ? Math.min(100, (currentAmount / targetAmount) * 100) : 0

  return (
    <div
      className={
        'bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] flex items-start gap-3 px-4 py-3 ' +
        'w-[380px] min-h-[88px] box-border ' +
        className
      }
    >
      <GoalIcon />
      <div className="flex flex-col justify-center min-w-0 flex-1 pt-0.5">
        <div className="text-[15px] font-semibold text-gray-900 leading-tight">
          {formatAmount(currentAmount)} of {formatAmount(targetAmount)} ₽
        </div>
        <div className="text-[13px] text-gray-700 mt-0.5 leading-tight truncate" title={label}>
          {label}
        </div>
        <div className="mt-2 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
