'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface Project {
  id: string
  name: string
  totalAmount: number
  paidAmount: number
  deadline: string | null
  status: string
  serviceType: string
  clientType: string | null
  paymentMethod: string | null
  clientContact: string | null
  notes: string | null
  createdAt: string
}

interface Expense {
  id: string
  employeeName: string
  employeeRole: string
  amount: number
  notes: string | null
}

interface ProjectDetail {
  id: string
  title: string
  quantity: number
  unitPrice: number
  order: number
}

function ExpenseRow({
  expense,
  roleLabels,
  onUpdate,
  onDelete,
}: {
  expense: Expense
  roleLabels: Record<string, string>
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

  const roleOptions = [
    { value: 'designer', label: 'Дизайнер' },
    { value: 'pm', label: 'Проджект' },
    { value: 'copywriter', label: 'Копирайтер' },
    { value: 'assistant', label: 'Ассистент' },
  ]

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
          <select
            value={tempValue}
            onChange={(e) => {
              setTempValue(e.target.value)
              handleSave('employeeRole')
            }}
            onBlur={() => setEditingField(null)}
            autoFocus
            className="w-full px-2 py-1 border border-blue-500 rounded text-sm"
          >
            {roleOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => handleStartEdit('employeeRole', expense.employeeRole)}
            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
          >
            {roleLabels[expense.employeeRole] || expense.employeeRole}
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

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [details, setDetails] = useState<ProjectDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [showExpenseForm, setShowExpenseForm] = useState(false)

  useEffect(() => {
    if (id) {
      fetchData()
    }
  }, [id])

  const fetchData = async () => {
    try {
      const [projectRes, expensesRes, detailsRes] = await Promise.all([
        fetch(`/api/agency/projects`).then(r => r.json()),
        fetch(`/api/agency/expenses?projectId=${id}`).then(r => r.json()),
        fetch(`/api/agency/project-details?projectId=${id}`).then(r => r.json()),
      ])
      
      const proj = projectRes.find((p: Project) => p.id === id)
      setProject(proj || null)
      setExpenses(expensesRes)
      setDetails(detailsRes)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDetail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const title = (formData.get('title') as string || '').trim()
    const quantity = parseFloat((formData.get('quantity') as string) || '1')
    const unitPrice = parseFloat((formData.get('unitPrice') as string) || '0')

    if (!title) return

    const data = {
      projectId: id,
      title,
      quantity: isNaN(quantity) ? 1 : quantity,
      unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
      order: details.length,
    }

    try {
      const res = await fetch('/api/agency/project-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const json = await res.json()
        if (json.detail) {
          setDetails([json.detail, ...details])
        } else {
          fetchData()
        }
        ;(e.currentTarget as HTMLFormElement).reset()
      }
    } catch (error) {
      console.error('Error adding project detail:', error)
    }
  }

  const handleUpdateDetail = (detailId: string, field: 'title' | 'quantity' | 'unitPrice') => {
    return async (value: string) => {
      const current = details.find(d => d.id === detailId)
      if (!current) return

      let next: Partial<ProjectDetail> = {}
      if (field === 'title') {
        next.title = value
      } else if (field === 'quantity') {
        const q = parseFloat(value.replace(',', '.'))
        next.quantity = isNaN(q) ? current.quantity : q
      } else if (field === 'unitPrice') {
        const p = parseFloat(value.replace(',', '.'))
        next.unitPrice = isNaN(p) ? current.unitPrice : p
      }

      const updated: ProjectDetail = { ...current, ...next }
      setDetails(details.map(d => d.id === detailId ? updated : d))

      try {
        const res = await fetch(`/api/agency/project-details/${detailId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        })
        if (!res.ok) {
          console.error('Failed to update project detail')
          fetchData()
        }
      } catch (error) {
        console.error('Error updating project detail:', error)
        fetchData()
      }
    }
  }

  const handleDeleteDetail = async (detailId: string) => {
    if (!confirm('Удалить строку детализации?')) return
    const prev = details
    setDetails(details.filter(d => d.id !== detailId))
    try {
      const res = await fetch(`/api/agency/project-details/${detailId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        console.error('Failed to delete project detail')
        setDetails(prev)
      }
    } catch (error) {
      console.error('Error deleting project detail:', error)
      setDetails(prev)
    }
  }

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data = {
      projectId: id,
      employeeName: formData.get('employeeName'),
      employeeRole: formData.get('employeeRole'),
      amount: parseFloat(formData.get('amount') as string),
      notes: formData.get('notes') || null,
    }

    try {
      const res = await fetch('/api/agency/expenses', {
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
      const res = await fetch(`/api/agency/expenses/${expenseId}`, {
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
      
      const res = await fetch(`/api/agency/expenses/${expenseId}`, {
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

  if (!project) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/agency" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Назад к проектам
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Проект не найден
        </div>
      </div>
    )
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalDetailsAmount = details.reduce((sum, d) => sum + d.quantity * d.unitPrice, 0)
  // Если есть детализация — она приоритетнее ручного totalAmount
  const effectiveTotalAmount = details.length > 0 ? totalDetailsAmount : project.totalAmount
  const profit = effectiveTotalAmount - totalExpenses

  const serviceLabels: Record<string, string> = {
    site: 'Сайт',
    presentation: 'Презентация',
    small_task: 'Мелкая задача',
    subscription: 'Подписка',
  }

  const paymentMethodLabels: Record<string, string> = {
    card: 'Карта',
    account: 'Расчетный счет',
  }

  const statusLabels: Record<string, string> = {
    not_paid: 'Не оплачен',
    prepaid: 'Предоплата',
    paid: 'Оплачен',
  }

  const clientTypeLabels: Record<string, string> = {
    permanent: 'Постоянник',
    referral: 'Рекомендация',
    profi_ru: 'Профи.ру',
    networking: 'Нетворкинг',
  }

  const roleLabels: Record<string, string> = {
    designer: 'Дизайнер',
    pm: 'Проджект',
    copywriter: 'Копирайтер',
    assistant: 'Ассистент',
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/agency" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Назад к проектам
        </Link>
      </div>

      {/* Детализация для клиента */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Детализация для клиента</h2>
          {totalDetailsAmount > 0 && (
            <div className="text-sm text-gray-700">
              Итого по детализации:{' '}
              <span className="font-semibold">
                {totalDetailsAmount.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleAddDetail} className="mb-4 bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-6">
              <label className="block text-xs font-medium text-gray-700 mb-1">Задача / услуга</label>
              <input
                name="title"
                type="text"
                placeholder="Например: Обложки для рилс"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Кол-во</label>
              <input
                name="quantity"
                type="number"
                step="0.01"
                defaultValue="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-right"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Стоимость</label>
              <input
                name="unitPrice"
                type="number"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-right"
              />
            </div>
            <div className="col-span-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Добавить
              </button>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Задача</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Кол-во</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Стоимость</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Итого</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {details.map((d) => {
                const lineTotal = d.quantity * d.unitPrice
                return (
                  <tr key={d.id}>
                    <td className="px-6 py-3 text-sm">
                      <input
                        type="text"
                        defaultValue={d.title}
                        onBlur={(e) => handleUpdateDetail(d.id, 'title')(e.target.value)}
                        className="w-full px-2 py-1 border border-transparent hover:border-gray-300 rounded-md text-sm"
                      />
                    </td>
                    <td className="px-6 py-3 text-sm text-right">
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={d.quantity}
                        onBlur={(e) => handleUpdateDetail(d.id, 'quantity')(e.target.value)}
                        className="w-24 px-2 py-1 border border-transparent hover:border-gray-300 rounded-md text-sm text-right"
                      />
                    </td>
                    <td className="px-6 py-3 text-sm text-right">
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={d.unitPrice}
                        onBlur={(e) => handleUpdateDetail(d.id, 'unitPrice')(e.target.value)}
                        className="w-28 px-2 py-1 border border-transparent hover:border-gray-300 rounded-md text-sm text-right"
                      />
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium">
                      {lineTotal.toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-6 py-3 text-sm text-right">
                      <button
                        onClick={() => handleDeleteDetail(d.id)}
                        className="text-red-600 hover:text-red-900 text-xs"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                )
              })}
              {details.length > 0 && (
                <tr className="bg-blue-50">
                  <td className="px-6 py-3 text-sm font-semibold text-gray-900">ИТОГО</td>
                  <td />
                  <td />
                  <td className="px-6 py-3 text-sm font-bold text-right text-gray-900">
                    {totalDetailsAmount.toLocaleString('ru-RU')} ₽
                  </td>
                  <td />
                </tr>
              )}
              {details.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    Детализация пока не добавлена
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        {project.deadline && (
          <p className="text-sm text-gray-600 mt-1">Дедлайн: {formatDate(new Date(project.deadline))}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Сумма проекта</div>
          <div className="text-xl font-bold text-gray-900">
            {effectiveTotalAmount.toLocaleString('ru-RU')} ₽
          </div>
          {details.length > 0 && effectiveTotalAmount !== project.totalAmount && (
            <div className="mt-1 text-xs text-gray-500">
              По детализации (ручное значение: {project.totalAmount.toLocaleString('ru-RU')} ₽)
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Оплачено</div>
          <div className="text-xl font-bold text-green-600">{project.paidAmount.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Расходы</div>
          <div className="text-xl font-bold text-red-600">{totalExpenses.toLocaleString('ru-RU')} ₽</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-600">Услуга</div>
            <div className="font-medium">{serviceLabels[project.serviceType] || project.serviceType}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Тип клиента</div>
            <div className="font-medium">{project.clientType ? (clientTypeLabels[project.clientType] || project.clientType) : '—'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Статус</div>
            <div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                project.status === 'paid' 
                  ? 'bg-green-100 text-green-800'
                  : project.status === 'prepaid'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {statusLabels[project.status]}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Контакт заказчика</div>
            <div className="font-medium">{project.clientContact || '—'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Способ оплаты</div>
            <div className="font-medium">
              {project.paymentMethod ? paymentMethodLabels[project.paymentMethod] || project.paymentMethod : '—'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Прибыль</div>
            <div className={`font-bold text-lg ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profit.toLocaleString('ru-RU')} ₽
            </div>
          </div>
        </div>
        {project.notes && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600 mb-1">Заметки</div>
            <div className="text-sm">{project.notes}</div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Расходы</h2>
          <button
            onClick={() => setShowExpenseForm(!showExpenseForm)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
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
                <select
                  name="employeeRole"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="designer">Дизайнер</option>
                  <option value="pm">Проджект</option>
                  <option value="copywriter">Копирайтер</option>
                  <option value="assistant">Ассистент</option>
                </select>
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
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
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
                  roleLabels={roleLabels}
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
