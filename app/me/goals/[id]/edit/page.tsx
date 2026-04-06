'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Goal {
  id: string
  period: string
  name: string
  targetAmount: number
  currentAmount: number
  linkedAccountId: string | null
  deadline: string | null
  notes: string | null
}

interface Account {
  id: string
  name: string
}

export default function EditGoalPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [goal, setGoal] = useState<Goal | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      Promise.all([
        fetch(`/api/goals/${id}`).then(r => r.json()),
        fetch('/api/goals').then(r => r.json()),
      ]).then(([goalData, accountsData]) => {
        setGoal(goalData)
        setAccounts(accountsData.accounts || [])
        setLoading(false)
      }).catch(() => {
        setError('Цель не найдена')
        setLoading(false)
      })
    }
  }, [id])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name'),
      targetAmount: parseFloat(formData.get('targetAmount') as string) || 0,
      currentAmount: parseFloat(formData.get('currentAmount') as string) || 0,
      linkedAccountId: formData.get('linkedAccountId') || null,
      notes: formData.get('notes') || null,
    }

    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        router.push('/me/goals')
        router.refresh()
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Ошибка при обновлении цели')
      }
    } catch (err) {
      setError('Ошибка при обновлении цели')
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

  if (!goal) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/me/goals" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Назад к целям
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Цель не найдена'}
        </div>
      </div>
    )
  }


  return (
    <div>
      <div className="mb-6">
        <Link href="/me/goals" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Назад к целям
        </Link>
      </div>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Редактировать цель</h1>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Название цели *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={goal.name}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Целевая сумма *
                </label>
                <input
                  id="targetAmount"
                  name="targetAmount"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={goal.targetAmount}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="currentAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Текущая сумма
                </label>
                <input
                  id="currentAmount"
                  name="currentAmount"
                  type="number"
                  step="0.01"
                  defaultValue={goal.currentAmount}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="linkedAccountId" className="block text-sm font-medium text-gray-700 mb-1">
                Привязать к счёту (опционально)
              </label>
              <select
                id="linkedAccountId"
                name="linkedAccountId"
                defaultValue={goal.linkedAccountId || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Не привязывать</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Заметки
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={goal.notes || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Вы уверены, что хотите удалить эту цель?')) return
                  
                  try {
                    const res = await fetch(`/api/goals/${id}`, {
                      method: 'DELETE',
                    })
                    
                    if (res.ok) {
                      router.push('/me/goals')
                      router.refresh()
                    } else {
                      const errorData = await res.json()
                      setError(errorData.error || 'Ошибка при удалении цели')
                    }
                  } catch (err) {
                    setError('Ошибка при удалении цели')
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
              >
                Удалить
              </button>
              <div className="flex space-x-3">
                <Link
                  href="/me/goals"
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
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
