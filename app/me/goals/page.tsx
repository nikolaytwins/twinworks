'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { GoalCardScreenshot } from '@/components/GoalCardScreenshot'

interface Goal {
  id: string
  period: string
  name: string
  targetAmount: number
  currentAmount: number
  linkedAccountId: string | null
  linkedAccountBalance: number | null
  linkedAccountName: string | null
  deadline: string | null
  notes: string | null
}

interface Account {
  id: string
  name: string
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/goals')
      const data = await res.json()
      setGoals(data.goals || [])
      setAccounts(data.accounts || [])
    } catch (error) {
      console.error('Error fetching goals:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  const goalsWithCurrent = goals.map((goal) => {
    let current = goal.currentAmount
    if (goal.linkedAccountBalance !== null) {
      current = goal.linkedAccountBalance
    }
    return { ...goal, currentAmount: current }
  })

  const periodLabels: Record<string, string> = {
    month: 'Месяц',
    quarter: 'Квартал',
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Финансовые цели</h1>
        <Link
          href="/me/goals/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          + Новая цель
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goalsWithCurrent.map((goal) => {
          const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
          return (
            <div key={goal.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{goal.name}</h3>
                  {goal.linkedAccountName && (
                    <div className="text-sm text-gray-600 mt-1">
                      Привязан к счёту: {goal.linkedAccountName}
                    </div>
                  )}
                </div>
                <div className="flex space-x-3">
                  <Link
                    href={`/me/goals/${goal.id}/edit`}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Редактировать
                  </Link>
                </div>
              </div>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Прогресс</span>
                  <span className="font-medium">
                    {goal.currentAmount.toLocaleString('ru-RU')} / {goal.targetAmount.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${progress >= 100 ? 'bg-green-600' : 'bg-blue-600'}`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <div className="text-right text-xs text-gray-500 mt-1">
                  {progress.toFixed(1)}%
                </div>
              </div>
              {goal.notes && (
                <div className="mt-2 text-sm text-gray-600">{goal.notes}</div>
              )}
            </div>
          )
        })}
        {goals.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-500">
            Нет целей. <Link href="/me/goals/new" className="text-blue-600 hover:underline">Создайте новую цель</Link>
          </div>
        )}
      </div>

      {/* Технический режим: плашка для скриншота */}
      <section className="mt-10 pt-6 border-t border-gray-200">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Для скриншота</h2>
        <div className="flex flex-wrap gap-4 items-start">
          {goalsWithCurrent.length > 0 ? (
            goalsWithCurrent.map((goal) => (
              <GoalCardScreenshot
                key={goal.id}
                currentAmount={goal.currentAmount}
                targetAmount={goal.targetAmount}
                label={goal.name}
              />
            ))
          ) : (
            <GoalCardScreenshot currentAmount={0} targetAmount={300000} label="Таиланд" />
          )}
        </div>
      </section>
    </div>
  )
}
