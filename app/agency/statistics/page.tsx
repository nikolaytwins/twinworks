'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HistoryRecord {
  id: string
  year: number
  month: number
  agencyActualRevenue: number
  agencyActualProfit: number
}

interface MonthlyData {
  month: string
  revenue: number
  expenses: number
  profit: number
}

interface RevenueByServiceItem {
  serviceType: string
  totalAmount: number
  count: number
  percent: number
}

interface RevenueByClientItem {
  clientType: string
  totalAmount: number
  count: number
  percent: number
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  site: 'Сайт',
  presentation: 'Презентация',
  small_task: 'Мелкая задача',
  subscription: 'Подписка',
}

const CLIENT_TYPE_LABELS: Record<string, string> = {
  '': 'Не указан',
  permanent: 'Постоянник',
  referral: 'Рекомендация',
  profi_ru: 'Профи.ру',
  networking: 'Нетворкинг',
}

type ChartTooltip = { month: string; revenue: number; profit: number; x: number; y: number } | null

export default function AgencyStatisticsPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [revenueByService, setRevenueByService] = useState<{ items: RevenueByServiceItem[]; total: number } | null>(null)
  const [revenueByClient, setRevenueByClient] = useState<{ items: RevenueByClientItem[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartTooltip, setChartTooltip] = useState<ChartTooltip>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [historyRes, serviceRes, clientRes] = await Promise.all([
        fetch('/api/history', { cache: 'no-store' }),
        fetch('/api/agency/statistics/revenue-by-service', { cache: 'no-store' }),
        fetch('/api/agency/statistics/revenue-by-client', { cache: 'no-store' }),
      ])
      const historyData = await historyRes.json()
      const serviceData = await serviceRes.json()
      const clientData = await clientRes.json()
      setHistory(Array.isArray(historyData) ? historyData : [])
      setRevenueByService(serviceData.items != null ? { items: serviceData.items, total: serviceData.total || 0 } : null)
      setRevenueByClient(clientData.items != null ? { items: clientData.items, total: clientData.total || 0 } : null)
    } catch (error) {
      console.error('Error fetching data:', error)
      setHistory([])
      setRevenueByService(null)
      setRevenueByClient(null)
    } finally {
      setLoading(false)
    }
  }

  // Получаем последние 12 месяцев из истории
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  
  // Сортируем историю по дате (от новых к старым)
  const sortedHistory = [...history].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.month - a.month
  })
  
  // Берем последние 12 месяцев
  const last12Months = sortedHistory.slice(0, 12)
  
  // Сортируем обратно для отображения (от старых к новым)
  const sortedForDisplay = [...last12Months].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })
  
  // Расчет месячных данных из последних 12 месяцев
  const monthlyData: MonthlyData[] = sortedForDisplay.map(record => ({
    month: `${monthNames[record.month - 1]} ${record.year}`,
    revenue: record.agencyActualRevenue || 0,
    expenses: 0, // Удаляем расходы
    profit: record.agencyActualProfit || 0,
  }))
  
  // Средние значения - считаем только по месяцам с данными из последних 12 месяцев
  const monthsWithData = last12Months.filter(h => (h.agencyActualRevenue || 0) > 0)
  const monthsCount = monthsWithData.length > 0 ? monthsWithData.length : 1
  
  // Считаем сумму только по месяцам с данными
  const totalRevenue = monthsWithData.reduce((sum, h) => sum + (h.agencyActualRevenue || 0), 0)
  const avgMonthlyRevenue = totalRevenue / monthsCount
  
  const totalProfit = monthsWithData.reduce((sum, h) => sum + (h.agencyActualProfit || 0), 0)
  const avgMonthlyProfit = totalProfit / monthsCount

  // Шкала для линейного графика: Y от minProfit до max(revenue, |profit|)
  const maxRevenue = monthlyData.length ? Math.max(...monthlyData.map(m => m.revenue), 0) : 1
  const minProfit = monthlyData.length ? Math.min(...monthlyData.map(m => m.profit), 0) : 0
  const maxProfitAbs = monthlyData.length ? Math.max(...monthlyData.map(m => Math.abs(m.profit)), 0) : 1
  const maxY = Math.max(maxRevenue, maxProfitAbs, 1)
  const minY = Math.min(minProfit, 0)
  const rangeY = maxY - minY || 1

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/agency" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
            ← Назад к проектам
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Статистика агентства</h1>
        </div>

        {/* Средние значения */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Средняя месячная выручка</div>
            <div className="text-2xl font-bold text-green-600">
              {avgMonthlyRevenue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
            </div>
            <div className="text-xs text-gray-500 mt-1">За последние 12 месяцев</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Средняя месячная прибыль</div>
            <div className={`text-2xl font-bold ${avgMonthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {avgMonthlyProfit.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
            </div>
            <div className="text-xs text-gray-500 mt-1">За последние 12 месяцев</div>
          </div>
        </div>

        {/* Выручка по типам услуг — за ВСЕ месяцы */}
        {revenueByService && revenueByService.items.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Выручка по типам услуг</h2>
            <div className="text-xs text-gray-500 mb-6">За все время (все проекты). Длина полосы — доля от общей выручки.</div>

            {/* Горизонтальные полосы: тип — полоса по % от общей выручки — сумма и % */}
            <div className="space-y-5 mb-6">
              {revenueByService.items.map((item, index) => {
                const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500']
                const color = colors[index % colors.length]
                const label = SERVICE_TYPE_LABELS[item.serviceType] || item.serviceType
                return (
                  <div key={item.serviceType} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex-shrink-0 sm:w-40">
                      <div className="text-sm font-medium text-gray-800" title={label}>{label}</div>
                      <div className="text-xs text-gray-500">{item.count} {item.count === 1 ? 'проект' : item.count < 5 ? 'проекта' : 'проектов'}</div>
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

            {/* Итоговая полоса — состав из сегментов (как пирог в одну полосу) */}
            <div className="border-t border-gray-200 pt-4">
              <div className="text-xs font-medium text-gray-500 mb-2">Состав выручки</div>
              <div className="h-10 rounded-lg overflow-hidden flex">
                {revenueByService.items.map((item, index) => {
                  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500']
                  return (
                    <div
                      key={item.serviceType}
                      className={`${colors[index % colors.length]} min-w-0 flex items-center justify-center transition-all hover:opacity-90`}
                      style={{ width: `${Math.max(item.percent, 2)}%` }}
                      title={`${SERVICE_TYPE_LABELS[item.serviceType] || item.serviceType}: ${item.percent}% · ${item.totalAmount.toLocaleString('ru-RU')} ₽`}
                    >
                      {item.percent >= 12 && (
                        <span className="text-xs font-medium text-white truncate px-1">
                          {SERVICE_TYPE_LABELS[item.serviceType] || item.serviceType}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-3 text-sm font-semibold text-gray-800">
                <span>Итого</span>
                <span>{revenueByService.total.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          </div>
        )}

        {/* Выручка по типам клиентов — за ВСЕ месяцы */}
        {revenueByClient && revenueByClient.items.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Выручка по типам клиентов</h2>
            <div className="text-xs text-gray-500 mb-6">За все время (все проекты). Длина полосы — доля от общей выручки.</div>

            <div className="space-y-5 mb-6">
              {revenueByClient.items.map((item, index) => {
                const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500']
                const color = colors[index % colors.length]
                const label = (CLIENT_TYPE_LABELS[item.clientType] ?? item.clientType) || 'Не указан'
                return (
                  <div key={item.clientType || '__empty__'} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex-shrink-0 sm:w-40">
                      <div className="text-sm font-medium text-gray-800" title={label}>{label}</div>
                      <div className="text-xs text-gray-500">{item.count} {item.count === 1 ? 'проект' : item.count < 5 ? 'проекта' : 'проектов'}</div>
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
                {revenueByClient.items.map((item, index) => {
                  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500']
                  const label = (CLIENT_TYPE_LABELS[item.clientType] ?? item.clientType) || 'Не указан'
                  return (
                    <div
                      key={item.clientType || '__empty__'}
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
                <span>{revenueByClient.total.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          </div>
        )}

        {/* Динамика по месяцам — линейный график */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Динамика по месяцам</h2>

          {monthlyData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500 text-sm border border-dashed border-gray-200 rounded-lg">
              Нет данных за последние 12 месяцев. Сохраните месяц в разделе «Проекты», чтобы появилась история.
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                {(() => {
                  const padLeft = 56
                  const padRight = 24
                  const padTop = 20
                  const padBottom = 44
                  const chartW = 640 - padLeft - padRight
                  const chartH = 280 - padTop - padBottom
                  const n = monthlyData.length
                  const stepX = n > 1 ? chartW / (n - 1) : chartW
                  const toX = (i: number) => padLeft + i * stepX
                  const toY = (val: number) => padTop + chartH - ((val - minY) / rangeY) * chartH

                  const revenuePoints = monthlyData.map((d, i) => `${toX(i)},${toY(d.revenue)}`).join(' ')
                  const profitPoints = monthlyData.map((d, i) => `${toX(i)},${toY(d.profit)}`).join(' ')
                  const chartBottom = padTop + chartH
                  const revenueArea = `M ${toX(0)},${chartBottom} L ${revenuePoints.replace(/ /g, ' L ')} L ${toX(n - 1)},${chartBottom} Z`
                  const profitArea = `M ${toX(0)},${chartBottom} L ${profitPoints.replace(/ /g, ' L ')} L ${toX(n - 1)},${chartBottom} Z`

                  return (
                    <div className="relative">
                      <svg
                        viewBox="0 0 640 280"
                        className="w-full min-w-[400px]"
                        style={{ height: '280px' }}
                        preserveAspectRatio="xMidYMid meet"
                        onMouseLeave={() => setChartTooltip(null)}
                      >
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {/* Сетка: горизонтальные линии */}
                        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                          const y = padTop + (1 - t) * chartH
                          return (
                            <line key={t} x1={padLeft} y1={y} x2={640 - padRight} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                          )
                        })}
                        {/* Ось Y: подписи */}
                        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                          const val = minY + t * rangeY
                          const y = padTop + (1 - t) * chartH
                          return (
                            <text key={t} x={52} y={y + 4} textAnchor="end" fill="#6b7280" style={{ fontSize: 11, fontFamily: 'sans-serif' }}>
                              {Math.round(val).toLocaleString('ru-RU')}
                            </text>
                          )
                        })}
                        {/* Заливка под линиями */}
                        <path d={revenueArea} fill="url(#revenueGrad)" />
                        <path d={profitArea} fill="url(#profitGrad)" />
                        {/* Линия выручки — синяя */}
                        <polyline
                          points={revenuePoints}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Линия прибыли — зелёная */}
                        <polyline
                          points={profitPoints}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Точки и зоны наведения для тултипа */}
                        {monthlyData.map((d, i) => {
                          const x = toX(i)
                          const hitR = 20
                          return (
                            <g key={i}>
                              <circle cx={x} cy={toY(d.revenue)} r={4} fill="#3b82f6" />
                              <circle cx={x} cy={toY(d.profit)} r={4} fill="#22c55e" />
                              <rect
                                x={x - hitR}
                                y={padTop}
                                width={hitR * 2}
                                height={chartH}
                                fill="transparent"
                                onMouseEnter={() => setChartTooltip({ month: d.month, revenue: d.revenue, profit: d.profit, x, y: 0 })}
                              />
                            </g>
                          )
                        })}
                        {/* Подписи по оси X */}
                        {monthlyData.map((d, i) => {
                          const label = `${d.month.split(' ')[0].slice(0, 3)} ${String(d.month.split(' ')[1] ?? '').slice(-2)}`
                          return (
                            <text key={i} x={toX(i)} y={268} textAnchor="middle" fill="#6b7280" style={{ fontSize: 10, fontFamily: 'sans-serif' }}>
                              {label}
                            </text>
                          )
                        })}
                      </svg>
                      {/* Тултип поверх SVG (в координатах viewBox не используем — рисуем в DOM) */}
                      {chartTooltip && (
                        <div
                          className="absolute z-10 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
                          style={{
                            left: '50%',
                            transform: 'translateX(-50%)',
                            top: 40,
                          }}
                        >
                          <div className="font-semibold text-gray-200 mb-1">{chartTooltip.month}</div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>Выручка: {chartTooltip.revenue.toLocaleString('ru-RU')} ₽</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span>Прибыль: {chartTooltip.profit.toLocaleString('ru-RU')} ₽</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-600">Выручка</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 rounded-full bg-green-500" />
                  <span className="text-xs text-gray-600">Прибыль</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
