'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface Student {
  id: string
  name: string
  productType: string
  totalAmount: number
  paidAmount: number
  deadline: string | null
  status: string
  trafficSource: string | null
  notes: string | null
}

interface Expense {
  id: string
  employeeName: string
  employeeRole: string
  amount: number
  notes: string | null
}

function ExpenseRow({
  expense,
  onUpdate,
  onDelete,
}: {
  expense: Expense
  onUpdate: (id: string, field: string, value: any) => void
  onDelete: (id: string) => void
}) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempValue, setTempValue] = useState('')

  const handleStartEdit = (field: string, currentValue: any) => {
    setEditingField(field)
    setTempValue(currentValue?.toString() || '')
  }

  const handleSave = (field: string) => {
    let value: any = tempValue
    if (field === 'amount') {
      value = parseFloat(tempValue) || 0
    }
    onUpdate(expense.id, field, value)
    setEditingField(null)
  }

  const handleCancel = () => {
    setEditingField(null)
    setTempValue('')
  }

  return (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {editingField === 'employeeName' ? (
          <input
            type="text"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={() => handleSave('employeeName')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave('employeeName')
              if (e.key === 'Escape') handleCancel()
            }}
            autoFocus
            className="w-full px-2 py-1 border border-blue-500 rounded text-sm"
          />
        ) : (
          <button
            onClick={() => handleStartEdit('employeeName', expense.employeeName)}
            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-left"
          >
            {expense.employeeName}
          </button>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {editingField === 'employeeRole' ? (
          <input
            type="text"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={() => handleSave('employeeRole')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave('employeeRole')
              if (e.key === 'Escape') handleCancel()
            }}
            autoFocus
            className="w-full px-2 py-1 border border-blue-500 rounded text-sm"
          />
        ) : (
          <button
            onClick={() => handleStartEdit('employeeRole', expense.employeeRole)}
            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
          >
            {expense.employeeRole}
          </button>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
        {editingField === 'amount' ? (
          <input
            type="number"
            step="0.01"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={() => handleSave('amount')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave('amount')
              if (e.key === 'Escape') handleCancel()
            }}
            autoFocus
            className="w-24 px-2 py-1 border border-blue-500 rounded text-sm text-right"
          />
        ) : (
          <button
            onClick={() => handleStartEdit('amount', expense.amount)}
            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-right"
          >
            {expense.amount.toLocaleString('ru-RU')} ₽
          </button>
        )}
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        {editingField === 'notes' ? (
          <input
            type="text"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={() => handleSave('notes')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave('notes')
              if (e.key === 'Escape') handleCancel()
            }}
            autoFocus
            className="w-full px-2 py-1 border border-blue-500 rounded text-sm"
          />
        ) : (
          <button
            onClick={() => handleStartEdit('notes', expense.notes || '')}
            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-left w-full"
          >
            {expense.notes || '—'}
          </button>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={() => onDelete(expense.id)}
          className="text-red-600 hover:text-red-900"
        >
          Удалить
        </button>
      </td>
    </tr>
  )
}

export default function StudentPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [student, setStudent] = useState<Student | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showExpenseForm, setShowExpenseForm] = useState(false)

  useEffect(() => {
    if (id) {
      fetchData()
    }
  }, [id])

  const fetchData = async () => {
    try {
      const [studentsRes, expensesRes] = await Promise.all([
        fetch(`/api/impulse/students`).then(r => r.json()),
        fetch(`/api/impulse/expenses?studentId=${id}`).then(r => r.json()),
      ])
      
      const stud = studentsRes.find((s: Student) => s.id === id)
      setStudent(stud || null)
      setExpenses(expensesRes)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data = {
      studentId: id,
      employeeName: formData.get('employeeName'),
      employeeRole: formData.get('employeeRole'),
      amount: parseFloat(formData.get('amount') as string),
      notes: formData.get('notes') || null,
    }

    try {
      const res = await fetch('/api/impulse/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        setShowExpenseForm(false)
        fetchData()
        router.refresh()
      }
    } catch (error) {
      console.error('Error adding expense:', error)
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Удалить расход?')) return
    
    try {
      const res = await fetch(`/api/impulse/expenses/${expenseId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchData()
        router.refresh()
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const handleUpdateExpense = async (expenseId: string, field: string, value: any) => {
    try {
      const expense = expenses.find(e => e.id === expenseId)
      if (!expense) return

      const updatedExpense = { ...expense, [field]: value }
      
      // Optimistic update
      setExpenses(expenses.map(e => e.id === expenseId ? updatedExpense : e))
      
      const res = await fetch(`/api/impulse/expenses/${expenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedExpense),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.expense) {
          setExpenses(expenses.map(e => e.id === expenseId ? data.expense : e))
        }
      } else {
        // Revert on error
        fetchData()
      }
    } catch (error) {
      console.error('Error updating expense:', error)
      fetchData()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  if (!student) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/impulse" className="text-purple-600 hover:text-purple-800 text-sm">
            ← Назад к ученикам
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Ученик не найден
        </div>
      </div>
    )
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const profit = student.totalAmount - totalExpenses

  const statusLabels: Record<string, string> = {
    not_paid: 'Не оплачен',
    prepaid: 'Предоплата',
    paid: 'Оплачен',
  }

  const trafficSourceLabels: Record<string, string> = {
    youtube: 'YouTube',
    recommendations: 'Рекомендации',
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/impulse" className="text-purple-600 hover:text-purple-800 text-sm">
          ← Назад к ученикам
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
        <p className="text-sm text-gray-600 mt-1">Продукт: {student.productType}</p>
        {student.trafficSource && (
          <p className="text-sm text-gray-600">Источник трафика: {trafficSourceLabels[student.trafficSource] ?? student.trafficSource}</p>
        )}
        {student.deadline && (
          <p className="text-sm text-gray-600">Дедлайн: {formatDate(new Date(student.deadline))}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Сумма</div>
          <div className="text-xl font-bold text-gray-900">{student.totalAmount.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Оплачено</div>
          <div className="text-xl font-bold text-green-600">{student.paidAmount.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Расходы</div>
          <div className="text-xl font-bold text-red-600">{totalExpenses.toLocaleString('ru-RU')} ₽</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">Статус</div>
            <div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                student.status === 'paid' 
                  ? 'bg-green-100 text-green-800'
                  : student.status === 'prepaid'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {statusLabels[student.status]}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Прибыль</div>
            <div className={`font-bold text-lg ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profit.toLocaleString('ru-RU')} ₽
            </div>
          </div>
        </div>
        {student.notes && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600 mb-1">Комментарии</div>
            <div className="text-sm">{student.notes}</div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Расходы</h2>
          <button
            onClick={() => setShowExpenseForm(!showExpenseForm)}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700"
          >
            + Добавить расход
          </button>
        </div>

        {showExpenseForm && (
          <form onSubmit={handleAddExpense} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Имя сотрудника *</label>
                <input
                  name="employeeName"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Роль *</label>
                <input
                  name="employeeRole"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Например: куратор, менеджер"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Сумма *</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Заметки</label>
                <input
                  name="notes"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700"
              >
                Добавить
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сотрудник</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Роль</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Сумма</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Заметки</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  onUpdate={handleUpdateExpense}
                  onDelete={handleDeleteExpense}
                />
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    Нет расходов
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
