'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Category {
  id: string
  name: string
  type: string
  expectedMonthly: number
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (id: string, expectedMonthly: number) => {
    try {
      await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, expectedMonthly }),
      })
      setEditingId(null)
      fetchCategories()
    } catch (error) {
      console.error('Error updating category:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  const personalCategories = Array.isArray(categories) ? categories.filter(c => c.type === 'personal') : []
  const businessCategories = Array.isArray(categories) ? categories.filter(c => c.type === 'business') : []

  return (
    <div>
      <div className="mb-6">
        <Link href="/me/transactions/expenses" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Назад к анализу расходов
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Настройка категорий расходов</h1>
        <p className="text-sm text-gray-600 mt-1">Установите ожидаемые расходы по каждой категории</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Личные расходы</h2>
          <div className="space-y-4">
            {personalCategories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                <span className="text-sm font-medium text-gray-900 flex-1">{cat.name}</span>
                {editingId === cat.id ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={cat.expectedMonthly}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        handleSave(cat.id, value)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const value = parseFloat((e.target as HTMLInputElement).value) || 0
                          handleSave(cat.id, value)
                        }
                      }}
                      autoFocus
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-xs text-gray-500">₽/мес</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {cat.expectedMonthly.toLocaleString('ru-RU')} ₽
                    </span>
                    <button
                      onClick={() => setEditingId(cat.id)}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      Изменить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Бизнес расходы</h2>
          <div className="space-y-4">
            {businessCategories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                <span className="text-sm font-medium text-gray-900 flex-1">{cat.name}</span>
                {editingId === cat.id ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={cat.expectedMonthly}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        handleSave(cat.id, value)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const value = parseFloat((e.target as HTMLInputElement).value) || 0
                          handleSave(cat.id, value)
                        }
                      }}
                      autoFocus
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-xs text-gray-500">₽/мес</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {cat.expectedMonthly.toLocaleString('ru-RU')} ₽
                    </span>
                    <button
                      onClick={() => setEditingId(cat.id)}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      Изменить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
