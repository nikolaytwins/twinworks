'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function UploadHistoryPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const formData = new FormData(e.currentTarget)
    const data = {
      year: parseInt(formData.get('year') as string),
      month: parseInt(formData.get('month') as string),
      totalAccounts: parseFloat(formData.get('totalAccounts') as string) || 0,
      cushionAmount: parseFloat(formData.get('cushionAmount') as string) || 0,
      goalsAmount: parseFloat(formData.get('goalsAmount') as string) || 0,
      agencyExpectedRevenue: parseFloat(formData.get('agencyExpectedRevenue') as string) || 0,
      agencyActualRevenue: parseFloat(formData.get('agencyActualRevenue') as string) || 0,
      agencyExpectedProfit: parseFloat(formData.get('agencyExpectedProfit') as string) || 0,
      agencyActualProfit: parseFloat(formData.get('agencyActualProfit') as string) || 0,
      impulseExpectedRevenue: parseFloat(formData.get('impulseExpectedRevenue') as string) || 0,
      impulseActualRevenue: parseFloat(formData.get('impulseActualRevenue') as string) || 0,
      impulseExpectedProfit: parseFloat(formData.get('impulseExpectedProfit') as string) || 0,
      impulseActualProfit: parseFloat(formData.get('impulseActualProfit') as string) || 0,
      totalExpectedProfit: parseFloat(formData.get('totalExpectedProfit') as string) || 0,
    }

    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        setSuccess('История сохранена!')
        ;(e.target as HTMLFormElement).reset()
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Ошибка при сохранении истории')
      }
    } catch (err) {
      setError('Ошибка при сохранении истории')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/me/history" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Назад к истории
        </Link>
      </div>

      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Загрузить данные за месяц</h1>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">
                  Год *
                </label>
                <input
                  id="year"
                  name="year"
                  type="number"
                  required
                  min="2020"
                  max="2030"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">
                  Месяц *
                </label>
                <select
                  id="month"
                  name="month"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="1">Январь</option>
                  <option value="2">Февраль</option>
                  <option value="3">Март</option>
                  <option value="4">Апрель</option>
                  <option value="5">Май</option>
                  <option value="6">Июнь</option>
                  <option value="7">Июль</option>
                  <option value="8">Август</option>
                  <option value="9">Сентябрь</option>
                  <option value="10">Октябрь</option>
                  <option value="11">Ноябрь</option>
                  <option value="12">Декабрь</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Счета</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="totalAccounts" className="block text-sm font-medium text-gray-700 mb-1">
                    Всего на счетах
                  </label>
                  <input
                    id="totalAccounts"
                    name="totalAccounts"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="cushionAmount" className="block text-sm font-medium text-gray-700 mb-1">
                    Подушка
                  </label>
                  <input
                    id="cushionAmount"
                    name="cushionAmount"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="goalsAmount" className="block text-sm font-medium text-gray-700 mb-1">
                    На цели
                  </label>
                  <input
                    id="goalsAmount"
                    name="goalsAmount"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Агентство</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="agencyExpectedRevenue" className="block text-sm font-medium text-gray-700 mb-1">
                    Предполагаемая выручка
                  </label>
                  <input
                    id="agencyExpectedRevenue"
                    name="agencyExpectedRevenue"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="agencyActualRevenue" className="block text-sm font-medium text-gray-700 mb-1">
                    Фактическая выручка
                  </label>
                  <input
                    id="agencyActualRevenue"
                    name="agencyActualRevenue"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="agencyExpectedProfit" className="block text-sm font-medium text-gray-700 mb-1">
                    Предполагаемая прибыль
                  </label>
                  <input
                    id="agencyExpectedProfit"
                    name="agencyExpectedProfit"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="agencyActualProfit" className="block text-sm font-medium text-gray-700 mb-1">
                    Фактическая прибыль
                  </label>
                  <input
                    id="agencyActualProfit"
                    name="agencyActualProfit"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Импульс</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="impulseExpectedRevenue" className="block text-sm font-medium text-gray-700 mb-1">
                    Предполагаемая выручка
                  </label>
                  <input
                    id="impulseExpectedRevenue"
                    name="impulseExpectedRevenue"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="impulseActualRevenue" className="block text-sm font-medium text-gray-700 mb-1">
                    Фактическая выручка
                  </label>
                  <input
                    id="impulseActualRevenue"
                    name="impulseActualRevenue"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="impulseExpectedProfit" className="block text-sm font-medium text-gray-700 mb-1">
                    Предполагаемая прибыль
                  </label>
                  <input
                    id="impulseExpectedProfit"
                    name="impulseExpectedProfit"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="impulseActualProfit" className="block text-sm font-medium text-gray-700 mb-1">
                    Фактическая прибыль
                  </label>
                  <input
                    id="impulseActualProfit"
                    name="impulseActualProfit"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div>
                <label htmlFor="totalExpectedProfit" className="block text-sm font-medium text-gray-700 mb-1">
                  Общая предполагаемая прибыль
                </label>
                <input
                  id="totalExpectedProfit"
                  name="totalExpectedProfit"
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Link
                href="/me/history"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
