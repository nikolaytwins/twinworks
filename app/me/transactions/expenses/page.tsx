'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface Category {
  id: string
  name: string
  type: string
  expectedMonthly: number
}

interface CategoryExpense {
  category: string
  amount: number
  month: string
}

function ExpensesContent() {
  const searchParams = useSearchParams()
  const month = searchParams.get('month')
  
  const [categories, setCategories] = useState<Category[]>([])
  const [expensesByCategory, setExpensesByCategory] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [month])

  const fetchData = async () => {
    try {
      const [categoriesRes, transactionsRes] = await Promise.all([
        fetch('/api/categories').then(r => r.json()),
        fetch(month ? `/api/transactions?month=${month}` : '/api/transactions').then(r => r.json()),
      ])
      
      setCategories(Array.isArray(categoriesRes) ? categoriesRes : [])
      
      // Calculate expenses by category
      const expenses: Record<string, number> = {}
      transactionsRes
        .filter((t: any) => t.type === 'expense' && t.category)
        .forEach((t: any) => {
          expenses[t.category] = (expenses[t.category] || 0) + t.amount
        })
      
      setExpensesByCategory(expenses)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const today = new Date()
  const currentMonth = month || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  const personalCategories = Array.isArray(categories) ? categories.filter(c => c.type === 'personal') : []
  const businessCategories = Array.isArray(categories) ? categories.filter(c => c.type === 'business') : []

  const personalTotal = personalCategories.reduce((sum, cat) => sum + (expensesByCategory[cat.name] || 0), 0)
  const personalExpected = personalCategories.reduce((sum, cat) => sum + cat.expectedMonthly, 0)
  
  const businessTotal = businessCategories.reduce((sum, cat) => sum + (expensesByCategory[cat.name] || 0), 0)
  const businessExpected = businessCategories.reduce((sum, cat) => sum + cat.expectedMonthly, 0)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Анализ расходов</h1>
        <div className="flex space-x-2">
          <input
            type="month"
            defaultValue={currentMonth}
            onChange={(e) => {
              window.location.href = `/me/transactions/expenses?month=${e.target.value}`
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <Link
            href="/me/transactions/categories"
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700"
          >
            Настройки категорий
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Личные расходы</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Ожидание:</span>
              <span className="font-medium">{personalExpected.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Факт:</span>
              <span className={`font-medium ${personalTotal > personalExpected ? 'text-red-600' : 'text-green-600'}`}>
                {personalTotal.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-gray-900 font-medium">Остаток:</span>
              <span className={`font-bold ${personalExpected - personalTotal < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {(personalExpected - personalTotal).toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Бизнес расходы</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Ожидание:</span>
              <span className="font-medium">{businessExpected.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Факт:</span>
              <span className={`font-medium ${businessTotal > businessExpected ? 'text-red-600' : 'text-green-600'}`}>
                {businessTotal.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-gray-900 font-medium">Остаток:</span>
              <span className={`font-bold ${businessExpected - businessTotal < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {(businessExpected - businessTotal).toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Личные расходы по категориям</h2>
          <div className="space-y-3">
            {personalCategories.map((cat) => {
              const amount = expensesByCategory[cat.name] || 0
              const diff = amount - cat.expectedMonthly
              return (
                <div key={cat.id} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                    <span className={`text-sm font-medium ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {amount.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Ожидание: {cat.expectedMonthly.toLocaleString('ru-RU')} ₽</span>
                    {diff !== 0 && (
                      <span className={diff > 0 ? 'text-red-600' : 'text-green-600'}>
                        {diff > 0 ? '+' : ''}{diff.toLocaleString('ru-RU')} ₽
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Бизнес расходы по категориям</h2>
          <div className="space-y-3">
            {businessCategories.map((cat) => {
              const amount = expensesByCategory[cat.name] || 0
              const diff = amount - cat.expectedMonthly
              return (
                <div key={cat.id} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                    <span className={`text-sm font-medium ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {amount.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Ожидание: {cat.expectedMonthly.toLocaleString('ru-RU')} ₽</span>
                    {diff !== 0 && (
                      <span className={diff > 0 ? 'text-red-600' : 'text-green-600'}>
                        {diff > 0 ? '+' : ''}{diff.toLocaleString('ru-RU')} ₽
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    }>
      <ExpensesContent />
    </Suspense>
  )
}
