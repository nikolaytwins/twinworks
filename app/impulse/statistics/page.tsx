'use client'

import { useEffect, useState } from 'react'

interface RevenueBySourceItem {
  trafficSource: string
  totalAmount: number
  count: number
  percent: number
}

const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  '': 'Не указан',
  youtube: 'YouTube',
  recommendations: 'Рекомендации',
}

export default function ImpulseStatisticsPage() {
  const [revenueBySource, setRevenueBySource] = useState<{ items: RevenueBySourceItem[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/impulse/statistics/revenue-by-source', { cache: 'no-store' })
      const data = await res.json()
      setRevenueBySource(data.items != null ? { items: data.items, total: data.total || 0 } : null)
    } catch (error) {
      console.error('Error fetching data:', error)
      setRevenueBySource(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Статистика Импульс</h1>

      {/* Выручка по источникам трафика — за ВСЕ время */}
      {revenueBySource && revenueBySource.items.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Выручка по источникам трафика</h2>
          <div className="text-xs text-gray-500 mb-6">За все время (все ученики). Длина полосы — доля от общей выручки.</div>

          <div className="space-y-5 mb-6">
            {revenueBySource.items.map((item, index) => {
              const colors = ['bg-purple-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500']
              const color = colors[index % colors.length]
              const label = (TRAFFIC_SOURCE_LABELS[item.trafficSource] ?? item.trafficSource) || 'Не указан'
              return (
                <div key={item.trafficSource || '__empty__'} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex-shrink-0 sm:w-40">
                    <div className="text-sm font-medium text-gray-800" title={label}>{label}</div>
                    <div className="text-xs text-gray-500">{item.count} {item.count === 1 ? 'ученик' : item.count < 5 ? 'ученика' : 'учеников'}</div>
                  </div>
                  <div className="flex-1 min-h-[32px] flex items-center gap-3">
                    <div className="flex-1 h-8 rounded-lg bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-lg transition-all duration-500`}
                        style={{ width: `${Math.max(item.percent, 1)}%` }}
                        title={`${item.percent}% · ${item.totalAmount.toLocaleString('ru-RU')} ₽`}
                      />
                    </div>
                    <div className="flex-shrink-0 text-right w-24 sm:w-28">
                      <div className="text-sm font-semibold text-gray-900 tabular-nums">{item.totalAmount.toLocaleString('ru-RU')} ₽</div>
                      <div className="text-xs text-gray-500 tabular-nums">{item.percent}%</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="text-xs font-medium text-gray-500 mb-2">Состав выручки</div>
            <div className="h-10 rounded-lg overflow-hidden flex">
              {revenueBySource.items.map((item, index) => {
                const colors = ['bg-purple-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500']
                const label = (TRAFFIC_SOURCE_LABELS[item.trafficSource] ?? item.trafficSource) || 'Не указан'
                return (
                  <div
                    key={item.trafficSource || '__empty__'}
                    className={`${colors[index % colors.length]} min-w-0 flex items-center justify-center transition-all hover:opacity-90`}
                    style={{ width: `${Math.max(item.percent, 2)}%` }}
                    title={`${label}: ${item.percent}% · ${item.totalAmount.toLocaleString('ru-RU')} ₽`}
                  >
                    {item.percent >= 12 && (
                      <span className="text-xs font-medium text-white truncate px-1">{label}</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-3 text-sm font-semibold text-gray-800">
              <span>Итого</span>
              <span>{revenueBySource.total.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Выручка по источникам трафика</h2>
          <div className="text-gray-500 text-sm">Нет данных. Добавьте учеников и укажите источник трафика.</div>
        </div>
      )}
    </div>
  )
}
