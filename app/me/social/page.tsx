'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface SocialFollower {
  id: string
  platform: string
  year: number
  month: number
  count: number
}

const platformLabels: Record<string, string> = {
  instagram: 'Инстаграм',
  youtube: 'Ютуб',
  telegram_channel: 'ТГ-канал',
  telegram_base: 'ТГ-база',
  telegram_private: 'ТГ-канал закрытый',
}

const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export default function SocialPage() {
  const [followers, setFollowers] = useState<SocialFollower[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [quickEdit, setQuickEdit] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [quickEditMonth, setQuickEditMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    fetchFollowers()
  }, [selectedYear])

  const fetchFollowers = async () => {
    try {
      // Fetch current year + previous year December
      const [currentYearRes, prevYearDecRes] = await Promise.all([
        fetch(`/api/social-followers?year=${selectedYear}`).then(r => r.json()),
        fetch(`/api/social-followers?year=${selectedYear - 1}&month=12`).then(r => r.json()).catch(() => []),
      ])
      
      const currentYearData = Array.isArray(currentYearRes) ? currentYearRes : []
      const prevYearDecData = Array.isArray(prevYearDecRes) ? prevYearDecRes : []
      
      // Combine both datasets
      setFollowers([...currentYearData, ...prevYearDecData])
    } catch (error) {
      console.error('Error fetching followers:', error)
      setFollowers([])
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (platform: string, month: number, count: number): Promise<boolean> => {
    try {
      const response = await fetch('/api/social-followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          year: selectedYear,
          month,
          count: count || 0,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        console.error('API Error:', response.status, data)
        throw new Error(data.error || `HTTP ${response.status}: Failed to save`)
      }
      
      if (data.success !== undefined && !data.success) {
        console.error('Save failed:', data)
        throw new Error(data.error || 'Save operation failed')
      }
      
      return true
    } catch (error: any) {
      console.error('Error saving follower count:', error)
      throw error
    }
  }

  const platforms = ['instagram', 'youtube', 'telegram_channel', 'telegram_base', 'telegram_private']
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  // Get current month data
  const currentMonth = new Date().getMonth() + 1
  const currentData = Array.isArray(followers) ? followers.filter(f => f.year === selectedYear && f.month === currentMonth) : []

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Подписчики в соцсетях</h1>
          <p className="text-sm text-gray-600 mt-1">Кликните на ячейку таблицы или используйте форму ниже для быстрого ввода</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Edit Form */}
      <div className="mb-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Быстрый ввод</h3>
          <div className="flex items-center space-x-2">
            <select
              value={quickEditMonth}
              onChange={(e) => {
                setQuickEditMonth(parseInt(e.target.value))
                setQuickEdit({}) // Reset form when month changes
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthNames[m - 1]} {selectedYear}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {platforms.map((platform) => {
            const monthData = Array.isArray(followers) 
              ? followers.find(d => d.platform === platform && d.year === selectedYear && d.month === quickEditMonth)
              : null
            const currentCount = monthData?.count || 0
            const inputKey = `quick_${platform}`
            
            return (
              <div key={platform}>
                <label className="block text-xs text-gray-600 mb-1">{platformLabels[platform]}</label>
                <input
                  type="number"
                  value={quickEdit[inputKey] ?? currentCount.toString()}
                  onChange={(e) => setQuickEdit({ ...quickEdit, [inputKey]: e.target.value })}
                  placeholder="0"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
            )
          })}
        </div>
        <div className="mt-3">
          <button
            onClick={async () => {
              setSaving(true)
              try {
                let savedCount = 0
                let errors: string[] = []
                
                for (const platform of platforms) {
                  const inputKey = `quick_${platform}`
                  const value = quickEdit[inputKey]
                  if (value !== undefined && value !== '' && value !== null) {
                    const count = parseInt(value.toString().trim()) || 0
                    if (count >= 0) {
                      try {
                        const result = await handleSave(platform, quickEditMonth, count)
                        if (result) savedCount++
                      } catch (error: any) {
                        errors.push(`${platformLabels[platform]}: ${error.message || 'Ошибка'}`)
                      }
                      // Small delay to avoid overwhelming the API
                      await new Promise(resolve => setTimeout(resolve, 100))
                    }
                  }
                }
                
                if (errors.length > 0) {
                  alert(`Ошибки при сохранении:\n${errors.join('\n')}`)
                } else if (savedCount > 0) {
                  setQuickEdit({})
                  // Wait a bit before refreshing
                  await new Promise(resolve => setTimeout(resolve, 300))
                  await fetchFollowers()
                }
              } catch (error: any) {
                console.error('Error saving:', error)
                alert(`Ошибка при сохранении: ${error.message || 'Неизвестная ошибка'}`)
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Сохранить всё'}
          </button>
        </div>
      </div>

      {/* Current Month Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {platforms.map((platform) => {
          const data = currentData.find(d => d.platform === platform)
          const count = data?.count || 0
          return (
            <div key={platform} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-600 mb-1">{platformLabels[platform]}</div>
              <div className="text-2xl font-bold text-gray-900">{count.toLocaleString('ru-RU')}</div>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      {selectedYear > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Динамика подписчиков</h2>
          <div className="space-y-4">
            {platforms.map((platform) => {
              // Get data for all months of selected year + December of previous year
              const yearData = Array.isArray(followers) 
                ? followers.filter(f => f.platform === platform && f.year === selectedYear)
                : []
              
              const prevYearDec = Array.isArray(followers)
                ? followers.find(f => f.platform === platform && f.year === selectedYear - 1 && f.month === 12)
                : null
              
              // Combine December of previous year + current year data
              const chartData: Array<{ month: number; count: number; label: string }> = []
              if (prevYearDec && prevYearDec.count > 0) {
                chartData.push({ month: 0, count: prevYearDec.count, label: `Дек ${selectedYear - 1}` })
              }
              
              months.forEach(month => {
                const data = yearData.find(d => d.month === month)
                chartData.push({ 
                  month, 
                  count: data?.count || 0, 
                  label: monthNames[month - 1].slice(0, 3) 
                })
              })
              
              const maxCount = Math.max(...chartData.map(d => d.count), 1)
              const currentValue = currentData.find(d => d.platform === platform)?.count || 0
              
              return (
                <div key={platform} className="border-b pb-8 last:border-0">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 mb-1">{platformLabels[platform]}</h3>
                      {currentValue > 0 && (
                        <span className="text-sm text-gray-600">Сейчас: {currentValue.toLocaleString('ru-RU')}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      Макс: {maxCount.toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: '180px' }}>
                    {chartData.map((point, idx) => {
                      const height = point.count > 0 ? Math.max((point.count / maxCount) * 100, 3) : 0
                      const hasData = point.count > 0
                      
                      return (
                        <div key={idx} className="flex flex-col items-center group relative" style={{ minWidth: '50px', flex: '1 1 0' }}>
                          {/* Bar container */}
                          <div className="w-full flex flex-col items-center justify-end relative mb-1" style={{ height: '140px' }}>
                            {hasData && (
                              <>
                                {/* Value label above bar */}
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 mb-2 text-xs font-medium text-gray-700 whitespace-nowrap z-10">
                                  {point.count.toLocaleString('ru-RU')}
                                </div>
                                {/* Bar */}
                                <div
                                  className="w-full bg-blue-600 rounded-t hover:bg-blue-700 transition-colors cursor-pointer relative mt-6"
                                  style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                                  title={`${point.label}: ${point.count.toLocaleString('ru-RU')}`}
                                />
                              </>
                            )}
                            {!hasData && (
                              <div className="w-full h-1 bg-gray-100 rounded mt-auto" />
                            )}
                          </div>
                          {/* Month label */}
                          <div className="w-full text-center mt-2" style={{ minHeight: '50px', paddingTop: '4px' }}>
                            <span className="text-xs text-gray-600 inline-block transform -rotate-45 origin-center whitespace-nowrap">
                              {point.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Платформа</th>
              {months.map((month) => (
                <th key={month} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  {monthNames[month - 1].slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {platforms.map((platform) => (
              <tr key={platform}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{platformLabels[platform]}</div>
                </td>
                {months.map((month) => {
                  const data = followers.find(f => f.platform === platform && f.month === month)
                  const count = data?.count || 0
                  const editId = `${platform}_${month}`
                  const isEditing = editing === editId

                  return (
                    <td key={month} className="px-4 py-4 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={async () => {
                            try {
                              const numValue = parseInt(editValue) || 0
                              await handleSave(platform, month, numValue)
                              await fetchFollowers()
                              setEditing(null)
                            } catch (error: any) {
                              alert(`Ошибка при сохранении: ${error.message || 'Неизвестная ошибка'}`)
                            }
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              try {
                                const numValue = parseInt(editValue) || 0
                                await handleSave(platform, month, numValue)
                                await fetchFollowers()
                                setEditing(null)
                              } catch (error: any) {
                                alert(`Ошибка при сохранении: ${error.message || 'Неизвестная ошибка'}`)
                              }
                            } else if (e.key === 'Escape') {
                              setEditing(null)
                            }
                          }}
                          autoFocus
                          className="w-24 px-2 py-1 border-2 border-blue-500 rounded text-sm text-center"
                        />
                      ) : (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            setEditing(editId)
                            setEditValue(count.toString())
                          }}
                          className="text-sm text-gray-900 hover:bg-blue-50 px-3 py-2 rounded cursor-pointer border border-transparent hover:border-blue-300 transition-colors min-w-[60px]"
                          title="Кликните чтобы редактировать"
                        >
                          {count > 0 ? count.toLocaleString('ru-RU') : '—'}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
