'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewProjectPage() {
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
      totalAmount: parseFloat(formData.get('totalAmount') as string) || 0,
      paidAmount: parseFloat(formData.get('paidAmount') as string) || 0,
      deadline: formData.get('deadline') || null,
      status: formData.get('status'),
      serviceType: formData.get('serviceType'),
      clientType: formData.get('clientType') || null,
      paymentMethod: formData.get('paymentMethod') || null,
      clientContact: formData.get('clientContact') || null,
      notes: formData.get('notes') || null,
    }

    try {
      const res = await fetch('/api/agency/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        router.push('/agency')
        router.refresh()
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Ошибка при создании проекта')
      }
    } catch (err) {
      setError('Ошибка при создании проекта')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/agency" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Назад к проектам
        </Link>
      </div>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Новый проект</h1>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Название проекта *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Сумма проекта *
                </label>
                <input
                  id="totalAmount"
                  name="totalAmount"
                  type="number"
                  step="0.01"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="serviceType" className="block text-sm font-medium text-gray-700 mb-1">
                Тип услуги *
              </label>
              <select
                id="serviceType"
                name="serviceType"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="site">Сайт</option>
                <option value="presentation">Презентация</option>
                <option value="small_task">Мелкая задача</option>
                <option value="subscription">Подписка</option>
              </select>
            </div>

            <div>
              <label htmlFor="clientType" className="block text-sm font-medium text-gray-700 mb-1">
                Тип клиента
              </label>
              <select
                id="clientType"
                name="clientType"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Не указано</option>
                <option value="permanent">Постоянник</option>
                <option value="referral">Рекомендация</option>
                <option value="profi_ru">Профи.ру</option>
                <option value="networking">Нетворкинг</option>
              </select>
            </div>

            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">
                Куда пришла оплата
              </label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Не указано</option>
                <option value="card">Карта</option>
                <option value="account">Расчетный счет</option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Статус
              </label>
              <select
                id="status"
                name="status"
                defaultValue="not_paid"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="clientContact" className="block text-sm font-medium text-gray-700 mb-1">
                Контакт заказчика
              </label>
              <input
                id="clientContact"
                name="clientContact"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Email или телефон"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Заметки
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Link
                href="/agency"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Создание...' : 'Создать проект'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
