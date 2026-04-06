'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Priority = 'low' | 'medium' | 'high'

interface ChecklistGoal {
  id: string
  period: string
  title: string
  completed: boolean
  order: number
  priority?: Priority
  notes?: string | null
  optional?: boolean // идеально (необязательно) — отдельный блок в неделе
}

const VALID_TABS = ['year', 'quarter', 'month', 'week', 'dreams'] as const
type TabKey = (typeof VALID_TABS)[number]

function PlanningGoalsContent() {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as TabKey | null
  const [activeTab, setActiveTab] = useState<'year' | 'quarter' | 'month' | 'week' | 'dreams'>(
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'week'
  )
  const [goals, setGoals] = useState<ChecklistGoal[]>([])
  const [loading, setLoading] = useState(true)
  
  // Для квартала
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1')
  
  // Для месяца (и для недели — выбираем месяц, чтобы видеть все недели)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  
  // Для недели (при «Фокус недели» используем месяц и загружаем все недели месяца)
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [weekFocusByWeek, setWeekFocusByWeek] = useState<Record<string, ChecklistGoal[]>>({})
  const [weekFocusLoading, setWeekFocusLoading] = useState(false)
  const [addGoalForWeek, setAddGoalForWeek] = useState<string | null>(null)
  const [editingWeekKey, setEditingWeekKey] = useState<string | null>(null)
  
  const [draggedGoal, setDraggedGoal] = useState<ChecklistGoal | null>(null)
  const [editingGoal, setEditingGoal] = useState<ChecklistGoal | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPriority, setEditPriority] = useState<Priority>('medium')
  const [editOptional, setEditOptional] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalNotes, setNewGoalNotes] = useState('')
  const [newGoalPriority, setNewGoalPriority] = useState<Priority>('medium')
  const [newGoalOptional, setNewGoalOptional] = useState(false)

  // Синхронизация вкладки с URL (при переходе по ссылке с дашборда)
  useEffect(() => {
    const tab = searchParams.get('tab') as TabKey | null
    if (tab && VALID_TABS.includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Инициализация дат
  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    
    // Определяем текущий квартал
    const currentQuarter = Math.floor((month - 1) / 3) + 1
    setSelectedQuarter(`Q${currentQuarter}` as 'Q1' | 'Q2' | 'Q3' | 'Q4')
    
    // Текущий месяц
    setSelectedMonth(`${year}-${String(month).padStart(2, '0')}`)
    
    // Текущая неделя
    const week = getWeekNumber(now)
    setSelectedWeek(`${year}-W${String(week).padStart(2, '0')}`)
  }, [])

  useEffect(() => {
    if (activeTab === 'week') {
      setLoading(false)
      if (!selectedMonth) {
        setWeekFocusByWeek({})
        setWeekFocusLoading(false)
        return
      }
      const weeks = getWeeksInMonth(selectedMonth)
      if (weeks.length === 0) {
        setWeekFocusByWeek({})
        setWeekFocusLoading(false)
        return
      }
      setWeekFocusLoading(true)
      Promise.all(
        weeks.map(({ weekKey }) =>
          fetch(`/api/checklist-goals?period=${weekKey}`, { cache: 'no-store' }).then((r) => r.json())
        )
      )
        .then((results) => {
          const byWeek: Record<string, ChecklistGoal[]> = {}
          weeks.forEach(({ weekKey }, i) => {
            const data = results[i]
            byWeek[weekKey] = Array.isArray(data) ? data : []
          })
          setWeekFocusByWeek(byWeek)
        })
        .catch((err) => {
          console.error('Error fetching week focus:', err)
          setWeekFocusByWeek({})
        })
        .finally(() => setWeekFocusLoading(false))
      return
    }
    const period = getCurrentPeriod()
    if (period) {
      fetchGoals()
    }
  }, [activeTab, selectedQuarter, selectedMonth, selectedWeek])

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  /** ISO week key (e.g. 2026-W01) — год по четвергу недели */
  const getWeekKey = (date: Date): string => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const isoYear = d.getUTCFullYear()
    const yearStart = new Date(Date.UTC(isoYear, 0, 1))
    const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return `${isoYear}-W${String(weekNum).padStart(2, '0')}`
  }

  /** Все недели, затрагивающие указанный месяц (YYYY-MM), с датами пн–вс */
  const getWeeksInMonth = (monthStr: string): { weekKey: string; startDate: Date; endDate: Date; label: string }[] => {
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return []
    const [y, m] = monthStr.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1)
    const lastDay = new Date(y, m, 0)
    const weekKeysSet = new Set<string>()
    for (const d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      weekKeysSet.add(getWeekKey(d))
    }
    const weekKeys = Array.from(weekKeysSet).sort()
    return weekKeys.map((weekKey) => {
      const [yearStr, weekStr] = weekKey.split('-W')
      const year = parseInt(yearStr, 10)
      const weekNum = parseInt(weekStr, 10)
      const jan4 = new Date(year, 0, 4)
      const dayNum = jan4.getDay() || 7
      const mondayOfWeek1 = new Date(year, 0, 4 - (dayNum - 1))
      const monday = new Date(mondayOfWeek1)
      monday.setDate(mondayOfWeek1.getDate() + (weekNum - 1) * 7)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
      const label = `${fmt(monday)} – ${fmt(sunday)}`
      return { weekKey, startDate: monday, endDate: sunday, label }
    })
  }

  const getCurrentPeriod = (): string => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    switch (activeTab) {
      case 'year':
        return year.toString()
      case 'quarter':
        return selectedQuarter || `Q${Math.floor((month - 1) / 3) + 1}`
      case 'month':
        return selectedMonth || `${year}-${String(month).padStart(2, '0')}`
      case 'week':
        if (selectedWeek) return selectedWeek
        const w = getWeekNumber(now)
        return `${year}-W${String(w).padStart(2, '0')}`
      case 'dreams':
        return 'dreams'
      default:
        return ''
    }
  }

  const fetchGoals = async () => {
    try {
      const period = getCurrentPeriod()
      if (!period) return
      
      const res = await fetch(`/api/checklist-goals?period=${period}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const data = await res.json()
      const goalsData = Array.isArray(data) ? data : []
      // Нормализуем completed (может быть 0/1 из БД)
      const normalizedGoals = goalsData.map((g: any) => ({
        ...g,
        completed: g.completed === true || g.completed === 1
      }))
      setGoals(normalizedGoals)
    } catch (error) {
      console.error('Error fetching goals:', error)
      setGoals([])
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGoalTitle.trim()) return
    
    const period = addGoalForWeek || getCurrentPeriod()
    if (!period) {
      alert('Период не выбран. Пожалуйста, выберите период.')
      return
    }
    
    try {
      const res = await fetch('/api/checklist-goals', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store',
        body: JSON.stringify({ 
          period, 
          title: newGoalTitle.trim(),
          notes: newGoalNotes.trim() || null,
          priority: newGoalPriority,
          optional: newGoalOptional
        }),
      })
      
      const responseData = await res.json()
      
      if (res.ok) {
        setNewGoalTitle('')
        setNewGoalNotes('')
        setNewGoalPriority('medium')
        setNewGoalOptional(false)
        setShowAddModal(false)
        if (addGoalForWeek) {
          const weekGoals = weekFocusByWeek[addGoalForWeek] || []
          const g = responseData.goal
          const newGoal = {
            ...g,
            completed: g.completed === true || g.completed === 1,
            optional: g.optional === true || g.optional === 1
          }
          setWeekFocusByWeek((prev) => ({
            ...prev,
            [addGoalForWeek]: [...weekGoals, newGoal]
          }))
          setAddGoalForWeek(null)
        } else {
          fetchGoals()
        }
      } else {
        const msg = responseData.error || 'Неизвестная ошибка'
        const details = responseData.details ? ` (${responseData.details})` : ''
        alert(`Ошибка при создании цели: ${msg}${details}`)
      }
    } catch (error: any) {
      console.error('Error creating goal:', error)
      alert(`Ошибка при создании цели: ${error.message || 'Неизвестная ошибка'}`)
    }
  }

  const handleToggle = async (goal: ChecklistGoal) => {
    // Optimistic update
    const newCompleted = !goal.completed
    setGoals(goals.map(g => 
      g.id === goal.id ? { ...g, completed: newCompleted } : g
    ))
    
    try {
      const res = await fetch(`/api/checklist-goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: goal.title,
          completed: newCompleted,
          notes: goal.notes || null
        }),
      })
      
      if (!res.ok) {
        // Откатываем при ошибке
        setGoals(goals.map(g => 
          g.id === goal.id ? { ...g, completed: goal.completed } : g
        ))
        alert('Ошибка при обновлении цели')
      }
    } catch (error) {
      console.error('Error updating goal:', error)
      // Откатываем при ошибке
      setGoals(goals.map(g => 
        g.id === goal.id ? { ...g, completed: goal.completed } : g
      ))
      alert('Ошибка при обновлении цели')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить цель?')) return
    
    // Optimistic update - сохраняем текущее состояние для отката
    const previousGoals = [...goals]
    const goalToDelete = goals.find(g => g.id === id)
    setGoals(goals.filter(g => g.id !== id))
    
    try {
      const res = await fetch(`/api/checklist-goals/${id}`, { 
        method: 'DELETE',
        cache: 'no-store'
      })
      if (!res.ok) {
        // Откатываем при ошибке
        setGoals(previousGoals)
        alert('Ошибка при удалении цели')
      } else {
        // После успешного удаления обновляем список с сервера для синхронизации
        await fetchGoals()
      }
    } catch (error) {
      console.error('Error deleting goal:', error)
      // Откатываем при ошибке
      setGoals(previousGoals)
      alert('Ошибка при удалении цели')
    }
  }

  const handleEdit = (goal: ChecklistGoal, weekKey?: string) => {
    setEditingGoal(goal)
    setEditTitle(goal.title)
    setEditNotes(goal.notes || '')
    setEditPriority((goal.priority as Priority) || 'medium')
    setEditOptional(Boolean(goal.optional))
    setEditingWeekKey(weekKey ?? null)
  }

  const handleSaveEdit = async () => {
    if (!editingGoal || !editTitle.trim()) return
    
    try {
      const res = await fetch(`/api/checklist-goals/${editingGoal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: editTitle.trim(),
          completed: editingGoal.completed,
          notes: editNotes.trim() || null,
          priority: editPriority,
          optional: editOptional
        }),
      })
      
      if (res.ok) {
        const weekKey = editingWeekKey
        const savedGoalId = editingGoal.id
        const savedTitle = editTitle.trim()
        const savedNotes = editNotes.trim() || null
        const savedPriority = editPriority
        const savedOptional = editOptional
        setEditingGoal(null)
        setEditTitle('')
        setEditNotes('')
        setEditPriority('medium')
        setEditOptional(false)
        setEditingWeekKey(null)
        if (weekKey) {
          setWeekFocusByWeek((prev) => ({
            ...prev,
            [weekKey]: (prev[weekKey] || []).map((g) =>
              g.id === savedGoalId
                ? { ...g, title: savedTitle, notes: savedNotes, priority: savedPriority, optional: savedOptional }
                : g
            ),
          }))
        } else {
          fetchGoals()
        }
      } else {
        alert('Ошибка при сохранении')
      }
    } catch (error) {
      console.error('Error updating goal:', error)
      alert('Ошибка при сохранении')
    }
  }

  const handleDragStart = (e: React.DragEvent, goal: ChecklistGoal) => {
    setDraggedGoal(goal)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleToggleWeekGoal = async (weekKey: string, goal: ChecklistGoal) => {
    const newCompleted = !goal.completed
    setWeekFocusByWeek((prev) => ({
      ...prev,
      [weekKey]: (prev[weekKey] || []).map((g) =>
        g.id === goal.id ? { ...g, completed: newCompleted } : g
      ),
    }))
    try {
      const res = await fetch(`/api/checklist-goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goal.title,
          completed: newCompleted,
          notes: goal.notes || null,
          priority: goal.priority || 'medium',
        }),
      })
      if (!res.ok) {
        setWeekFocusByWeek((prev) => ({
          ...prev,
          [weekKey]: (prev[weekKey] || []).map((g) =>
            g.id === goal.id ? { ...g, completed: goal.completed } : g
          ),
        }))
        alert('Ошибка при обновлении цели')
      }
    } catch (err) {
      console.error('Error updating week goal:', err)
      setWeekFocusByWeek((prev) => ({
        ...prev,
        [weekKey]: (prev[weekKey] || []).map((g) =>
          g.id === goal.id ? { ...g, completed: goal.completed } : g
        ),
      }))
    }
  }

  const handleDeleteWeekGoal = async (weekKey: string, id: string) => {
    if (!confirm('Удалить цель?')) return
    setWeekFocusByWeek((prev) => ({
      ...prev,
      [weekKey]: (prev[weekKey] || []).filter((g) => g.id !== id),
    }))
    try {
      const res = await fetch(`/api/checklist-goals/${id}`, { method: 'DELETE', cache: 'no-store' })
      if (!res.ok) {
        const weeks = getWeeksInMonth(selectedMonth || '')
        const idx = weeks.findIndex((w) => w.weekKey === weekKey)
        if (idx >= 0) {
          fetch(`/api/checklist-goals?period=${weekKey}`)
            .then((r) => r.json())
            .then((data) => {
              setWeekFocusByWeek((p) => ({
                ...p,
                [weekKey]: Array.isArray(data) ? data : [],
              }))
            })
        }
        alert('Ошибка при удалении цели')
      }
    } catch (err) {
      console.error('Error deleting week goal:', err)
      const weeks = getWeeksInMonth(selectedMonth || '')
      fetch(`/api/checklist-goals?period=${weekKey}`)
        .then((r) => r.json())
        .then((data) => {
          setWeekFocusByWeek((p) => ({ ...p, [weekKey]: Array.isArray(data) ? data : [] }))
        })
    }
  }

  const handleDrop = async (e: React.DragEvent, targetGoal: ChecklistGoal) => {
    e.preventDefault()
    if (!draggedGoal || draggedGoal.id === targetGoal.id) {
      setDraggedGoal(null)
      return
    }

    const draggedIndex = goals.findIndex(g => g.id === draggedGoal.id)
    const targetIndex = goals.findIndex(g => g.id === targetGoal.id)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedGoal(null)
      return
    }

    // Обновляем порядок
    const newGoals = [...goals]
    const [removed] = newGoals.splice(draggedIndex, 1)
    newGoals.splice(targetIndex, 0, removed)

    // Optimistic update
    setGoals(newGoals)

    // Обновляем order для всех целей
    try {
      await Promise.all(
        newGoals.map((goal, index) =>
          fetch(`/api/checklist-goals/${goal.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: goal.title,
              completed: goal.completed,
              order: index + 1,
              notes: goal.notes || null,
              priority: goal.priority || 'medium'
            }),
          })
        )
      )
      fetchGoals()
    } catch (error) {
      console.error('Error reordering goals:', error)
      // Откатываем при ошибке
      setGoals(goals)
    } finally {
      setDraggedGoal(null)
    }
  }

  const generateMonthOptions = () => {
    const options = []
    const currentYear = new Date().getFullYear()
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
      for (let month = 1; month <= 12; month++) {
        const value = `${year}-${String(month).padStart(2, '0')}`
        const label = new Date(year, month - 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
        options.push({ value, label })
      }
    }
    return options
  }

  const generateWeekOptions = () => {
    const options = []
    const currentYear = new Date().getFullYear()
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
      for (let week = 1; week <= 52; week++) {
        const value = `${year}-W${String(week).padStart(2, '0')}`
        options.push({ value, label: `${year}, неделя ${week}` })
      }
    }
    return options
  }

  // Статистика
  const completedCount = goals.filter(g => g.completed).length
  const totalCount = goals.length
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Цели</h1>
            <p className="text-gray-600 mt-1">Управление целями по периодам</p>
          </div>
          <Link
            href="/me/goals"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Финансовые цели
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <nav className="flex space-x-1">
            {(['year', 'quarter', 'month', 'week', 'dreams'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-4 text-sm font-semibold rounded-md transition-colors ${
                  activeTab === tab
                    ? tab === 'dreams' ? 'bg-amber-500 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab === 'year' && 'Год'}
                {tab === 'quarter' && 'Квартал'}
                {tab === 'month' && 'Месяц'}
                {tab === 'week' && 'Неделя'}
                {tab === 'dreams' && 'Мечты'}
              </button>
            ))}
          </nav>
        </div>

        {/* Period Selector */}
        <div className="mb-6 flex items-center space-x-4">
          {activeTab === 'quarter' && (
            <div className="flex space-x-2">
              {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setSelectedQuarter(q)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedQuarter === q
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          
          {activeTab === 'month' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {generateMonthOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          
          {activeTab === 'week' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {generateMonthOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Вкладка «Неделя»: цели по всем неделям месяца (как цели с прогрессом) */}
        {activeTab === 'week' && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Фокус недели — {selectedMonth && new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </h2>
            {weekFocusLoading ? (
              <div className="text-gray-500 py-8 text-center">Загрузка...</div>
            ) : (
              <div className="space-y-6">
                {getWeeksInMonth(selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`).map(({ weekKey, label }) => {
                  const weekGoals = (weekFocusByWeek[weekKey] || []).map((g) => ({
                    ...g,
                    completed: Boolean(g.completed),
                    optional: Boolean(g.optional),
                  }))
                  const requiredGoals = weekGoals.filter((g) => !g.optional)
                  const idealGoals = weekGoals.filter((g) => g.optional)
                  const totalCount = weekGoals.length
                  const completedCount = weekGoals.filter((g) => g.completed).length
                  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
                  const renderGoalRow = (goal: ChecklistGoal) => (
                    <div
                      key={goal.id}
                      className={`group flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        goal.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-gray-200 hover:border-blue-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={goal.completed}
                        onChange={() => handleToggleWeekGoal(weekKey, goal)}
                        className="mt-1 w-5 h-5 text-blue-600 rounded cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium cursor-pointer ${
                            goal.completed ? 'line-through text-gray-500' : 'text-gray-900'
                          }`}
                          onClick={() => handleEdit(goal, weekKey)}
                        >
                          {goal.title}
                        </div>
                        {goal.notes && (
                          <div className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{goal.notes}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => handleEdit(goal, weekKey)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Редактировать"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWeekGoal(weekKey, goal.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Удалить"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                  return (
                    <div
                      key={weekKey}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-sm font-semibold text-gray-900">{label}</span>
                        {totalCount > 0 && (
                          <div className="flex items-center space-x-3">
                            <span className="text-xs text-gray-600">
                              Выполнено: <span className="font-semibold">{completedCount}</span> / <span className="font-semibold">{totalCount}</span>
                            </span>
                            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 transition-all"
                                style={{ width: `${progressPercentage}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAddGoalForWeek(weekKey)
                            setNewGoalTitle('')
                            setNewGoalNotes('')
                            setNewGoalPriority('medium')
                            setNewGoalOptional(false)
                            setShowAddModal(true)
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                        >
                          + Добавить цель
                        </button>
                      </div>
                      <div className="p-4 space-y-4">
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Фокус недели</h3>
                          {requiredGoals.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">Нет обязательных целей.</p>
                          ) : (
                            <div className="space-y-2">{requiredGoals.map(renderGoalRow)}</div>
                          )}
                        </div>
                        <div className="pt-2 border-t border-gray-100">
                          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Идеально, если получится</h3>
                          {idealGoals.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">Нет необязательных целей.</p>
                          ) : (
                            <div className="space-y-2">{idealGoals.map(renderGoalRow)}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Goals Container (год, квартал, месяц — не показываем для недели) */}
        {activeTab !== 'week' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header with Stats and Add Button */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {activeTab === 'year' && `Цели на ${new Date().getFullYear()} год`}
                  {activeTab === 'quarter' && `Цели на ${selectedQuarter}`}
                  {activeTab === 'month' && selectedMonth && `Цели на ${new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`}
                  {activeTab === 'dreams' && 'Мечты'}
                </h2>
                {totalCount > 0 && (
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600">
                      Выполнено: <span className="font-semibold text-gray-900">{completedCount}</span> / <span className="font-semibold text-gray-900">{totalCount}</span>
                    </span>
                    <div className="flex-1 max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className={`ml-4 px-5 py-2.5 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-2 ${activeTab === 'dreams' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <span>+</span>
                <span>{activeTab === 'dreams' ? 'Добавить мечту' : 'Добавить цель'}</span>
              </button>
            </div>
          </div>

          {/* Goals List */}
          <div className="p-6">
            {goals.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">{activeTab === 'dreams' ? '✨' : '🎯'}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {activeTab === 'dreams' ? 'Нет мечт' : 'Нет целей'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {activeTab === 'dreams' ? 'Добавьте первую мечту — сюда можно сгружать все мечты в целом' : 'Добавьте первую цель для этого периода'}
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className={`px-6 py-3 text-white font-medium rounded-lg shadow-sm transition-colors ${activeTab === 'dreams' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  + {activeTab === 'dreams' ? 'Добавить мечту' : 'Добавить цель'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map((goal) => (
                  <div
                    key={goal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, goal)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, goal)}
                    className={`group relative flex items-start space-x-4 p-4 rounded-lg border-2 transition-all ${
                      draggedGoal?.id === goal.id
                        ? 'border-blue-400 bg-blue-50 shadow-md'
                        : goal.completed
                        ? 'border-gray-200 bg-gray-50 opacity-75'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex-shrink-0 pt-0.5">
                      <input
                        type="checkbox"
                        checked={goal.completed}
                        onChange={() => handleToggle(goal)}
                        className="w-5 h-5 text-blue-600 rounded cursor-pointer focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-base font-semibold ${
                          goal.completed 
                            ? 'line-through text-gray-400' 
                            : 'text-gray-900'
                        }`}
                      >
                        {goal.title}
                      </div>
                      {goal.notes && (
                        <div className={`text-sm mt-1.5 whitespace-pre-line ${
                          goal.completed ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {goal.notes}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(goal)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Add Goal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setShowAddModal(false); setAddGoalForWeek(null) }}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {addGoalForWeek ? 'Добавить цель (неделя)' : activeTab === 'dreams' ? 'Добавить мечту' : 'Создать цель'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setNewGoalTitle('')
                    setNewGoalNotes('')
                    setAddGoalForWeek(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {activeTab === 'dreams' ? 'Мечта' : 'Название цели'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    placeholder={activeTab === 'dreams' ? 'Опишите мечту' : 'Введите название цели'}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Приоритет
                  </label>
                  <select
                    value={newGoalPriority}
                    onChange={(e) => setNewGoalPriority(e.target.value as Priority)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="high">Высокий</option>
                    <option value="medium">Средний</option>
                    <option value="low">Низкий</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Описание (необязательно)
                  </label>
                  <textarea
                    value={newGoalNotes}
                    onChange={(e) => setNewGoalNotes(e.target.value)}
                    placeholder="Добавьте описание или заметки"
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
                {addGoalForWeek && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="newGoalOptional"
                      checked={newGoalOptional}
                      onChange={(e) => setNewGoalOptional(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="newGoalOptional" className="text-sm text-gray-700">
                      Идеально (необязательно) — попадёт в блок «Идеально, если получится»
                    </label>
                  </div>
                )}
                <div className="flex space-x-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Создать
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setNewGoalTitle('')
                      setNewGoalNotes('')
                      setNewGoalOptional(false)
                      setAddGoalForWeek(null)
                    }}
                    className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
          setEditingGoal(null)
          setEditTitle('')
          setEditNotes('')
          setEditOptional(false)
          setEditingWeekKey(null)
        }}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Редактировать цель</h2>
                <button
                  onClick={() => {
                    setEditingGoal(null)
                    setEditTitle('')
                    setEditNotes('')
                    setEditOptional(false)
                    setEditingWeekKey(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault()
                handleSaveEdit()
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название цели <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Введите название цели"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Приоритет
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as Priority)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="high">Высокий</option>
                    <option value="medium">Средний</option>
                    <option value="low">Низкий</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Описание (необязательно)
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Добавьте описание или заметки"
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
                {editingWeekKey && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="editOptional"
                      checked={editOptional}
                      onChange={(e) => setEditOptional(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="editOptional" className="text-sm text-gray-700">
                      Идеально (необязательно)
                    </label>
                  </div>
                )}
                <div className="flex space-x-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGoal(null)
                      setEditTitle('')
                      setEditNotes('')
                      setEditPriority('medium')
                      setEditOptional(false)
                      setEditingWeekKey(null)
                    }}
                    className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlanningGoalsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Загрузка...</div>}>
      <PlanningGoalsContent />
    </Suspense>
  )
}
