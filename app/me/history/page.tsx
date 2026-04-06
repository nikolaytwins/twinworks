'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HistoryRecord {
  id: string
  year: number
  month: number
  totalAccounts: number
  cushionAmount: number
  goalsAmount: number
  agencyExpectedRevenue: number
  agencyActualRevenue: number
  agencyExpectedProfit: number
  agencyActualProfit: number
  impulseExpectedRevenue: number
  impulseActualRevenue: number
  impulseExpectedProfit: number
  impulseActualProfit: number
  totalExpectedProfit: number
}

const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [addingMonth, setAddingMonth] = useState(false)
  const [newMonthYear, setNewMonthYear] = useState(new Date().getFullYear())
  const [newMonthMonth, setNewMonthMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    fetchHistory()
    // Автоматически проверяем и добавляем новые месяца при загрузке
    autoAddMissingMonths()
  }, [])

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history', { cache: 'no-store' })
      const data = await res.json()
      setHistory(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setLoading(false)
    }
  }

  const autoAddMissingMonths = async () => {
    try {
      // Сначала загружаем историю
      const res = await fetch('/api/history', { cache: 'no-store' })
      const currentHistory = await res.json()
      const historyArray = Array.isArray(currentHistory) ? currentHistory : []

      // Получаем текущую дату
      const today = new Date()
      const currentYear = today.getFullYear()
      const currentMonth = today.getMonth() + 1

      // Проверяем последние 3 месяца (текущий + 2 прошлых)
      let addedAny = false
      for (let i = 0; i < 3; i++) {
        const checkDate = new Date(currentYear, currentMonth - 1 - i, 1)
        const year = checkDate.getFullYear()
        const month = checkDate.getMonth() + 1

        // Проверяем, есть ли запись в истории
        const exists = historyArray.some((h: any) => h.year === year && h.month === month)
        
        if (!exists) {
          // Автоматически сохраняем месяц
          await fetch('/api/history/save-month', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, month })
          })
          addedAny = true
        }
      }

      // Обновляем список после добавления
      if (addedAny) {
        await fetchHistory()
      }
    } catch (error) {
      console.error('Error auto-adding months:', error)
    }
  }

  const handleAddMonth = async () => {
    if (!newMonthYear || !newMonthMonth) return

    setAddingMonth(true)
    try {
      // Вызываем API для сохранения конкретного месяца
      const res = await fetch('/api/history/save-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: newMonthYear, month: newMonthMonth })
      })

      if (res.ok) {
        await fetchHistory()
        // Сбрасываем форму
        setNewMonthYear(new Date().getFullYear())
        setNewMonthMonth(new Date().getMonth() + 1)
      } else {
        alert('Ошибка при добавлении месяца')
      }
    } catch (error) {
      console.error('Error adding month:', error)
      alert('Ошибка при добавлении месяца')
    } finally {
      setAddingMonth(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  // Group by year
  const groupedByYear = history.reduce((acc, record) => {
    if (!acc[record.year]) {
      acc[record.year] = []
    }
    acc[record.year].push(record)
    return acc
  }, {} as Record<number, HistoryRecord[]>)

  // Sort years descending
  const years = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a)

  // Генерируем список годов для селекта (последние 5 лет)
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">История по месяцам</h1>
        <div className="flex space-x-3">
          {/* Быстрое добавление месяца */}
          <div className="flex items-center space-x-2 border border-gray-300 rounded-md px-3 py-2">
            <select
              value={newMonthYear}
              onChange={(e) => setNewMonthYear(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={newMonthMonth}
              onChange={(e) => setNewMonthMonth(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {monthNames.map((name, index) => (
                <option key={index + 1} value={index + 1}>{name}</option>
              ))}
            </select>
            <button
              onClick={handleAddMonth}
              disabled={addingMonth}
              className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {addingMonth ? 'Добавление...' : 'Добавить месяц'}
            </button>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/history/save-current', { method: 'POST' })
              fetchHistory()
            }}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
          >
            Сохранить текущий месяц
          </button>
        </div>
      </div>

      {years.map((year) => {
        const yearRecords = groupedByYear[year].sort((a, b) => a.month - b.month)
        return (
          <div key={year} className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{year} год</h2>
            
            {/* Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Месяц</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Всего на счетах</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Выручка агентства</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль агентства</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Выручка Импульс</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль Импульс</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Общая прибыль</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {yearRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {monthNames[record.month - 1]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {record.totalAccounts.toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {record.agencyActualRevenue.toLocaleString('ru-RU')} ₽
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${record.agencyActualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {record.agencyActualProfit.toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {record.impulseActualRevenue.toLocaleString('ru-RU')} ₽
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${record.impulseActualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {record.impulseActualProfit.toLocaleString('ru-RU')} ₽
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${record.totalExpectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {record.totalExpectedProfit.toLocaleString('ru-RU')} ₽
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {history.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">Нет данных истории.</div>
          <button
            onClick={async () => {
              await fetch('/api/history/save-current', { method: 'POST' })
              fetchHistory()
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            Сохранить текущий месяц
          </button>
        </div>
      )}
    </div>
  )
}
