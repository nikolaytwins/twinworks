'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewStudentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name'),
      productType: formData.get('productType'),
      totalAmount: parseFloat(formData.get('totalAmount') as string) || 0,
      paidAmount: parseFloat(formData.get('paidAmount') as string) || 0,
      deadline: formData.get('deadline') || null,
      status: formData.get('status'),
      trafficSource: formData.get('trafficSource') || null,
      notes: formData.get('notes') || null,
    }

    try {
      const res = await fetch('/api/impulse/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        router.push('/impulse')
        router.refresh()
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Ошибка при создании ученика')
      }
    } catch (err) {
      setError('Ошибка при создании ученика')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/impulse" className="text-purple-600 hover:text-purple-800 text-sm">
          ← Назад к ученикам
        </Link>
      </div>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Новый ученик</h1>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Имя ученика *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label htmlFor="productType" className="block text-sm font-medium text-gray-700 mb-1">
                Тип продукта *
              </label>
              <input
                id="productType"
                name="productType"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                placeholder="Например: Курс, Интенсив и т.д."
              />
            </div>

            <div>
              <label htmlFor="trafficSource" className="block text-sm font-medium text-gray-700 mb-1">
                Источник трафика
              </label>
              <select
                id="trafficSource"
                name="trafficSource"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">—</option>
                <option value="youtube">YouTube</option>
                <option value="recommendations">Рекомендации</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Сумма *
                </label>
                <input
                  id="totalAmount"
                  name="totalAmount"
                  type="number"
                  step="0.01"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label htmlFor="paidAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Оплачено
                </label>
                <input
                  id="paidAmount"
                  name="paidAmount"
                  type="number"
                  step="0.01"
                  defaultValue="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Статус
              </label>
              <select
                id="status"
                name="status"
                defaultValue="not_paid"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="not_paid">Не оплачен</option>
                <option value="prepaid">Предоплата</option>
                <option value="paid">Оплачен</option>
              </select>
            </div>

            <div>
              <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
                Дедлайн
              </label>
              <input
                id="deadline"
                name="deadline"
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Комментарии (например, рассрочка)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                placeholder="Внутренняя рассрочка, особые условия и т.д."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Link
                href="/impulse"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
