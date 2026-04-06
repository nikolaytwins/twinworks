'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'

interface ProfiItem {
  id: string
  createdAt: string
  cost: number
  refundAmount: number
  status: string
  projectAmount: number | null
  notes: string | null
  updatedAt: string
  reminder?: { date: string; leadId: string } | null
}

interface ProfiStats {
  totalPaid: number
  totalRefunded: number
  netSpent: number
  totalResponses: number
  countResponse: number
  countConversation: number
  countProposal: number
  countPaid: number
  countRefunded: number
  countDrain: number
  totalProjectAmount: number
  roi: number
  responseToPaidRate: number
  costPerPayingClient: number | null
  avgCheckPaying: number | null
  funnel: {
    responses: number
    viewedResponses: number
    toConversation: number
    toProposal: number
    toPaid: number
    convRate: number
    proposalRate: number
    paidRate: number
  }
}

// Порядок: отклик → просмотрено → переписка → КП → оплачено; выходы: возврат, слив
const STATUS_OPTIONS = [
  { value: 'response', label: 'Отклик' },
  { value: 'viewed', label: 'Просмотрено' },
  { value: 'conversation', label: 'Переписка' },
  { value: 'proposal', label: 'КП' },
  { value: 'paid', label: 'Оплачено' },
  { value: 'refunded', label: 'Возврат' },
  { value: 'drain', label: 'Слив' },
]

