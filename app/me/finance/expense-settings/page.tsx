'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface OneTimeExpense {
  id: string
  name: string
  amount: number
  month: number
  year: number
  paid?: boolean | number | string
  type?: string
}

export default function ExpenseSettingsPage() {
  const [dailyExpenseLimit, setDailyExpenseLimit] = useState(3500)
  const [oneTimeExpenses, setOneTimeExpenses] = useState<OneTimeExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newExpenseName, setNewExpenseName] = useState('')
  const [newExpenseAmount, setNewExpenseAmount] = useState('')
  const [newExpensePaid, setNewExpensePaid] = useState(false)
  const [newExpenseType, setNewExpenseType] = useState<'personal' | 'business'>('personal')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editExpenseName, setEditExpenseName] = useState('')
  const [editExpenseAmount, setEditExpenseAmount] = useState('')
  const [editExpensePaid, setEditExpensePaid] = useState(false)
  const [editExpenseType, setEditExpenseType] = useState<'personal' | 'business'>('personal')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/expense-settings')
      const data = await res.json()
      setDailyExpenseLimit(data.dailyExpenseLimit || 3500)
      setOneTimeExpenses(Array.isArray(data.oneTimeExpenses) ? data.oneTimeExpenses : [])
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDailyLimit = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/expense-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyExpenseLimit }),
      })
      if (res.ok) {
        alert('Настройки сохранены')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Ошибка при сохранении настроек')
    } finally {
      setSaving(false)
    }
  }

  const handleAddOneTimeExpense = async () => {
    if (!newExpenseName.trim() || !newExpenseAmount) return

    const today = new Date()
    try {
      const res = await fetch('/api/one-time-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newExpenseName.trim(),
          amount: parseFloat(newExpenseAmount),
          month: today.getMonth() + 1,
          year: today.getFullYear(),
          paid: newExpensePaid,
          type: newExpenseType,
        }),
      })

      if (res.ok) {
        setNewExpenseName('')
        setNewExpenseAmount('')
        setNewExpensePaid(false)
        setNewExpenseType('personal')
        fetchSettings()
      }
    } catch (error) {
      console.error('Error adding expense:', error)
    }
  }

  const handleTogglePaid = async (id: string, currentPaid: boolean | number | string) => {
    // Нормализуем currentPaid: 0, "0", false -> false; 1, "1", true -> true
    const isCurrentlyPaid = currentPaid === true || currentPaid === 1 || currentPaid === '1'
    const newPaid = !isCurrentlyPaid
    
    console.log('🔄 Переключение статуса оплаты на фронтенде:')
    console.log(`   ID расхода: ${id}`)
    console.log(`   Текущий статус: ${currentPaid} (тип: ${typeof currentPaid})`)
    console.log(`   isCurrentlyPaid: ${isCurrentlyPaid}`)
    console.log(`   Новый статус: ${newPaid} (тип: ${typeof newPaid})`)
    
    try {
      const requestBody = { id, paid: newPaid }
      console.log('📤 Отправка запроса:', requestBody)
      
      const res = await fetch('/api/one-time-expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (res.ok) {
        const responseData = await res.json()
        console.log('✅ Ответ от сервера:', responseData)
        fetchSettings()
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('❌ Ошибка при обновлении:', errorData)
        alert('Ошибка при обновлении статуса оплаты')
      }
    } catch (error) {
      console.error('❌ Ошибка при отправке запроса:', error)
      alert('Ошибка при обновлении статуса оплаты')
    }
  }

  const handleStartEdit = (expense: OneTimeExpense) => {
    setEditingId(expense.id)
    setEditExpenseName(expense.name)
    setEditExpenseAmount(expense.amount.toString())
    setEditExpensePaid(expense.paid === true || expense.paid === 1 || expense.paid === '1')
    setEditExpenseType((expense.type || 'personal') as 'personal' | 'business')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditExpenseName('')
    setEditExpenseAmount('')
    setEditExpensePaid(false)
    setEditExpenseType('personal')
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editExpenseName.trim() || !editExpenseAmount) return

    try {
      const res = await fetch('/api/one-time-expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          name: editExpenseName.trim(),
          amount: parseFloat(editExpenseAmount),
          type: editExpenseType,
          paid: editExpensePaid,
        }),
      })

      if (res.ok) {
        handleCancelEdit()
        fetchSettings()
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Failed to update expense:', errorData)
        alert('Ошибка при сохранении изменений')
      }
    } catch (error) {
      console.error('Error updating expense:', error)
      alert('Ошибка при сохранении изменений')
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Удалить разовый расход?')) return

    try {
      const res = await fetch(`/api/one-time-expenses?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchSettings()
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysRemaining = daysInMonth - today.getDate() + 1
  const projectedExpenses = (dailyExpenseLimit * daysRemaining) + oneTimeExpenses.reduce((sum, e) => sum + e.amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/me/finance" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Назад к финансам
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Настройки расходов</h1>

      {/* Daily Expense Limit */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ежедневный лимит расходов</h2>
        <div className="flex items-center space-x-4">
          <input
            type="number"
            step="0.01"
            value={dailyExpenseLimit}
            onChange={(e) => setDailyExpenseLimit(parseFloat(e.target.value) || 0)}
            className="px-4 py-2 border border-gray-300 rounded-md text-lg font-medium w-32"
          />
          <span className="text-gray-600">₽ в день</span>
          <button
            onClick={handleSaveDailyLimit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          Прогноз на оставшийся месяц: {projectedExpenses.toLocaleString('ru-RU')} ₽
          <br />
          ({dailyExpenseLimit.toLocaleString('ru-RU')} ₽ × {daysRemaining} дней + разовые расходы)
        </div>
      </div>

      {/* One-Time Expenses */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Разовые расходы за текущий месяц</h2>
        
        {/* Add new expense */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
          <div className="flex flex-wrap gap-3 mb-3">
            <input
              type="text"
              value={newExpenseName}
              onChange={(e) => setNewExpenseName(e.target.value)}
              placeholder="Название расхода"
              className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="number"
              step="0.01"
              value={newExpenseAmount}
              onChange={(e) => setNewExpenseAmount(e.target.value)}
              placeholder="Сумма"
              className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <select
              value={newExpenseType}
              onChange={(e) => setNewExpenseType(e.target.value as 'personal' | 'business')}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="personal">Личные</option>
              <option value="business">Рабочие</option>
            </select>
            <label className="flex items-center space-x-2 px-3 py-2">
              <input
                type="checkbox"
                checked={newExpensePaid}
                onChange={(e) => setNewExpensePaid(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Оплачен</span>
            </label>
            <button
              onClick={handleAddOneTimeExpense}
              disabled={!newExpenseName.trim() || !newExpenseAmount}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              Добавить
            </button>
          </div>
        </div>

        {/* List of expenses */}
        <div className="space-y-2">
          {oneTimeExpenses.map((expense) => {
            // Нормализуем значение paid: может быть 0, 1, true, false, "0", "1"
            const isPaid = expense.paid === true || expense.paid === 1 || expense.paid === '1'
            const isEditing = editingId === expense.id
            
            if (isEditing) {
              // Форма редактирования
              return (
                <div
                  key={expense.id}
                  className="p-4 bg-blue-50 rounded-lg border border-blue-200"
                >
                  <div className="flex flex-wrap gap-3 mb-3">
                    <input
                      type="text"
                      value={editExpenseName}
                      onChange={(e) => setEditExpenseName(e.target.value)}
                      placeholder="Название расхода"
                      className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={editExpenseAmount}
                      onChange={(e) => setEditExpenseAmount(e.target.value)}
                      placeholder="Сумма"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <select
                      value={editExpenseType}
                      onChange={(e) => setEditExpenseType(e.target.value as 'personal' | 'business')}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="personal">Личные</option>
                      <option value="business">Рабочие</option>
                    </select>
                    <label className="flex items-center space-x-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={editExpensePaid}
                        onChange={(e) => setEditExpensePaid(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Оплачен</span>
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={!editExpenseName.trim() || !editExpenseAmount}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )
            }
            
            // Обычное отображение
            return (
              <div
                key={expense.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isPaid ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPaid}
                      onChange={() => handleTogglePaid(expense.id, expense.paid ?? false)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-600">Оплачен</span>
                  </label>
                  <div>
                    <div className={`text-sm font-medium ${isPaid ? 'text-green-900' : 'text-gray-900'}`}>
                      {expense.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {expense.type === 'business' ? 'Рабочий расход' : 'Личный расход'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`text-sm font-medium ${isPaid ? 'text-green-900' : 'text-gray-900'}`}>
                    {expense.amount.toLocaleString('ru-RU')} ₽
                  </span>
                  <button
                    onClick={() => handleStartEdit(expense)}
                    className="text-blue-600 hover:text-blue-900 text-sm"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => handleDeleteExpense(expense.id)}
                    className="text-red-600 hover:text-red-900 text-sm"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            )
          })}
          {oneTimeExpenses.length === 0 && (
            <div className="text-center text-gray-500 py-8">Нет разовых расходов</div>
          )}
        </div>
      </div>
    </div>
  )
}
