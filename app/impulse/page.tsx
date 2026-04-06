'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import InlineSelect from '@/components/InlineSelect'

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
  totalExpenses: number
  createdAt?: string
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

export default function ImpulsePage() {
  const [students, setStudents] = useState<Student[]>([])
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [isCustomExpense, setIsCustomExpense] = useState(false)
  const [moveToMonthStudentId, setMoveToMonthStudentId] = useState<string | null>(null)
  const [moveToMonthAnchor, setMoveToMonthAnchor] = useState<{ top: number; left: number } | null>(null)
  const [moveToYear, setMoveToYear] = useState(() => new Date().getFullYear())
  const [moveToMonth, setMoveToMonth] = useState(12)
  
  // Месяц для фильтрации
  const today = new Date()
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)

  useEffect(() => {
    fetchStudents()
    fetchGeneralExpenses()
  }, [selectedYear, selectedMonth])

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/impulse/students')
      const data = await res.json()
      
      // Фильтруем студентов по выбранному месяцу
      const monthStart = new Date(selectedYear, selectedMonth - 1, 1)
      const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59)
      
      const filteredStudents = data.filter((s: Student) => {
        const studentDate = new Date(s.createdAt || s.id)
        return studentDate >= monthStart && studentDate <= monthEnd
      })
      
      // Fetch expenses for each student
      const studentsWithExpenses = await Promise.all(
        filteredStudents.map(async (s: Student) => {
          try {
            const expensesRes = await fetch(`/api/impulse/expenses?studentId=${s.id}`)
            const expenses = await expensesRes.json()
            const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0)
            
            // Автоматически корректируем paidAmount в зависимости от статуса
            let correctedPaidAmount = s.paidAmount
            if (s.status === 'paid' && s.paidAmount !== s.totalAmount) {
              // Если статус "Оплачен", но paidAmount не равен totalAmount - исправляем
              correctedPaidAmount = s.totalAmount
              // Обновляем на сервере
              try {
                await fetch(`/api/impulse/students/${s.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...s, paidAmount: s.totalAmount }),
                })
              } catch {}
            } else if (s.status === 'not_paid' && s.paidAmount !== 0) {
              // Если статус "Не оплачен", но paidAmount не равен 0 - исправляем
              correctedPaidAmount = 0
              // Обновляем на сервере
              try {
                await fetch(`/api/impulse/students/${s.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...s, paidAmount: 0 }),
                })
              } catch {}
            }
            
            return { ...s, totalExpenses, paidAmount: correctedPaidAmount }
          } catch {
            return { ...s, totalExpenses: 0 }
          }
        })
      )
      
      // Sort students: paid first, prepaid second, not_paid last
      const sortedStudents = studentsWithExpenses.sort((a, b) => {
        const statusOrder: Record<string, number> = {
          'paid': 0,
          'prepaid': 1,
          'not_paid': 2
        }
        return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
      })
      
      setStudents(sortedStudents)
    } catch (error) {
      console.error('Error fetching students:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (id: string, field: string, value: any) => {
    try {
      const student = students.find(s => s.id === id)
      if (!student) return

      const updatedStudent = { ...student, [field]: value }
      
      // Автоматически управляем paidAmount в зависимости от статуса
      if (field === 'status') {
        if (value === 'paid') {
          // Если статус "Оплачен" - автоматически устанавливаем paidAmount = totalAmount
          updatedStudent.paidAmount = student.totalAmount
        } else if (value === 'not_paid') {
          // Если статус "Не оплачен" - автоматически устанавливаем paidAmount = 0
          updatedStudent.paidAmount = 0
        }
        // Если статус "Предоплата" - оставляем текущее значение paidAmount (можно редактировать)
      }
      
      // Optimistic update first
      const updatedStudents = students.map(s => s.id === id ? updatedStudent : s)
      
      // Re-sort after status change
      const sortedStudents = updatedStudents.sort((a, b) => {
        const statusOrder: Record<string, number> = {
          'paid': 0,
          'prepaid': 1,
          'not_paid': 2
        }
        return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
      })
      
      setStudents(sortedStudents)
      
      const res = await fetch(`/api/impulse/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStudent),
      })
      
      if (res.ok) {
        const data = await res.json()
        // Update UI with server response to ensure consistency
        if (data.student) {
          // Keep totalExpenses from current student
          const currentStudent = students.find(s => s.id === id)
          const updatedWithExpenses = { 
            ...data.student, 
            totalExpenses: currentStudent?.totalExpenses || 0 
          }
          
          const updatedStudents = students.map(s => s.id === id ? updatedWithExpenses : s)
          
          // Re-sort after update
          const sortedStudents = updatedStudents.sort((a, b) => {
            const statusOrder: Record<string, number> = {
              'paid': 0,
              'prepaid': 1,
              'not_paid': 2
            }
            return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
          })
          
          setStudents(sortedStudents)
        }
      } else {
        console.error('Failed to update student:', res.status)
        // Revert on error - reload from server
        const errorData = await res.json().catch(() => ({}))
        console.error('Error details:', errorData)
        fetchStudents()
      }
    } catch (error) {
      console.error('Error updating student:', error)
      // Revert on error - reload from server
      fetchStudents()
    }
  }

  const fetchGeneralExpenses = async () => {
    try {
      const res = await fetch('/api/impulse/general-expenses')
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
    const form = e.currentTarget
    const formData = new FormData(form)
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
      const res = await fetch('/api/impulse/general-expenses', {
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
        form?.reset()
        setShowExpenseForm(false)
        setIsCustomExpense(false)
        await fetchGeneralExpenses()
        await fetchStudents() // Reload to update totals
      } else {
        console.error('Error response:', responseData)
        await fetchGeneralExpenses()
        await fetchStudents()
        form?.reset()
        setShowExpenseForm(false)
        setIsCustomExpense(false)
      }
    } catch (error) {
      console.error('Error adding expense:', error)
      await fetchGeneralExpenses()
      await fetchStudents()
      form?.reset()
      setShowExpenseForm(false)
      setIsCustomExpense(false)
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Удалить расход?')) return
    
    try {
      const res = await fetch(`/api/impulse/general-expenses/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchGeneralExpenses()
        fetchStudents() // Reload to update totals
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const expectedRevenue = students.reduce((sum, s) => sum + s.totalAmount, 0)
  const actualRevenue = students.reduce((sum, s) => sum + s.paidAmount, 0)
  const studentExpenses = students.reduce((sum, s) => sum + (s.totalExpenses || 0), 0)
  const generalExpensesTotal = generalExpenses.reduce((sum, e) => sum + e.amount, 0)
  const totalExpenses = studentExpenses + generalExpensesTotal
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

  const trafficSourceBaseOptions = [
    { value: 'youtube', label: 'YouTube' },
    { value: 'recommendations', label: 'Рекомендации' },
  ]
  const trafficSourceFromStudents = Array.from(
    new Set(students.map(s => s.trafficSource).filter((t): t is string => Boolean(t)))
  ).filter(t => !trafficSourceBaseOptions.some(o => o.value === t))
  const trafficSourceDisplayOptions: { value: string; label: string }[] = [
    { value: '', label: '—' },
    ...trafficSourceBaseOptions,
    ...trafficSourceFromStudents.map(t => ({ value: t, label: t })),
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
          <h1 className="text-2xl font-bold text-gray-900">Импульс</h1>
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
        <Link
          href="/impulse/students/new"
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700"
        >
          + Новый ученик
        </Link>
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

      {/* Students Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ученик
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Источник трафика
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Продукт
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Сумма
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Оплачено
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {students.map((student) => (
              <tr key={student.id}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/impulse/students/${student.id}`} className="text-base font-medium text-purple-600 hover:text-purple-800">
                      {student.name}
                    </Link>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault()
                        const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
                        const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
                        try {
                          const res = await fetch(`/api/impulse/students/${student.id}/copy`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ year: nextYear, month: nextMonth }),
                          })
                          if (res.ok) await fetchStudents()
                          else console.error('Failed to copy student:', await res.json())
                        } catch (err) {
                          console.error('Error copying student:', err)
                        }
                      }}
                      className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-purple-600"
                      title={`Копировать на ${monthNames[selectedMonth === 12 ? 0 : selectedMonth]} ${selectedMonth === 12 ? selectedYear + 1 : selectedYear} (с расходами)`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    {student.status !== 'paid' && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault()
                          const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
                          const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
                          try {
                            const res = await fetch(`/api/impulse/students/${student.id}/move-to-month`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ year: nextYear, month: nextMonth }),
                            })
                            if (res.ok) await fetchStudents()
                            else console.error('Failed to move student:', await res.json())
                          } catch (err) {
                            console.error('Error moving student:', err)
                          }
                        }}
                        className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-purple-600"
                        title={`Перенести на следующий месяц`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    )}
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setMoveToMonthStudentId(student.id)
                          setMoveToMonthAnchor({ left: rect.left, top: rect.bottom + 4 })
                          const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
                          const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
                          setMoveToYear(prevYear)
                          setMoveToMonth(prevMonth)
                        }}
                        className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-purple-600"
                        title="Перенести в другой месяц"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {moveToMonthStudentId === student.id && moveToMonthAnchor && typeof document !== 'undefined' && createPortal(
                        <div
                          className="fixed z-[100] bg-white border border-gray-200 rounded-lg shadow-xl p-3 min-w-[200px]"
                          style={{ left: moveToMonthAnchor.left, top: moveToMonthAnchor.top }}
                        >
                          <div className="text-xs font-medium text-gray-600 mb-2">Перенести в месяц</div>
                          <div className="flex gap-2 mb-2">
                            <select
                              value={moveToYear}
                              onChange={(e) => setMoveToYear(Number(e.target.value))}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              {yearOptions.map((y) => (
                                <option key={y} value={y}>{y}</option>
                              ))}
                            </select>
                            <select
                              value={moveToMonth}
                              onChange={(e) => setMoveToMonth(Number(e.target.value))}
                              className="px-2 py-1 border border-gray-300 rounded text-sm flex-1"
                            >
                              {monthNames.map((name, i) => (
                                <option key={i} value={i + 1}>{name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/impulse/students/${student.id}/move-to-month`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ year: moveToYear, month: moveToMonth }),
                                  })
                                  if (res.ok) {
                                    setMoveToMonthStudentId(null)
                                    setMoveToMonthAnchor(null)
                                    await fetchStudents()
                                  } else {
                                    console.error('Failed to move:', await res.json())
                                  }
                                } catch (err) {
                                  console.error('Error moving student:', err)
                                }
                              }}
                              className="px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700"
                            >
                              Перенести
                            </button>
                            <button
                              type="button"
                              onClick={() => { setMoveToMonthStudentId(null); setMoveToMonthAnchor(null) }}
                              className="px-2 py-1 border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                  {student.deadline && (
                    <div className="text-xs text-gray-500 mt-0.5">{formatDate(new Date(student.deadline))}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap max-w-[140px] min-w-0">
                  <InlineSelect
                    value={student.trafficSource ?? ''}
                    options={trafficSourceDisplayOptions}
                    onChange={(value) => {
                      if (value === '__add__') {
                        const name = window.prompt('Название источника трафика')
                        if (name?.trim()) handleUpdate(student.id, 'trafficSource', name.trim())
                        return
                      }
                      handleUpdate(student.id, 'trafficSource', value || null)
                    }}
                    className="bg-gray-50 text-gray-700 truncate block w-full max-w-full text-left text-base"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{student.productType}</div>
                  {student.notes && (
                    <div className="text-xs text-gray-500">{student.notes}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <InlineSelect
                    value={student.status}
                    options={statusOptions}
                    onChange={(value) => handleUpdate(student.id, 'status', value)}
                    className={`${
                      student.status === 'paid' ? 'bg-green-50 text-green-700' :
                      student.status === 'prepaid' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-red-50 text-red-700'
                    }`}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {student.totalAmount.toLocaleString('ru-RU')} ₽
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {student.status === 'prepaid' ? (
                    <InlineInput
                      value={student.paidAmount}
                      onChange={(value) => handleUpdate(student.id, 'paidAmount', value)}
                      className="text-green-600 font-medium"
                    />
                  ) : (
                    <div className="text-green-600 font-medium px-2 py-1">
                      {student.paidAmount.toLocaleString('ru-RU')} ₽
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    href={`/impulse/students/${student.id}`}
                    className="text-purple-600 hover:text-purple-900"
                  >
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                  Нет учеников. <Link href="/impulse/students/new" className="text-purple-600 hover:underline">Добавить первого ученика</Link>
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
                  const res = await fetch('/api/impulse/general-expenses/copy-from-month', {
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
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700"
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
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
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
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700"
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
              {generalExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {expense.employeeName || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {expense.employeeRole ? (roleLabels[expense.employeeRole] || expense.employeeRole) : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">
                    {expense.amount.toLocaleString('ru-RU')} ₽
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
