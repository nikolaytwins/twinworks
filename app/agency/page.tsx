'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import InlineSelect from '@/components/InlineSelect'

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
  totalExpenses: number
  totalDetailsAmount?: number
  effectiveTotalAmount?: number
  createdAt: string
}


function InlineInput({
  value,
  onChange,
  className = '',
}: {
  value: number
  onChange: (value: number) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value.toString())

  useEffect(() => {
    setTempValue(value.toString())
  }, [value])

  const handleSubmit = () => {
    const numValue = parseFloat(tempValue) || 0
    onChange(numValue)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setTempValue(value.toString())
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        type="number"
        step="0.01"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        autoFocus
        className={`w-24 px-2 py-1 border border-blue-500 rounded text-sm ${className}`}
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-right ${className}`}
    >
      {value.toLocaleString('ru-RU')} ₽
    </button>
  )
}

interface GeneralExpense {
  id: string
  employeeName: string | null
  employeeRole: string | null
  amount: number
  notes: string | null
  createdAt: string
}

export default function AgencyPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [isCustomExpense, setIsCustomExpense] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editingExpenseValue, setEditingExpenseValue] = useState('')
  
  // Месяц для фильтрации
  const today = new Date()
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)

  useEffect(() => {
    fetchProjects()
    fetchGeneralExpenses()
  }, [selectedYear, selectedMonth])

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/agency/projects')
      const data = await res.json()
      
      // Фильтруем проекты по выбранному месяцу
      const monthStart = new Date(selectedYear, selectedMonth - 1, 1)
      const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59)
      
      const filteredProjects = data.filter((p: Project) => {
        const projectDate = new Date(p.createdAt)
        return projectDate >= monthStart && projectDate <= monthEnd
      })
      
      // Fetch expenses for each project
      const projectsWithExpenses = await Promise.all(
        filteredProjects.map(async (p: Project) => {
          try {
            const expensesRes = await fetch(`/api/agency/expenses?projectId=${p.id}`)
            const expenses = await expensesRes.json()
            const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

            // Детализация проекта: если есть, она приоритетнее ручной суммы
            let totalDetailsAmount = 0
            try {
              const detailsRes = await fetch(`/api/agency/project-details?projectId=${p.id}`)
              const details = await detailsRes.json()
              if (Array.isArray(details)) {
                totalDetailsAmount = details.reduce(
                  (sum: number, d: any) => sum + (d.quantity || 0) * (d.unitPrice || 0),
                  0
                )
              }
            } catch {
              totalDetailsAmount = 0
            }
            const effectiveTotalAmount =
              totalDetailsAmount > 0 ? totalDetailsAmount : p.totalAmount
            
            // Автоматически корректируем paidAmount в зависимости от статуса
            let correctedPaidAmount = p.paidAmount
            if (p.status === 'paid' && p.paidAmount !== effectiveTotalAmount) {
              // Если статус "Оплачен", но paidAmount не равен сумме проекта - исправляем
              correctedPaidAmount = effectiveTotalAmount
              // Обновляем на сервере
              try {
                await fetch(`/api/agency/projects/${p.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...p, paidAmount: effectiveTotalAmount }),
                })
              } catch {}
            } else if (p.status === 'not_paid' && p.paidAmount !== 0) {
              // Если статус "Не оплачен", но paidAmount не равен 0 - исправляем
              correctedPaidAmount = 0
              // Обновляем на сервере
              try {
                await fetch(`/api/agency/projects/${p.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...p, paidAmount: 0 }),
                })
              } catch {}
            }
            
            return {
              ...p,
              totalExpenses,
              totalDetailsAmount,
              effectiveTotalAmount,
              paidAmount: correctedPaidAmount,
            }
          } catch {
            return { ...p, totalExpenses: 0 }
          }
        })
      )
      
      // Sort projects: paid first, prepaid second, not_paid last
      const sortedProjects = projectsWithExpenses.sort((a, b) => {
        const statusOrder: Record<string, number> = {
          'paid': 0,
          'prepaid': 1,
          'not_paid': 2
        }
        return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
      })
      
      setProjects(sortedProjects)
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchGeneralExpenses = async () => {
    try {
      const res = await fetch('/api/agency/general-expenses')
      const data = await res.json()
      const allExpenses = Array.isArray(data) ? data : []
      
      // Фильтруем общие расходы по выбранному месяцу
      const monthStart = new Date(selectedYear, selectedMonth - 1, 1)
      const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59)
      
      const filteredExpenses = allExpenses.filter((e: GeneralExpense) => {
        const expenseDate = new Date(e.createdAt)
        return expenseDate >= monthStart && expenseDate <= monthEnd
      })
      
      setGeneralExpenses(filteredExpenses)
    } catch (error) {
      console.error('Error fetching general expenses:', error)
      setGeneralExpenses([])
    }
  }

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const amountValue = formData.get('amount') as string
    const amount = parseFloat(amountValue)
    
    if (isNaN(amount) || amount <= 0) {
      alert('Пожалуйста, введите корректную сумму')
      return
    }
    
    const data = {
      employeeName: isCustomExpense ? null : (formData.get('employeeName') as string || null),
      employeeRole: isCustomExpense ? null : (formData.get('employeeRole') as string || null),
      amount: amount,
      notes: formData.get('notes') as string || null,
    }

    try {
      const res = await fetch('/api/agency/general-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      let responseData = null
      try {
        responseData = await res.json()
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError)
      }
      
      if (res.status === 200 && responseData?.success) {
        setShowExpenseForm(false)
        setIsCustomExpense(false)
        // Reset form
        if (e.currentTarget) {
          e.currentTarget.reset()
        }
        await fetchGeneralExpenses()
        await fetchProjects() // Reload to update totals
      } else {
        console.error('Error response:', responseData)
        // Обновляем список на случай, если сохранение все равно прошло
        await fetchGeneralExpenses()
        await fetchProjects()
        setShowExpenseForm(false)
        setIsCustomExpense(false)
        if (e.currentTarget) {
          e.currentTarget.reset()
        }
      }
    } catch (error) {
      console.error('Error adding expense:', error)
      // Даже при ошибке попробуем обновить список на случай, если сохранение прошло
      await fetchGeneralExpenses()
      await fetchProjects()
      setShowExpenseForm(false)
      setIsCustomExpense(false)
      if (e.currentTarget) {
        e.currentTarget.reset()
      }
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Удалить расход?')) return
    
    try {
      const res = await fetch(`/api/agency/general-expenses/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchGeneralExpenses()
        fetchProjects() // Reload to update totals
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const handleUpdateGeneralExpense = async (id: string, field: 'amount' | 'notes', value: number | string) => {
    const expense = generalExpenses.find(e => e.id === id)
    if (!expense) return
    setEditingExpenseId(null)
    try {
      const body = field === 'amount' ? { ...expense, amount: value } : { ...expense, [field]: value }
      const res = await fetch(`/api/agency/general-expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.expense) {
          setGeneralExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data.expense } : e))
        }
      }
    } catch (error) {
      console.error('Error updating expense:', error)
    }
  }

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Удалить проект? Это действие нельзя отменить.')) return
    try {
      const res = await fetch(`/api/agency/projects/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        console.error('Failed to delete project:', await res.json().catch(() => ({})))
        return
      }
      // Перезагружаем список проектов после удаления
      await fetchProjects()
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const handleUpdate = async (id: string, field: string, value: any) => {
    try {
      const project = projects.find(p => p.id === id)
      if (!project) return

      const updatedProject = { ...project, [field]: value }
      
      // Автоматически управляем paidAmount в зависимости от статуса
      if (field === 'status') {
        if (value === 'paid') {
          // Если статус "Оплачен" - автоматически устанавливаем paidAmount = totalAmount
          updatedProject.paidAmount = project.totalAmount
        } else if (value === 'not_paid') {
          // Если статус "Не оплачен" - автоматически устанавливаем paidAmount = 0
          updatedProject.paidAmount = 0
        }
        // Если статус "Предоплата" - оставляем текущее значение paidAmount (можно редактировать)
      }
      
      // Optimistic update first
      const updatedProjects = projects.map(p => p.id === id ? updatedProject : p)
      
      // Re-sort after status change
      const sortedProjects = updatedProjects.sort((a, b) => {
        const statusOrder: Record<string, number> = {
          'paid': 0,
          'prepaid': 1,
          'not_paid': 2
        }
        return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
      })
      
      setProjects(sortedProjects)
      
      const res = await fetch(`/api/agency/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProject),
      })
      
      if (res.ok) {
        const data = await res.json()
        // Update UI with server response to ensure consistency
        if (data.project) {
          // Keep totalExpenses from current project
          const currentProject = projects.find(p => p.id === id)
          const updatedWithExpenses = { 
            ...data.project, 
            totalExpenses: currentProject?.totalExpenses || 0 
          }
          
          const updatedProjects = projects.map(p => p.id === id ? updatedWithExpenses : p)
          
          // Re-sort after update
          const sortedProjects = updatedProjects.sort((a, b) => {
            const statusOrder: Record<string, number> = {
              'paid': 0,
              'prepaid': 1,
              'not_paid': 2
            }
            return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
          })
          
          setProjects(sortedProjects)
        }
      } else {
        console.error('Failed to update project:', res.status)
        // Revert on error - reload from server
        const errorData = await res.json().catch(() => ({}))
        console.error('Error details:', errorData)
        fetchProjects()
      }
    } catch (error) {
      console.error('Error updating project:', error)
      // Revert on error - reload from server
      fetchProjects()
    }
  }

  // Ожидаемая выручка: если есть детализация, берем сумму из неё (effectiveTotalAmount), иначе totalAmount
  const expectedRevenue = projects.reduce(
    (sum, p) => sum + (p.effectiveTotalAmount ?? p.totalAmount),
    0
  )
  const actualRevenue = projects.reduce((sum, p) => sum + p.paidAmount, 0)
  const projectExpenses = projects.reduce((sum, p) => sum + (p.totalExpenses || 0), 0)
  const generalExpensesTotal = generalExpenses.reduce((sum, e) => sum + e.amount, 0)
  
  // Расчет налогов: 6916 руб/месяц + 1% от суммы на расчетный счет
  const accountRevenue = projects
    .filter(p => p.paymentMethod === 'account' && p.status === 'paid')
    .reduce((sum, p) => sum + p.paidAmount, 0)
  const taxAmount = 6916 + (accountRevenue * 0.01)
  
  const totalExpenses = projectExpenses + generalExpensesTotal + taxAmount
  const expectedProfit = expectedRevenue - totalExpenses
  const actualProfit = actualRevenue - totalExpenses

  const roleLabels: Record<string, string> = {
    designer: 'Дизайнер',
    pm: 'Проджект',
    copywriter: 'Копирайтер',
    assistant: 'Ассистент',
  }

  const statusOptions = [
    { value: 'not_paid', label: 'Не оплачен' },
    { value: 'prepaid', label: 'Предоплата' },
    { value: 'paid', label: 'Оплачен' },
  ]

  const serviceOptions = [
    { value: 'site', label: 'Сайт' },
    { value: 'presentation', label: 'Презентация' },
    { value: 'small_task', label: 'Мелкая задача' },
    { value: 'subscription', label: 'Подписка' },
  ]

  const paymentMethodOptions = [
    { value: 'card', label: 'Карта' },
    { value: 'account', label: 'Расчетный счет' },
  ]

  const clientTypeBaseOptions = [
    { value: 'permanent', label: 'Постоянник' },
    { value: 'referral', label: 'Рекомендация' },
    { value: 'profi_ru', label: 'Профи.ру' },
    { value: 'networking', label: 'Нетворкинг' },
  ]
  const clientTypeFromProjects = Array.from(
    new Set(projects.map(p => p.clientType).filter((t): t is string => Boolean(t)))
  ).filter(t => !clientTypeBaseOptions.some(o => o.value === t))
  const clientTypeOptions: { value: string; label: string }[] = [
    ...clientTypeBaseOptions,
    ...clientTypeFromProjects.map(t => ({ value: t, label: t })),
    { value: '__add__', label: '➕ Добавить...' },
  ]
  const clientTypeDisplayOptions = [
    { value: '', label: '—' },
    ...clientTypeBaseOptions,
    ...clientTypeFromProjects.map(t => ({ value: t, label: t })),
    { value: '__add__', label: '➕ Добавить...' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">Проекты</h1>
          {/* Селектор месяца */}
          <div className="flex items-center space-x-2 border border-gray-300 rounded-md px-3 py-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {monthNames.map((name, index) => (
                <option key={index + 1} value={index + 1}>{name}</option>
              ))}
            </select>
            {selectedYear !== today.getFullYear() || selectedMonth !== today.getMonth() + 1 ? (
              <button
                onClick={() => {
                  setSelectedYear(today.getFullYear())
                  setSelectedMonth(today.getMonth() + 1)
                }}
                className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                title="Вернуться к текущему месяцу"
              >
                Сегодня
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/agency/projects/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            + Новый проект
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Предполагаемая выручка</div>
          <div className="text-xl font-bold text-gray-900">{expectedRevenue.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Фактическая выручка</div>
          <div className="text-xl font-bold text-gray-900">{actualRevenue.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Расходы</div>
          <div className="text-xl font-bold text-red-600">{totalExpenses.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Прибыль</div>
          <div className={`text-xl font-bold ${expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {expectedProfit.toLocaleString('ru-RU')} ₽
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Проект
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Услуга
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Тип клиента
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Контакт
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Способ оплаты
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Сумма
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Оплачено
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project.id}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/agency/projects/${project.id}`} className="text-base font-medium text-blue-600 hover:text-blue-800">
                      {project.name}
                    </Link>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault()
                        const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
                        const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
                        try {
                          const res = await fetch(`/api/agency/projects/${project.id}/copy`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ year: nextYear, month: nextMonth }),
                          })
                          if (res.ok) await fetchProjects()
                          else console.error('Failed to copy project:', await res.json())
                        } catch (err) {
                          console.error('Error copying project:', err)
                        }
                      }}
                      className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                      title={`Копировать на ${monthNames[selectedMonth === 12 ? 0 : selectedMonth]} ${selectedMonth === 12 ? selectedYear + 1 : selectedYear} (с расходами)`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    {project.status !== 'paid' && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault()
                          const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
                          const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
                          try {
                            const res = await fetch(`/api/agency/projects/${project.id}/move-to-month`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ year: nextYear, month: nextMonth }),
                            })
                            if (res.ok) await fetchProjects()
                            else console.error('Failed to move project:', await res.json())
                          } catch (err) {
                            console.error('Error moving project:', err)
                          }
                        }}
                        className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                        title={`Перенести на ${monthNames[selectedMonth === 12 ? 0 : selectedMonth]} ${selectedMonth === 12 ? selectedYear + 1 : selectedYear}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        handleDeleteProject(project.id)
                      }}
                      className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      title="Удалить проект"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4m-6 0h2m4 0h2m-9 4h10" />
                      </svg>
                    </button>
                  </div>
                  {project.deadline && (
                    <div className="text-xs text-gray-500 mt-0.5">{formatDate(new Date(project.deadline))}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <InlineSelect
                    value={project.serviceType}
                    options={serviceOptions}
                    onChange={(value) => handleUpdate(project.id, 'serviceType', value)}
                    className={`text-base ${
                      project.serviceType === 'site' ? 'bg-blue-50 text-blue-700' :
                      project.serviceType === 'presentation' ? 'bg-purple-50 text-purple-700' :
                      project.serviceType === 'subscription' ? 'bg-green-50 text-green-700' :
                      'bg-gray-50 text-gray-700'
                    }`}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap max-w-[140px] min-w-0">
                  <InlineSelect
                    value={project.clientType ?? ''}
                    options={clientTypeDisplayOptions}
                    onChange={(value) => {
                      if (value === '__add__') {
                        const name = window.prompt('Название категории клиента')
                        if (name?.trim()) handleUpdate(project.id, 'clientType', name.trim())
                        return
                      }
                      handleUpdate(project.id, 'clientType', value || null)
                    }}
                    className="bg-gray-50 text-gray-700 truncate block w-full max-w-full text-left text-base"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <InlineSelect
                    value={project.status}
                    options={statusOptions}
                    onChange={(value) => handleUpdate(project.id, 'status', value)}
                    className={`text-base ${
                      project.status === 'paid' ? 'bg-green-50 text-green-700' :
                      project.status === 'prepaid' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-red-50 text-red-700'
                    }`}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="text-base text-gray-900">{project.clientContact || '—'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {project.paymentMethod ? (
                    <InlineSelect
                      value={project.paymentMethod}
                      options={paymentMethodOptions}
                      onChange={(value) => handleUpdate(project.id, 'paymentMethod', value)}
                      className="bg-gray-50 text-gray-700 text-base"
                    />
                  ) : (
                    <InlineSelect
                      value=""
                      options={[{ value: '', label: '—' }, ...paymentMethodOptions]}
                      onChange={(value) => handleUpdate(project.id, 'paymentMethod', value || null)}
                      className="bg-gray-50 text-gray-700 text-base"
                    />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <InlineInput
                    value={project.effectiveTotalAmount ?? project.totalAmount}
                    onChange={(value) => handleUpdate(project.id, 'totalAmount', value)}
                    className="font-medium text-base"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {project.status === 'prepaid' ? (
                    <InlineInput
                      value={project.paidAmount}
                      onChange={(value) => handleUpdate(project.id, 'paidAmount', value)}
                      className="text-green-600 font-medium text-base"
                    />
                  ) : (
                    <div className="text-green-600 font-medium text-base px-2 py-1">
                      {project.paidAmount.toLocaleString('ru-RU')} ₽
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                  Нет проектов. <Link href="/agency/projects/new" className="text-blue-600 hover:underline">Создать первый проект</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* General Expenses Section */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Общие расходы</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
                const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
                try {
                  const res = await fetch('/api/agency/general-expenses/copy-from-month', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      fromYear: prevYear,
                      fromMonth: prevMonth,
                      toYear: selectedYear,
                      toMonth: selectedMonth,
                    }),
                  })
                  if (res.ok) {
                    await fetchGeneralExpenses()
                    const data = await res.json()
                    if (data.copied > 0) alert(`Скопировано расходов: ${data.copied}`)
                  }
                } catch (err) {
                  console.error('Error copying general expenses:', err)
                }
              }}
              className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
              title={`Скопировать все общие расходы с ${monthNames[(selectedMonth === 1 ? 12 : selectedMonth - 1) - 1]} ${selectedMonth === 1 ? selectedYear - 1 : selectedYear} в текущий месяц`}
            >
              Скопировать с {monthNames[(selectedMonth === 1 ? 12 : selectedMonth - 1) - 1]}
            </button>
            <button
              onClick={() => setShowExpenseForm(!showExpenseForm)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              + Добавить расход
            </button>
          </div>
        </div>

        {showExpenseForm && (
          <form onSubmit={handleAddExpense} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCustomExpense}
                  onChange={(e) => setIsCustomExpense(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Произвольный расход (налог, комиссия и т.д.)</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {!isCustomExpense ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Сотрудник</label>
                    <input
                      type="text"
                      name="employeeName"
                      required={!isCustomExpense}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
                    <select
                      name="employeeRole"
                      required={!isCustomExpense}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="designer">Дизайнер</option>
                      <option value="pm">Проджект</option>
                      <option value="copywriter">Копирайтер</option>
                      <option value="assistant">Ассистент</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип расхода</label>
                  <input
                    type="text"
                    name="notes"
                    placeholder="Например: Налог, Комиссия, Аренда и т.д."
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Сумма</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              {!isCustomExpense && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Примечания</label>
                  <input
                    type="text"
                    name="notes"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex space-x-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExpenseForm(false)
                  setIsCustomExpense(false)
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
              >
                Отмена
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Примечания</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Автоматический расчет налогов */}
              <tr className="bg-yellow-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  Налоги (автоматически)
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <span className="text-xs">6916 ₽/мес + 1% от расчетного счета</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-red-600">
                  {taxAmount.toLocaleString('ru-RU')} ₽
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 italic">
                  {accountRevenue > 0 ? `1% от ${accountRevenue.toLocaleString('ru-RU')} ₽` : 'Только базовая сумма'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-xs text-gray-400">Автоматически</span>
                </td>
              </tr>
              {generalExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {expense.employeeName || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {expense.employeeRole ? (roleLabels[expense.employeeRole] || expense.employeeRole) : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">
                    {editingExpenseId === expense.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editingExpenseValue}
                        onChange={(e) => setEditingExpenseValue(e.target.value)}
                        onBlur={() => {
                          const num = parseFloat(editingExpenseValue) || 0
                          if (num > 0) handleUpdateGeneralExpense(expense.id, 'amount', num)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const num = parseFloat(editingExpenseValue) || 0
                            if (num > 0) handleUpdateGeneralExpense(expense.id, 'amount', num)
                          }
                          if (e.key === 'Escape') setEditingExpenseId(null)
                        }}
                        autoFocus
                        className="w-24 px-2 py-1 border border-blue-500 rounded text-sm text-right"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExpenseId(expense.id)
                          setEditingExpenseValue(expense.amount.toString())
                        }}
                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                      >
                        {expense.amount.toLocaleString('ru-RU')} ₽
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {expense.notes || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {generalExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    Нет общих расходов
                  </td>
                </tr>
              )}
            </tbody>
            {generalExpenses.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-6 py-3 text-sm font-medium text-gray-900">
                    Итого общих расходов:
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-red-600">
                    {generalExpensesTotal.toLocaleString('ru-RU')} ₽
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