export default function ProfiPage() {
  const [items, setItems] = useState<ProfiItem[]>([])
  const [stats, setStats] = useState<ProfiStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [quickCost, setQuickCost] = useState('')
  const [quickNotes, setQuickNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editProjectAmount, setEditProjectAmount] = useState('')
  const [editRefundAmount, setEditRefundAmount] = useState('')
  const [reminderItemId, setReminderItemId] = useState<string | null>(null)
  const [reminderLeadId, setReminderLeadId] = useState<string | null>(null)
  const [reminderDate, setReminderDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [reminderSaving, setReminderSaving] = useState(false)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/agency/profi-responses?stats=1')
      const data = await res.json()
      if (data.items && data.stats) {
        setItems(data.items)
        setStats(data.stats)
      } else if (Array.isArray(data)) {
        setItems(data)
        setStats(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const cost = parseFloat(quickCost.replace(',', '.'))
    if (isNaN(cost) || cost < 0) return
    setAdding(true)
    try {
      const res = await fetch('/api/agency/profi-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost, notes: quickNotes || undefined }),
      })
      const json = await res.json()
      if (json.success && json.item) {
        setItems(prev => [json.item, ...prev])
        setQuickCost('')
        setQuickNotes('')
        fetchData()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAdding(false)
    }
  }

  const handleStatusChange = async (id: string, status: string, payload?: { refundAmount?: number; projectAmount?: number }) => {
    try {
      const res = await fetch(`/api/agency/profi-responses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          ...(payload?.refundAmount != null && { refundAmount: payload.refundAmount }),
          ...(payload?.projectAmount != null && { projectAmount: payload.projectAmount }),
        }),
      })
      const json = await res.json()
      if (json.success && json.item) {
        setItems(prev => prev.map(r => r.id === id ? json.item : r))
        fetchData()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const openEdit = (item: ProfiItem) => {
    setEditingId(item.id)
    setEditRefundAmount(item.refundAmount ? String(item.refundAmount) : (item.status === 'refunded' ? String(item.cost) : ''))
    setEditProjectAmount(item.projectAmount != null ? String(item.projectAmount) : '')
  }

  const saveEdit = async () => {
    if (!editingId) return
    const item = items.find(r => r.id === editingId)
    if (!item) return
    const refundNum = editRefundAmount ? parseFloat(editRefundAmount.replace(',', '.')) : 0
    const projectNum = editProjectAmount ? parseFloat(editProjectAmount.replace(',', '.')) : undefined
    await handleStatusChange(item.id, item.status, {
      refundAmount: item.status === 'refunded' ? refundNum : undefined,
      projectAmount: item.status === 'paid' ? (projectNum ?? 0) : undefined,
    })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этот отклик?')) return
    try {
      const res = await fetch(`/api/agency/profi-responses/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setItems(prev => prev.filter(r => r.id !== id))
        fetchData()
      } else {
        alert(data.error || 'Ошибка удаления')
      }
    } catch (e) {
      console.error(e)
      alert('Ошибка удаления')
    }
  }

  if (loading) {
    return (
      <div className="text-gray-500 py-8">Загрузка...</div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profi.ru — экономика откликов</h1>

      {/* Экономика и конверсии (инфографика) */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Экономика</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Заплатил за отклики</span>
                <span className="font-medium">{stats.totalPaid.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Возвраты</span>
                <span className="font-medium text-green-600">−{stats.totalRefunded.toLocaleString('ru-RU')} ₽</span>
              </div>
              {stats.countDrain > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Сливов (отказ)</span>
                  <span className="font-medium text-gray-600">{stats.countDrain}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-700 font-medium">Чистые расходы</span>
                <span className="font-semibold">{stats.netSpent.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Сумма проектов</span>
                <span className="font-medium text-blue-600">{stats.totalProjectAmount.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-700 font-medium">ROI</span>
                <span className={`font-semibold ${stats.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(0)}%
                </span>
              </div>
            </dl>
            <p className="mt-3 text-xs text-gray-500">
              {stats.totalProjectAmount >= stats.netSpent
                ? 'Окупается: выручка по проектам больше расходов на отклики.'
                : 'Пока не окупается: расходы на отклики больше выручки по проектам.'}
            </p>
          </div>

          {/* Конверсии — логика: % от отклика в переписку → % от переписки в КП → % от КП в оплату */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Конверсии</h2>
            <div className="space-y-0">
              {/* 1. Количество откликов */}
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-bold">
                  {stats.funnel.responses}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">Откликов</div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mt-0.5">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
              <div className="flex justify-center py-0.5">
                <span className="text-gray-300 text-lg">↓</span>
              </div>
              {/* 2. Просмотренные отклики (без возврата) */}
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-400 text-white flex items-center justify-center text-sm font-bold">
                  {stats.funnel.viewedResponses}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 flex justify-between">
                    <span>Просмотренные отклики</span>
                    <span className="text-violet-600 font-semibold tabular-nums">
                      {stats.funnel.responses > 0
                        ? `${Math.round((stats.funnel.viewedResponses / stats.funnel.responses) * 1000) / 10}% от отклика`
                        : '—'}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mt-0.5">
                    <div
                      className="h-full rounded-full bg-violet-400 transition-all"
                      style={{ width: `${stats.funnel.responses > 0 ? Math.max((stats.funnel.viewedResponses / stats.funnel.responses) * 100, 2) : 2}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-center py-0.5">
                <span className="text-gray-300 text-lg">↓</span>
              </div>
              {/* 3. Переписка — % от отклика */}
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                  {stats.funnel.toConversation}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 flex justify-between">
                    <span>Переписка</span>
                    <span className="text-blue-600 font-semibold tabular-nums">{stats.funnel.convRate}% от отклика</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mt-0.5">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.max(stats.funnel.convRate, 2)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-center py-0.5">
                <span className="text-gray-300 text-lg">↓</span>
              </div>
              {/* 4. КП — % от переписки */}
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-bold">
                  {stats.funnel.toProposal}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 flex justify-between">
                    <span>КП</span>
                    <span className="text-indigo-600 font-semibold tabular-nums">{stats.funnel.proposalRate}% от переписки</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mt-0.5">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${Math.max(stats.funnel.convRate * (stats.funnel.proposalRate / 100), 2)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-center py-0.5">
                <span className="text-gray-300 text-lg">↓</span>
              </div>
              {/* 5. Оплачено — % от КП */}
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">
                  {stats.funnel.toPaid}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 flex justify-between">
                    <span>Оплачено</span>
                    <span className="text-emerald-600 font-semibold tabular-nums">{stats.funnel.paidRate}% от КП</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mt-0.5">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.max(stats.responseToPaidRate, 2)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Итого от отклика в оплату + цена и чек платящего */}
            <div className="mt-4 pt-3 border-t border-gray-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Итого от отклика в оплату</span>
                <span className="font-semibold text-violet-600 tabular-nums">{stats.responseToPaidRate}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Цена платящего клиента</span>
                <span className="font-medium tabular-nums text-gray-800">
                  {stats.costPerPayingClient != null
                    ? `${Math.round(stats.costPerPayingClient).toLocaleString('ru-RU')} ₽`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Средний чек платящего</span>
                <span className="font-medium tabular-nums text-gray-800">
                  {stats.avgCheckPaying != null
                    ? `${Math.round(stats.avgCheckPaying).toLocaleString('ru-RU')} ₽`
                    : '—'}
                </span>
              </div>
            </div>
            {(stats.countDrain > 0 || stats.countRefunded > 0) && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                {stats.countRefunded > 0 && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    Возврат: {stats.countRefunded}
                  </span>
                )}
                {stats.countDrain > 0 && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    Слив: {stats.countDrain}
                  </span>
                )}
              </div>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Узкое место — шаг с самым низким %.
            </p>
          </div>
        </div>
      )}

      {/* Добавить отклик — под экономикой */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Добавить отклик</h2>
        <form onSubmit={handleQuickAdd} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Стоимость отклика (₽)</label>
            <input
              type="text"
              inputMode="decimal"
              value={quickCost}
              onChange={e => setQuickCost(e.target.value)}
              placeholder="0"
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Заметка (необяз.)</label>
            <input
              type="text"
              value={quickNotes}
              onChange={e => setQuickNotes(e.target.value)}
              placeholder="Кратко о заявке"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !quickCost.trim()}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
          >
            {adding ? '…' : 'Добавить'}
          </button>
        </form>
      </div>

      {/* Список откликов */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <h2 className="text-lg font-semibold text-gray-800 p-4 border-b border-gray-100">Отклики</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-3 px-4 font-medium">Дата</th>
                <th className="py-3 px-4 font-medium">Стоимость</th>
                <th className="py-3 px-4 font-medium">Статус</th>
                <th className="py-3 px-4 font-medium">Возврат</th>
                <th className="py-3 px-4 font-medium">Сумма проекта</th>
                <th className="py-3 px-4 font-medium">Заметка</th>
                <th className="py-3 px-4 font-medium">Напоминание</th>
                <th className="py-3 px-4 w-20" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    Нет откликов. Добавьте первый выше.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-100 ${
                      item.status === 'response'
                        ? 'bg-amber-50 border-l-4 border-l-amber-400 hover:bg-amber-100/80'
                        : item.status === 'viewed'
                          ? 'bg-green-50 border-l-4 border-l-green-400 hover:bg-green-100/80'
                          : item.status === 'conversation'
                            ? 'bg-green-100 border-l-4 border-l-green-500 hover:bg-green-200/80'
                            : item.status === 'proposal'
                              ? 'bg-sky-50 border-l-4 border-l-sky-400 hover:bg-sky-100/80'
                              : item.status === 'paid'
                                ? 'bg-emerald-50 border-l-4 border-l-emerald-400 hover:bg-emerald-100/80'
                                : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap text-gray-700">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap font-medium">{item.cost.toLocaleString('ru-RU')} ₽</td>
                    <td className="py-2.5 px-4">
                      <select
                        value={item.status}
                        onChange={async (e) => {
                          const newStatus = e.target.value
                          if (newStatus === 'refunded') {
                            await handleStatusChange(item.id, newStatus, { refundAmount: item.cost })
                          } else if (newStatus === 'paid' && item.projectAmount == null) {
                            openEdit(item)
                            await handleStatusChange(item.id, newStatus)
                          } else {
                            await handleStatusChange(item.id, newStatus)
                          }
                        }}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 bg-white min-w-[120px]"
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-4">
                      {editingId === item.id && item.status === 'refunded' ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editRefundAmount}
                          onChange={e => setEditRefundAmount(e.target.value)}
                          onBlur={saveEdit}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : item.status === 'refunded' ? (
                        <span className="text-green-600">{item.refundAmount.toLocaleString('ru-RU')} ₽</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {editingId === item.id && item.status === 'paid' ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editProjectAmount}
                          onChange={e => setEditProjectAmount(e.target.value)}
                          onBlur={saveEdit}
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : item.status === 'paid' && item.projectAmount != null ? (
                        <span className="font-medium text-blue-600">{item.projectAmount.toLocaleString('ru-RU')} ₽</span>
                      ) : item.status === 'paid' ? (
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="text-blue-600 text-xs"
                        >
                          Указать сумму
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 max-w-[180px] truncate" title={item.notes || ''}>
                      {item.notes || '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="relative inline-block">
                        {reminderItemId === item.id ? (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px]">
                            <div className="text-xs font-medium text-gray-600 mb-2">Дата напоминания</div>
                            <input
                              type="date"
                              value={reminderDate}
                              onChange={e => setReminderDate(e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mb-2"
                            />
                            <div className="flex gap-1">
                              <button
                                type="button"
                                disabled={reminderSaving}
                                onClick={async () => {
                                  setReminderSaving(true)
                                  try {
                                    const dateIso = reminderDate.includes('T') ? reminderDate : `${reminderDate}T12:00:00.000Z`
                                    if (reminderLeadId) {
                                      const res = await fetch(`/api/agency/leads/${reminderLeadId}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ nextContactDate: new Date(dateIso).toISOString() }),
                                      })
                                      const data = await res.json()
                                      if (data.success) {
                                        setReminderItemId(null)
                                        setReminderLeadId(null)
                                        fetchData()
                                      } else {
                                        alert(data.error || 'Ошибка сохранения')
                                      }
                                    } else {
                                      const res = await fetch(`/api/agency/profi-responses/${item.id}/reminder`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ nextContactDate: reminderDate }),
                                      })
                                      const data = await res.json()
                                      if (data.success) {
                                        setReminderItemId(null)
                                        setReminderLeadId(null)
                                        fetchData()
                                      } else {
                                        alert(data.error || 'Ошибка создания напоминания')
                                      }
                                    }
                                  } catch (e) {
                                    console.error(e)
                                    alert('Ошибка')
                                  } finally {
                                    setReminderSaving(false)
                                  }
                                }}
                                className="px-2 py-1 bg-violet-600 text-white text-xs font-medium rounded hover:bg-violet-700 disabled:opacity-50"
                              >
                                {reminderSaving ? '…' : 'Сохранить'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setReminderItemId(null); setReminderLeadId(null) }}
                                className="px-2 py-1 border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : item.reminder ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReminderItemId(item.id)
                              setReminderLeadId(item.reminder!.leadId)
                              setReminderDate(item.reminder!.date.slice(0, 10))
                            }}
                            className="text-sm font-medium text-gray-800 hover:text-violet-600 cursor-pointer text-left"
                            title="Нажмите, чтобы изменить дату"
                          >
                            {formatDate(new Date(item.reminder.date))}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setReminderItemId(item.id)
                              setReminderLeadId(null)
                              const d = new Date()
                              d.setDate(d.getDate() + 1)
                              setReminderDate(d.toISOString().slice(0, 10))
                            }}
                            className="text-sm text-gray-400 hover:text-violet-600 cursor-pointer"
                            title="Нажмите, чтобы добавить дату напоминания"
                          >
                            —
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {(item.status === 'refunded' && item.refundAmount !== item.cost) || (item.status === 'paid' && item.projectAmount == null) ? (
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="text-violet-600 text-xs font-medium"
                          >
                            Изменить
                          </button>
                        ) : (item.status === 'refunded' || item.status === 'paid') ? (
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="text-gray-400 text-xs"
                          >
                            Изменить
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 text-xs hover:text-red-800"
                          title="Удалить отклик"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
