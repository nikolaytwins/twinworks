'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import InlineSelect from '@/components/InlineSelect'

interface Lead {
  id: string
  contact: string
  source: string
  taskDescription: string | null
  status: string
  nextContactDate: string | null
  manualDateSet: boolean
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'Новые' },
  { value: 'contact_established', label: 'Контакт установлен' },
  { value: 'commercial_proposal', label: 'Коммерческое предложение' },
  { value: 'thinking', label: 'Думает / изучает' },
  { value: 'paid', label: 'Оплачен' },
  { value: 'pause', label: 'Пауза' },
]

const STATUS_COLUMNS = [
  'new',
  'contact_established',
  'commercial_proposal',
  'thinking',
  'paid',
  'pause',
]

interface Conversion {
  label: string
  count: number
  percentage: number
}

interface SourceStat {
  source: string
  count: number
}

interface Analytics {
  conversions: Conversion[]
  sources: SourceStat[]
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [sources, setSources] = useState<string[]>([])
  const [newSource, setNewSource] = useState('')
  const [showCustomSource, setShowCustomSource] = useState(false)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'all'>('month')

  useEffect(() => {
    fetchLeads()
    fetchAnalytics()
  }, [analyticsPeriod])

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true)
    try {
      let startDate: string | null = null
      let endDate: string | null = null
      
      if (analyticsPeriod === 'week') {
        const today = new Date()
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        startDate = weekAgo.toISOString().split('T')[0]
        endDate = today.toISOString().split('T')[0]
      } else if (analyticsPeriod === 'month') {
        const today = new Date()
        const monthAgo = new Date(today)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        startDate = monthAgo.toISOString().split('T')[0]
        endDate = today.toISOString().split('T')[0]
      }
      
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      
      const res = await fetch(`/api/agency/leads/analytics?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/agency/leads')
      
      if (!res.ok) {
        console.error('Failed to fetch leads:', res.status)
        setLeads([])
        setSources([])
        return
      }
      
      const data = await res.json()
      
      // Проверяем, что data - массив
      if (Array.isArray(data)) {
        setLeads(data)
        // Собираем уникальные источники
        const uniqueSources = Array.from(new Set(data.map((l: Lead) => l.source).filter(Boolean)))
        setSources(uniqueSources.sort())
      } else if (data.error) {
        console.error('API error:', data.error)
        setLeads([])
        setSources([])
      } else {
        // Если таблица еще не существует или пустая, возвращаем пустой массив
        setLeads([])
        setSources([])
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
      setSources([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const contact = formData.get('contact') as string
    const taskDescription = formData.get('taskDescription') as string
    const finalSource = showCustomSource ? newSource : (formData.get('source') as string)

    if (!contact || !finalSource) {
      alert('Пожалуйста, заполните обязательные поля (Контакт и Источник)')
      return
    }

    try {
      const res = await fetch('/api/agency/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact,
          source: finalSource,
          taskDescription: taskDescription || null,
          status: 'new',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setShowAddForm(false)
          e.currentTarget.reset()
          setNewSource('')
          setShowCustomSource(false)
          await fetchLeads()
          await fetchAnalytics()
        } else {
          alert(data.error || 'Ошибка при создании лида')
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(errorData.error || 'Ошибка при создании лида')
      }
    } catch (error) {
      console.error('Error adding lead:', error)
      alert('Ошибка при создании лида')
    }
  }

  const handleUpdateStatus = async (leadId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/agency/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        await fetchLeads()
        await fetchAnalytics()
      }
    } catch (error) {
      console.error('Error updating lead status:', error)
    }
  }

  const handleUpdateField = async (leadId: string, field: string, value: any) => {
    try {
      const res = await fetch(`/api/agency/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })

      if (res.ok) {
        await fetchLeads()
        await fetchAnalytics()
      }
    } catch (error) {
      console.error('Error updating lead:', error)
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Удалить лида?')) return

    try {
      const res = await fetch(`/api/agency/leads/${leadId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchLeads()
      }
    } catch (error) {
      console.error('Error deleting lead:', error)
    }
  }

  const handleDateChange = async (leadId: string, date: string) => {
    await handleUpdateField(leadId, 'nextContactDate', date || null)
  }

  // Группируем лиды по статусам
  const leadsByStatus = STATUS_COLUMNS.reduce((acc, status) => {
    acc[status] = leads.filter(l => l.status === status)
    return acc
  }, {} as Record<string, Lead[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Лиды</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          + Новый лид
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <form onSubmit={handleAddLead}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание задачи *
                </label>
                <input
                  type="text"
                  name="taskDescription"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Краткое описание задачи..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Контакт *
                </label>
                <input
                  type="text"
                  name="contact"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Имя, телефон, email..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Источник *
                </label>
                {!showCustomSource ? (
                  <select
                    name="source"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setShowCustomSource(true)
                        setNewSource('')
                      }
                    }}
                    required
                  >
                    <option value="">Выберите...</option>
                    {sources.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="__custom__">+ Добавить свой</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value)}
                      placeholder="Новый источник"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomSource(false)
                        setNewSource('')
                      }}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Отмена
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                Создать
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setNewSource('')
                  setShowCustomSource(false)
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Блок аналитики */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Аналитика</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setAnalyticsPeriod('week')}
              className={`px-3 py-1 text-sm rounded-md ${
                analyticsPeriod === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Неделя
            </button>
            <button
              onClick={() => setAnalyticsPeriod('month')}
              className={`px-3 py-1 text-sm rounded-md ${
                analyticsPeriod === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Месяц
            </button>
            <button
              onClick={() => setAnalyticsPeriod('all')}
              className={`px-3 py-1 text-sm rounded-md ${
                analyticsPeriod === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Все время
            </button>
          </div>
        </div>

        {analyticsLoading ? (
          <div className="text-center py-4 text-gray-500">Загрузка аналитики...</div>
        ) : analytics ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Конверсии */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Конверсии переходов</h3>
              {analytics.conversions.length > 0 ? (
                <div className="space-y-2">
                  {analytics.conversions.map((conv) => (
                    <div key={conv.label} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="text-sm text-gray-900">{conv.label}</div>
                        <div className="text-xs text-gray-600">
                          {conv.count} уникальных лидов
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {conv.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic py-2">Нет данных о конверсиях</div>
              )}
            </div>

            {/* Источники */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Источники</h3>
              {analytics.sources.length > 0 ? (
                <div className="space-y-2">
                  {analytics.sources
                    .sort((a, b) => b.count - a.count)
                    .map((source) => (
                      <div key={source.source} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="text-sm text-gray-900">{source.source}</div>
                        <div className="text-sm font-semibold text-gray-900">{source.count} лидов</div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic py-2">Нет данных об источниках</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">Нет данных</div>
        )}
      </div>

      {/* Канбан-доска */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {STATUS_COLUMNS.map((status) => {
            const statusLabel = STATUS_OPTIONS.find(o => o.value === status)?.label || status
            const columnLeads = leadsByStatus[status] || []

            return (
              <div
                key={status}
                className="flex-shrink-0 w-80 bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <h3 className="font-semibold text-gray-900 mb-3">
                  {statusLabel} ({columnLeads.length})
                </h3>
                <div className="space-y-3">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="mb-2">
                        {/* Заголовок - описание задачи */}
                        <div className="text-sm font-semibold text-gray-900 mb-2">
                          {lead.taskDescription || 'Без описания'}
                        </div>
                        {/* Контакт */}
                        <div className="text-xs text-gray-700 mb-1">
                          <span className="font-medium">Контакт:</span> {lead.contact}
                        </div>
                        {/* Источник */}
                        <div className="text-xs text-gray-600 mb-2">
                          <span className="font-medium">Источник:</span> {lead.source}
                        </div>
                        {/* Дата следующего касания */}
                        <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <label className="text-xs font-medium text-gray-700">Дата следующего касания:</label>
                          <input
                            type="date"
                            value={lead.nextContactDate ? lead.nextContactDate.split('T')[0] : ''}
                            onChange={(e) => handleDateChange(lead.id, e.target.value)}
                            className="text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <InlineSelect
                          value={lead.status}
                          options={STATUS_OPTIONS}
                          onChange={(value) => handleUpdateStatus(lead.id, value)}
                          className="text-xs"
                        />
                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                  {columnLeads.length === 0 && (
                    <div className="text-sm text-gray-400 text-center py-4">
                      Нет лидов
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
