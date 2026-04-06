'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Account {
  id: string
  name: string
  type: string
  currency: string
  balance: number
  notes?: string | null
}

export default function EditAccountPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      fetchAccount()
    }
  }, [id])

  const fetchAccount = async () => {
    try {
      const res = await fetch(`/api/accounts/${id}`)
      if (res.ok) {
        const data = await res.json()
        setAccount(data)
      } else {
        setError('Счёт не найден')
      }
    } catch (err) {
      setError('Ошибка при загрузке счёта')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name'),
      type: formData.get('type'),
      currency: formData.get('currency') || 'RUB',
      balance: parseFloat(formData.get('balance') as string) || 0,
      notes: formData.get('notes') as string || null,
    }

    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        router.push('/me/accounts')
        router.refresh()
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Ошибка при обновлении счёта')
      }
    } catch (err) {
      setError('Ошибка при обновлении счёта')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  if (!account) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/me/accounts" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Назад к счетам
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Счёт не найден'}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/me/accounts" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Назад к счетам
        </Link>
      </div>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Редактировать счёт</h1>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Название счёта *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={account.name}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                Тип счёта *
              </label>
              <select
                id="type"
                name="type"
                required
                defaultValue={account.type}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="card">Карта</option>
                <option value="cash">Наличные</option>
                <option value="bank">Банковский счёт</option>
                <option value="crypto">Криптовалюта</option>
                <option value="other">Другое</option>
              </select>
            </div>

            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
                Валюта
              </label>
              <select
                id="currency"
                name="currency"
                defaultValue={account.currency}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="RUB">₽ RUB</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>

            <div>
              <label htmlFor="balance" className="block text-sm font-medium text-gray-700 mb-1">
                Баланс
              </label>
              <input
                id="balance"
                name="balance"
                type="number"
                step="0.01"
                defaultValue={account.balance}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Комментарий
              </label>
              <input
                id="notes"
                name="notes"
                type="text"
                defaultValue={account.notes || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder={account.type === 'other' ? 'Откуда эти деньги?' : 'Опциональный комментарий'}
              />
              <p className="mt-1 text-xs text-gray-500">
                {account.type === 'other' ? 'Укажите источник этих денег' : 'Необязательное поле для заметок'}
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Link
                href="/me/accounts"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
