'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ChecklistGoal {
  id: string
  period: string
  title: string
  completed: boolean
  order: number
}

interface DailyTask {
  id: string
  title: string
  description?: string
  date: string
  completed: boolean
  isKey: boolean
  priority: string // main, important, movable
  order: number
}

interface Call {
  id: string
  title: string
  date: string
  duration: number | null
  participant: string | null
  notes: string | null
}

export default function ChecklistPage() {
  const [weekGoals, setWeekGoals] = useState<ChecklistGoal[]>([])
  const [monthGoals, setMonthGoals] = useState<ChecklistGoal[]>([])
  const [quarterGoals, setQuarterGoals] = useState<ChecklistGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalPeriod, setNewGoalPeriod] = useState<'week' | 'month' | 'quarter'>('month')
  const [showAddForm, setShowAddForm] = useState(false)
  
  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [calls, setCalls] = useState<Call[]>([])
  const [draggedTask, setDraggedTask] = useState<DailyTask | null>(null)
  const [draggedCall, setDraggedCall] = useState<Call | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDate, setNewTaskDate] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('movable')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [newCallTitle, setNewCallTitle] = useState('')
  const [newCallDate, setNewCallDate] = useState('')
  const [newCallTime, setNewCallTime] = useState('')
  const [newCallEndTime, setNewCallEndTime] = useState('')
  const [showCallForm, setShowCallForm] = useState(false)
  const [editingCall, setEditingCall] = useState<Call | null>(null)
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  // Выходные дни (синяя плашка)
  const [dayOffs, setDayOffs] = useState<string[]>([])
  const [showDayOffForm, setShowDayOffForm] = useState(false)
  const [newDayOffDate, setNewDayOffDate] = useState('')
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null)
  const [editTaskTitle, setEditTaskTitle] = useState('')
  const [editTaskDate, setEditTaskDate] = useState('')
  const [editTaskPriority, setEditTaskPriority] = useState('movable')
  const [viewingTask, setViewingTask] = useState<DailyTask | null>(null)
  const [taskDescription, setTaskDescription] = useState('')

  // Get week dates (Monday to Sunday)
  const getWeekDates = (date: Date) => {
    const monday = new Date(date)
    const day = monday.getDay()
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1)
    monday.setDate(diff)
    const week = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      week.push(d)
    }
    return week
  }

  useEffect(() => {
    fetchGoals()
  }, [])

  useEffect(() => {
    fetchWeekData()
  }, [calendarDate])

  const fetchWeekData = async () => {
    try {
      let startDate: string
      let endDate: string
      
      if (viewMode === 'month') {
        // Для месячного вида берем весь месяц
        const year = calendarDate.getFullYear()
        const month = calendarDate.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        startDate = firstDay.toISOString().split('T')[0]
        endDate = lastDay.toISOString().split('T')[0]
      } else {
        // Для недельного вида берем неделю
      const weekDates = getWeekDates(calendarDate)
      const monday = weekDates[0]
      const sunday = weekDates[6]
        startDate = monday.toISOString().split('T')[0]
        endDate = sunday.toISOString().split('T')[0]
      }
      
      const [tasksRes, callsRes, dayOffsRes] = await Promise.all([
        fetch(`/api/daily-tasks?startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
        fetch(`/api/calls?startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
        fetch(`/api/day-offs?startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
      ])
      const tasksData = Array.isArray(tasksRes) ? tasksRes : []
      setDayOffs(Array.isArray(dayOffsRes) ? dayOffsRes : [])
      // Убеждаемся, что у всех задач есть priority
      const tasksWithPriority = tasksData.map((task: any) => ({
        ...task,
        priority: task.priority || 'movable'
      }))
      setTasks(tasksWithPriority)
      setCalls(Array.isArray(callsRes) ? callsRes : [])
    } catch (error) {
      console.error('Error fetching week data:', error)
    }
  }

  const fetchGoals = async () => {
    try {
      const [weekRes, monthRes, quarterRes] = await Promise.all([
        fetch('/api/checklist-goals?period=week').then(r => r.json()),
        fetch('/api/checklist-goals?period=month').then(r => r.json()),
        fetch('/api/checklist-goals?period=quarter').then(r => r.json()),
      ])
      // Ensure we have arrays
      setWeekGoals(Array.isArray(weekRes) ? weekRes : weekRes.goals || [])
      setMonthGoals(Array.isArray(monthRes) ? monthRes : monthRes.goals || [])
      setQuarterGoals(Array.isArray(quarterRes) ? quarterRes : quarterRes.goals || [])
    } catch (error) {
      console.error('Error fetching goals:', error)
      setMonthGoals([])
      setQuarterGoals([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (goal: ChecklistGoal) => {
    try {
      await fetch(`/api/checklist-goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...goal, completed: !goal.completed }),
      })
      fetchGoals()
    } catch (error) {
      console.error('Error updating goal:', error)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGoalTitle.trim()) return
    
    try {
      const res = await fetch('/api/checklist-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: newGoalPeriod, title: newGoalTitle.trim() }),
      })
      
      if (res.ok) {
        setNewGoalTitle('')
        setShowAddForm(false)
        fetchGoals()
      } else {
        const error = await res.json()
        console.error('Error creating goal:', error)
        alert('Ошибка при создании цели. Попробуйте еще раз.')
      }
    } catch (error) {
      console.error('Error creating goal:', error)
      alert('Ошибка при создании цели. Проверьте консоль.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить цель?')) return
    try {
      await fetch(`/api/checklist-goals/${id}`, { method: 'DELETE' })
      fetchGoals()
    } catch (error) {
      console.error('Error deleting goal:', error)
    }
  }

  // Функция для парсинга даты и времени из названия созвона
  const parseDateTimeFromCallTitle = (title: string): { date: string | null; time: string | null; cleanTitle: string } => {
    const lowerTitle = title.toLowerCase()
    let cleanTitle = title
    let parsedDate: string | null = null
    let parsedTime: string | null = null
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Парсим дату
    if (lowerTitle.includes('сегодня')) {
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      parsedDate = `${year}-${month}-${day}`
      cleanTitle = cleanTitle.replace(/(^|\s)сегодня(\s|$)/gi, ' ').trim()
    } else if (lowerTitle.includes('завтра')) {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const year = tomorrow.getFullYear()
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
      const day = String(tomorrow.getDate()).padStart(2, '0')
      parsedDate = `${year}-${month}-${day}`
      cleanTitle = cleanTitle.replace(/(^|\s)завтра(\s|$)/gi, ' ').trim()
    } else {
      // Дни недели
      const dayNames: Record<string, number> = {
        'понедельник': 1, 'вторник': 2, 'среда': 3, 'четверг': 4,
        'пятница': 5, 'суббота': 6, 'воскресенье': 0,
      }
      
      for (const [dayName, dayOfWeek] of Object.entries(dayNames)) {
        if (lowerTitle.includes(dayName) || lowerTitle.includes(`в ${dayName}`)) {
          const targetDate = new Date(today)
          const currentDay = today.getDay() === 0 ? 7 : today.getDay()
          const targetDay = dayOfWeek === 0 ? 7 : dayOfWeek
          let daysToAdd = targetDay - currentDay
          if (daysToAdd <= 0) daysToAdd += 7
          targetDate.setDate(today.getDate() + daysToAdd)
          const year = targetDate.getFullYear()
          const month = String(targetDate.getMonth() + 1).padStart(2, '0')
          const day = String(targetDate.getDate()).padStart(2, '0')
          parsedDate = `${year}-${month}-${day}`
          cleanTitle = cleanTitle.replace(new RegExp(`(^|\\s)(в\\s+)?${dayName}(\\s|$)`, 'gi'), ' ').trim()
          break
        }
      }
      
      // Дата в формате "28 января", "29 января", "28 янв", "28 января 2026" (ПЕРВЫМ, до формата ДД.ММ)
      const monthNames: Record<string, number> = {
        'января': 0, 'январь': 0, 'янв': 0,
        'февраля': 1, 'февраль': 1, 'фев': 1,
        'марта': 2, 'март': 2, 'мар': 2,
        'апреля': 3, 'апрель': 3, 'апр': 3,
        'мая': 4, 'май': 4,
        'июня': 5, 'июнь': 5, 'июн': 5,
        'июля': 6, 'июль': 6, 'июл': 6,
        'августа': 7, 'август': 7, 'авг': 7,
        'сентября': 8, 'сентябрь': 8, 'сен': 8,
        'октября': 9, 'октябрь': 9, 'окт': 9,
        'ноября': 10, 'ноябрь': 10, 'ноя': 10,
        'декабря': 11, 'декабрь': 11, 'дек': 11,
      }
      
      // Ищем дату в формате "ДД месяц" или "ДД месяц ГГГГ"
      const dateWithMonthMatch = title.match(/(\d{1,2})\s+(января|январь|янв|февраля|февраль|фев|марта|март|мар|апреля|апрель|апр|мая|май|июня|июнь|июн|июля|июль|июл|августа|август|авг|сентября|сентябрь|сен|октября|октябрь|окт|ноября|ноябрь|ноя|декабря|декабрь|дек)(?:\s+(\d{4}))?/i)
      if (dateWithMonthMatch && !parsedDate) {
        const day = parseInt(dateWithMonthMatch[1])
        const monthName = dateWithMonthMatch[2].toLowerCase()
        const month = monthNames[monthName]
        const year = dateWithMonthMatch[3] ? parseInt(dateWithMonthMatch[3]) : today.getFullYear()
        
        if (month !== undefined && day >= 1 && day <= 31) {
          const parsed = new Date(year, month, day)
          if (!isNaN(parsed.getTime()) && parsed.getDate() === day && parsed.getMonth() === month) {
            const yearStr = parsed.getFullYear()
            const monthStr = String(parsed.getMonth() + 1).padStart(2, '0')
            const dayStr = String(parsed.getDate()).padStart(2, '0')
            parsedDate = `${yearStr}-${monthStr}-${dayStr}`
            // Удаляем дату из названия (экранируем специальные символы в названии месяца)
            const escapedMonthName = dateWithMonthMatch[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            cleanTitle = cleanTitle.replace(new RegExp(`\\d{1,2}\\s+${escapedMonthName}(?:\\s+\\d{4})?`, 'gi'), '').trim()
          }
        }
      }
      
      // Дата в формате ДД.ММ (после проверки формата "ДД месяц")
      const dateMatch = title.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/)
      if (dateMatch && !parsedDate) {
        const day = parseInt(dateMatch[1])
        const month = parseInt(dateMatch[2]) - 1
        const year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear()
        const parsed = new Date(year, month, day)
        if (!isNaN(parsed.getTime())) {
          const yearStr = parsed.getFullYear()
          const monthStr = String(parsed.getMonth() + 1).padStart(2, '0')
          const dayStr = String(parsed.getDate()).padStart(2, '0')
          parsedDate = `${yearStr}-${monthStr}-${dayStr}`
          cleanTitle = cleanTitle.replace(/\d{1,2}\.\d{1,2}(?:\.\d{4})?/g, '').trim()
        }
      }
    }
    
    // Парсим время
    // Формат: "в 18:00", "18:00", "в 18", "18"
    // Сначала ищем формат с часами и минутами
    const timeWithMinutes = title.match(/(?:в\s+)?(\d{1,2}):(\d{2})/i)
    if (timeWithMinutes) {
      const hour = parseInt(timeWithMinutes[1])
      const minute = parseInt(timeWithMinutes[2])
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        parsedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        cleanTitle = cleanTitle.replace(/(?:в\s+)?\d{1,2}:\d{2}/gi, '').trim()
      }
    } else {
      // Если не нашли формат с минутами, ищем только час
      const timeOnlyHour = title.match(/(?:в\s+)(\d{1,2})(?:\s|$)/i)
      if (timeOnlyHour) {
        const hour = parseInt(timeOnlyHour[1])
        if (hour >= 0 && hour <= 23) {
          parsedTime = `${String(hour).padStart(2, '0')}:00`
          cleanTitle = cleanTitle.replace(/(?:в\s+)\d{1,2}(?:\s|$)/gi, ' ').trim()
        }
      }
    }
    
    // Очистка лишних пробелов
    cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim()
    cleanTitle = cleanTitle.replace(/^[,.\s\-]+|[,.\s\-]+$/g, '').trim()
    
    return { date: parsedDate, time: parsedTime, cleanTitle }
  }

  // Функция для очистки названия от всех тегов (приоритеты и даты)
  const cleanTitleFromTags = (title: string): string => {
    if (!title) return title
    
    let cleanTitle = title
    
    // Удаляем теги приоритета (используем более широкий поиск для кириллицы)
    cleanTitle = cleanTitle.replace(/очень\s+важно/gi, '')
    cleanTitle = cleanTitle.replace(/не\s+важно/gi, '')
    // Для "важно" используем поиск с пробелами или началом/концом строки
    cleanTitle = cleanTitle.replace(/(^|\s)важно(\s|$)/gi, ' ')
    
    // Удаляем даты в формате ДД.ММ или ДД.ММ.ГГГГ
    cleanTitle = cleanTitle.replace(/\d{1,2}\.\d{1,2}(?:\.\d{4})?/g, '')
    
    // Удаляем "в понедельник", "в вторник" и т.д.
    cleanTitle = cleanTitle.replace(/(^|\s)в\s+(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)(\s|$)/gi, ' ')
    
    // Удаляем дни недели в разных падежах
    cleanTitle = cleanTitle.replace(/(^|\s)(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|понедельника|вторника|среды|четверга|пятницы|субботы|воскресенья)(\s|$)/gi, ' ')
    
    // Удаляем "сегодня" и "завтра"
    cleanTitle = cleanTitle.replace(/(^|\s)сегодня(\s|$)/gi, ' ')
    cleanTitle = cleanTitle.replace(/(^|\s)завтра(\s|$)/gi, ' ')
    
    // Удаляем лишние пробелы, запятые и точки
    cleanTitle = cleanTitle.replace(/[,.\s]+/g, ' ')
    cleanTitle = cleanTitle.replace(/^[,.\s\-]+|[,.\s\-]+$/g, '')
    cleanTitle = cleanTitle.trim()
    
    return cleanTitle
  }

  // Функция для парсинга приоритета из названия задачи
  const parsePriorityFromTitle = (title: string): { priority: string; cleanTitle: string } => {
    const lowerTitle = title.toLowerCase()
    
    // Очень важно → main
    if (lowerTitle.includes('очень важно')) {
      return { priority: 'main', cleanTitle: cleanTitleFromTags(title) }
    }
    
    // Важно → important (но не "не важно" и не "очень важно")
    if (lowerTitle.includes('важно') && !lowerTitle.includes('не важно') && !lowerTitle.includes('очень важно')) {
      return { priority: 'important', cleanTitle: cleanTitleFromTags(title) }
    }
    
    // Не важно → movable
    if (lowerTitle.includes('не важно')) {
      return { priority: 'movable', cleanTitle: cleanTitleFromTags(title) }
    }
    
    return { priority: 'movable', cleanTitle: cleanTitleFromTags(title) }
  }

  // Функция для парсинга даты из названия задачи
  const parseDateFromTitle = (title: string): string | null => {
    const lowerTitle = title.toLowerCase().trim()
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    if (lowerTitle.includes('сегодня')) {
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    if (lowerTitle.includes('завтра')) {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const year = tomorrow.getFullYear()
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
      const day = String(tomorrow.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    const dayNames: Record<string, number> = {
      'понедельник': 1, 'вторник': 2, 'среда': 3, 'четверг': 4,
      'пятница': 5, 'суббота': 6, 'воскресенье': 0,
    }
    
    for (const [dayName, dayOfWeek] of Object.entries(dayNames)) {
      if (lowerTitle.includes(dayName) || lowerTitle.includes(`в ${dayName}`)) {
        const targetDate = new Date(today)
        const currentDay = today.getDay() === 0 ? 7 : today.getDay()
        const targetDay = dayOfWeek === 0 ? 7 : dayOfWeek
        let daysToAdd = targetDay - currentDay
        if (daysToAdd <= 0) daysToAdd += 7
        targetDate.setDate(today.getDate() + daysToAdd)
        const year = targetDate.getFullYear()
        const month = String(targetDate.getMonth() + 1).padStart(2, '0')
        const day = String(targetDate.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
    }
    
    const dateMatch = title.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/)
    if (dateMatch) {
      const day = parseInt(dateMatch[1])
      const month = parseInt(dateMatch[2]) - 1
      const year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear()
      const parsedDate = new Date(year, month, day)
      if (!isNaN(parsedDate.getTime())) {
        const yearStr = parsedDate.getFullYear()
        const monthStr = String(parsedDate.getMonth() + 1).padStart(2, '0')
        const dayStr = String(parsedDate.getDate()).padStart(2, '0')
        return `${yearStr}-${monthStr}-${dayStr}`
      }
    }
    
    return null
  }

  // Calendar functions
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    
    // Парсим дату из названия, если не указана вручную (до очистки тегов)
    let taskDate = newTaskDate
    if (!taskDate || taskDate.trim() === '') {
      const parsedDate = parseDateFromTitle(newTaskTitle)
      if (parsedDate) {
        taskDate = parsedDate
        console.log('✅ Распознана дата из названия:', parsedDate)
      } else {
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, '0')
        const day = String(today.getDate()).padStart(2, '0')
        taskDate = `${year}-${month}-${day}`
      }
    }

    // Парсим приоритет из названия (если не выбран вручную)
    let finalPriority = newTaskPriority
    let cleanTitle = newTaskTitle.trim()
    
    if (newTaskPriority === 'movable') {
      // Если приоритет не выбран вручную, пытаемся определить из названия
      const parsedPriority = parsePriorityFromTitle(newTaskTitle)
      finalPriority = parsedPriority.priority
      cleanTitle = parsedPriority.cleanTitle
      if (parsedPriority.priority !== 'movable') {
        console.log('✅ Распознан приоритет из названия:', parsedPriority.priority)
      }
    } else {
      // Если приоритет выбран вручную, просто очищаем название от тегов
      cleanTitle = cleanTitleFromTags(newTaskTitle)
    }
    
    // Проверяем, что название не пустое после очистки
    if (!cleanTitle || cleanTitle.trim() === '') {
      alert('Название задачи не может быть пустым после удаления тегов')
      return
    }
    
    try {
      const res = await fetch('/api/daily-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: cleanTitle.trim(), 
          date: taskDate,
          priority: finalPriority,
        }),
      })
      
      if (res.ok) {
        setNewTaskTitle('')
        setNewTaskDate('')
        setNewTaskPriority('movable')
        setShowTaskForm(false)
        fetchWeekData()
      } else {
        let errorMessage = 'Неизвестная ошибка'
        try {
          const contentType = res.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const error = await res.json()
            errorMessage = error.error || error.details || errorMessage
          } else {
            const text = await res.text()
            errorMessage = text || `HTTP ${res.status}: ${res.statusText}`
          }
        } catch (parseError) {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`
        }
        alert('Ошибка: ' + errorMessage)
      }
    } catch (error: any) {
      console.error('Error adding task:', error)
      alert('Ошибка при создании задачи: ' + (error?.message || 'Неизвестная ошибка'))
    }
  }

  const handleAddCall = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCallTitle.trim()) return
    
    // Парсим дату и время из названия, если не указаны вручную
    let callDate = newCallDate.trim()
    let callTime = newCallTime.trim()
    let cleanTitle = newCallTitle.trim()
    
    // Всегда пытаемся парсить из названия, даже если поля заполнены
    const parsed = parseDateTimeFromCallTitle(newCallTitle)
    
    // Используем распознанные значения, если поля не заполнены вручную
    if (!callDate && parsed.date) {
      callDate = parsed.date
      console.log('✅ Распознана дата из названия созвона:', parsed.date)
    }
    if (!callTime && parsed.time) {
      callTime = parsed.time
      console.log('✅ Распознано время из названия созвона:', parsed.time)
    }
    
    // Используем очищенное название
    if (parsed.cleanTitle) {
      cleanTitle = parsed.cleanTitle
    }
    
    // Если дата или время все еще не указаны, используем сегодня и текущее время
    if (!callDate) {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      callDate = `${year}-${month}-${day}`
      console.log('⚠️ Дата не распознана, используем сегодня:', callDate)
    }
    
    if (!callTime) {
      const now = new Date()
      callTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      console.log('⚠️ Время не распознано, используем текущее:', callTime)
    }
    
    // Вычисляем duration из времени начала и окончания
    let duration: number | null = null
    let finalEndTime: string | null = null
    if (callTime && newCallEndTime) {
      const start = new Date(`${callDate}T${callTime}:00`)
      const end = new Date(`${callDate}T${newCallEndTime}:00`)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        duration = Math.round((end.getTime() - start.getTime()) / 60000) // в минутах
        finalEndTime = end.toISOString()
      }
    }
    
    console.log('🚀 Создание события:', { 
      originalTitle: newCallTitle, 
      cleanTitle, 
      date: callDate, 
      time: callTime,
      endTime: finalEndTime,
      duration
    })

    try {
      const dateTime = `${callDate}T${callTime}:00`
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle, date: dateTime, endTime: finalEndTime, duration }),
      })
      if (res.ok) {
        setNewCallTitle('')
        setNewCallDate('')
        setNewCallTime('')
        setNewCallEndTime('')
        setShowCallForm(false)
        fetchWeekData()
      } else {
        const error = await res.json()
        console.error('Error response:', error)
        alert('Ошибка при создании события: ' + (error.error || 'Неизвестная ошибка'))
      }
    } catch (error) {
      console.error('Error adding call:', error)
      alert('Ошибка при создании события. Проверьте консоль.')
    }
  }

  const handleToggleTask = async (task: DailyTask) => {
    try {
      await fetch(`/api/daily-tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed }),
      })
      fetchWeekData()
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Удалить задачу?')) return
    try {
      await fetch(`/api/daily-tasks/${id}`, { method: 'DELETE' })
      fetchWeekData()
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const handleMoveTaskToNextDay = async (task: DailyTask) => {
    const d = new Date(task.date)
    d.setDate(d.getDate() + 1)
    const newDateStr = d.toISOString().split('T')[0]
    try {
      await fetch(`/api/daily-tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDateStr }),
      })
      fetchWeekData()
    } catch (error) {
      console.error('Error moving task:', error)
    }
  }

  const handleDeleteCall = async (id: string) => {
    if (!confirm('Удалить событие?')) return
    try {
      await fetch(`/api/calls/${id}`, { method: 'DELETE' })
      fetchWeekData()
    } catch (error) {
      console.error('Error deleting call:', error)
    }
  }

  const handleEditTask = (task: DailyTask) => {
    setEditingTask(task)
    setEditTaskTitle(task.title)
    setEditTaskDate(new Date(task.date).toISOString().split('T')[0])
    setEditTaskPriority(task.priority || 'movable')
    setShowTaskForm(true)
  }

  const handleViewTask = (task: DailyTask) => {
    setViewingTask(task)
    setTaskDescription(task.description || '')
  }

  const handleSaveTaskDescription = async () => {
    if (!viewingTask) return

    try {
      const res = await fetch(`/api/daily-tasks/${viewingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: taskDescription,
        }),
      })

      if (res.ok) {
        setViewingTask(null)
        setTaskDescription('')
        fetchWeekData()
      }
    } catch (error) {
      console.error('Error updating task description:', error)
    }
  }

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTask || !editTaskTitle.trim()) return

    try {
      const taskDate = editTaskDate || new Date(editingTask.date).toISOString().split('T')[0]
      
      // Сохраняем название, дату и приоритет
      const res = await fetch(`/api/daily-tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTaskTitle.trim(),
          date: taskDate,
          priority: editTaskPriority,
          description: taskDescription.trim() || null,
        }),
      })

      if (res.ok) {
        setEditingTask(null)
        setEditTaskTitle('')
        setEditTaskDate('')
        setEditTaskPriority('movable')
        setTaskDescription('')
        fetchWeekData()
      }
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingTask(null)
    setEditTaskTitle('')
    setEditTaskPriority('movable')
  }

  const handleDragStart = (e: React.DragEvent, task: DailyTask) => {
    setDraggedTask(task)
    setDraggedCall(null)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', `task:${task.id}`)
    }
  }
  const handleCallDragStart = (e: React.DragEvent, call: Call) => {
    setDraggedCall(call)
    setDraggedTask(null)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', `call:${call.id}`)
    }
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }
  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault()
    e.stopPropagation()
    const targetDateStr = getDateKey(targetDate)

    // Берём данные из dataTransfer (надёжнее, чем React state при drop)
    let dragType: 'task' | 'call' | null = null
    let dragId: string | null = null
    const plain = e.dataTransfer?.getData('text/plain')
    if (plain?.startsWith('task:')) {
      dragType = 'task'
      dragId = plain.slice(5)
    } else if (plain?.startsWith('call:')) {
      dragType = 'call'
      dragId = plain.slice(5)
    }

    if (!dragId || !dragType) {
      setDraggedTask(null)
      setDraggedCall(null)
      return
    }

    if (dragType === 'task') {
      const task = draggedTask?.id === dragId ? draggedTask : tasks.find(t => t.id === dragId)
      if (!task) { setDraggedTask(null); return }
      const taskDateStr = getDateKey(new Date(task.date))
      if (targetDateStr === taskDateStr) { setDraggedTask(null); return }
      try {
        await fetch(`/api/daily-tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: targetDateStr }),
        })
        setDraggedTask(null)
        fetchWeekData()
      } catch (error) {
        console.error('Error moving task:', error)
        setDraggedTask(null)
      }
      return
    }

    if (dragType === 'call') {
      const call = draggedCall?.id === dragId ? draggedCall : calls.find(c => c.id === dragId)
      if (!call) { setDraggedCall(null); return }
      const callDate = new Date(call.date)
      const callDateStr = getDateKey(callDate)
      if (targetDateStr === callDateStr) { setDraggedCall(null); return }
      const hours = callDate.getHours()
      const minutes = callDate.getMinutes()
      const newDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hours, minutes, 0, 0)
      try {
        const res = await fetch(`/api/calls/${call.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: newDate.toISOString() }),
        })
        if (!res.ok) {
          let error: { error?: string } = {}
          try { error = await res.json() } catch (_) {}
          throw new Error(error.error || res.statusText || 'Не удалось перенести созвон')
        }
        setDraggedCall(null)
        fetchWeekData()
      } catch (error) {
        console.error('Error moving call:', error)
        setDraggedCall(null)
      }
    }
  }

  const formatDate = (date: Date) => date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  }
  const getDateKey = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const getDayTasks = (date: Date) => {
    const dateStr = getDateKey(date)
    const dayTasks = tasks.filter(t => getDateKey(new Date(t.date)) === dateStr)
    
    // Сортируем по приоритету: main -> important -> movable, затем по order
    const priorityOrder = { main: 0, important: 1, movable: 2 }
    return dayTasks.sort((a, b) => {
      const aPriority = a.priority || 'movable'
      const bPriority = b.priority || 'movable'
      const priorityDiff = (priorityOrder[aPriority as keyof typeof priorityOrder] || 2) - 
                          (priorityOrder[bPriority as keyof typeof priorityOrder] || 2)
      if (priorityDiff !== 0) return priorityDiff
      return a.order - b.order
    })
  }
  
  const getPriorityIcon = (priority: string | undefined) => {
    const p = priority || 'movable'
    switch (p) {
      case 'main': return '🔴'
      case 'important': return '🟡'
      case 'movable': return '⚪'
      default: return '⚪'
    }
  }
  
  const getPriorityLabel = (priority: string | undefined) => {
    const p = priority || 'movable'
    switch (p) {
      case 'main': return 'Главная задача дня'
      case 'important': return 'Важные задачи'
      case 'movable': return 'Можно перенести'
      default: return 'Можно перенести'
    }
  }
  const getDayCalls = (date: Date) => {
    const dateStr = getDateKey(date)
    return calls.filter(c => getDateKey(new Date(c.date)) === dateStr).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const isDayOff = (date: Date) => dayOffs.includes(getDateKey(date))

  const handleAddDayOff = async (e: React.FormEvent) => {
    e.preventDefault()
    const dateStr = newDayOffDate.trim()
    if (!dateStr) return
    try {
      const res = await fetch('/api/day-offs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      })
      if (res.ok) {
        setNewDayOffDate('')
        setShowDayOffForm(false)
        await fetchWeekData()
      } else {
        const err = await res.json()
        alert('Ошибка: ' + (err.error || 'Не удалось добавить выходной'))
      }
    } catch (error) {
      console.error('Error adding day off:', error)
      alert('Ошибка при добавлении выходного')
    }
  }

  const handleRemoveDayOff = async (dateKey: string) => {
    try {
      const res = await fetch(`/api/day-offs?date=${encodeURIComponent(dateKey)}`, { method: 'DELETE' })
      if (res.ok) await fetchWeekData()
    } catch (error) {
      console.error('Error removing day off:', error)
    }
  }
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(calendarDate)
    if (viewMode === 'month') {
      newDate.setMonth(calendarDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else {
    newDate.setDate(calendarDate.getDate() + (direction === 'next' ? 7 : -7))
    }
    setCalendarDate(newDate)
  }
  const goToToday = () => setCalendarDate(new Date())
  
  // Функция для получения всех дат месяца
  const getMonthDates = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay() === 0 ? 7 : firstDay.getDay() // 1-7 (пн-вс)
    
    const dates: Date[] = []
    
    // Добавляем дни предыдущего месяца для заполнения первой недели
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDayOfWeek - 2; i >= 0; i--) {
      dates.push(new Date(year, month - 1, prevMonthLastDay - i))
    }
    
    // Добавляем дни текущего месяца
    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(new Date(year, month, day))
    }
    
    // Добавляем дни следующего месяца для заполнения последней недели
    const remainingDays = 42 - dates.length // 6 недель * 7 дней
    for (let day = 1; day <= remainingDays; day++) {
      dates.push(new Date(year, month + 1, day))
    }
    
    return dates
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 rounded-b-xl">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
    <div>
              <h1 className="text-3xl font-bold text-gray-900">Планирование</h1>
              <p className="text-lg text-gray-600 mt-1">{formatMonthYear(calendarDate)}</p>
            </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="px-5 py-2.5 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                + Задача
              </button>
              <button
                onClick={() => setShowCallForm(!showCallForm)}
                className="px-5 py-2.5 bg-green-600 text-white text-base font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
              >
                + Событие
          </button>
              <button
                onClick={() => {
                  setShowDayOffForm(!showDayOffForm)
                  if (!showDayOffForm) setNewDayOffDate(getDateKey(new Date()))
                }}
                className="px-5 py-2.5 bg-sky-600 text-white text-base font-medium rounded-lg hover:bg-sky-700 transition-colors shadow-sm"
              >
                + Выходной
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-6 py-6">
        {/* Форма «Выходной» */}
        {showDayOffForm && (
          <form onSubmit={handleAddDayOff} className="mb-6 bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Дата выходного:</label>
              <input
                type="date"
                value={newDayOffDate}
                onChange={(e) => setNewDayOffDate(e.target.value)}
                required
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
              <button type="submit" className="px-6 py-2.5 bg-sky-600 text-white rounded-lg text-base font-medium hover:bg-sky-700 transition-colors">
                Добавить
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDayOffForm(false)
                  setNewDayOffDate('')
                }}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
        {/* Forms for tasks and calls */}
        {(showTaskForm || editingTask) && (
          <form onSubmit={editingTask ? async (e) => {
            e.preventDefault()
            if (!editingTask) return
            try {
              const taskDate = editTaskDate || new Date(editingTask.date).toISOString().split('T')[0]
              const res = await fetch(`/api/daily-tasks/${editingTask.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  title: editTaskTitle, 
                  date: taskDate,
                  priority: editTaskPriority
                }),
              })
              
              if (res.ok) {
                setEditingTask(null)
                setShowTaskForm(false)
                setEditTaskTitle('')
                setEditTaskDate('')
                setEditTaskPriority('movable')
                setNewTaskTitle('')
                setNewTaskDate('')
                setNewTaskPriority('movable')
                fetchWeekData()
              }
            } catch (error) {
              console.error('Error updating task:', error)
            }
          } : handleAddTask} className="mb-6 bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="space-y-4">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={editingTask ? editTaskTitle : newTaskTitle}
                  onChange={(e) => editingTask ? setEditTaskTitle(e.target.value) : setNewTaskTitle(e.target.value)}
                  placeholder="Название задачи (можно: очень важно/важно/не важно, сегодня/завтра/в понедельник, 25.01, 29 января)"
                  required
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
            <select
                  value={editingTask ? editTaskPriority : newTaskPriority}
                  onChange={(e) => editingTask ? setEditTaskPriority(e.target.value) : setNewTaskPriority(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="main">🔴 Главная задача дня</option>
                  <option value="important">🟡 Важные задачи</option>
                  <option value="movable">⚪ Можно перенести</option>
            </select>
              </div>
              <div className="flex gap-3">
            <input
                  type="date"
                  value={editingTask ? editTaskDate : newTaskDate}
                  onChange={(e) => editingTask ? setEditTaskDate(e.target.value) : setNewTaskDate(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 transition-colors">
                  {editingTask ? 'Сохранить' : 'Добавить'}
                </button>
            <button
                  type="button"
                  onClick={() => {
                    setShowTaskForm(false)
                    setEditingTask(null)
                    setEditTaskTitle('')
                    setEditTaskDate('')
                    setEditTaskPriority('movable')
                    setNewTaskTitle('')
                    setNewTaskDate('')
                    setNewTaskPriority('movable')
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </form>
        )}

        {(showCallForm || editingCall) && (
          <form onSubmit={editingCall ? async (e) => {
            e.preventDefault()
            if (!editingCall) return
            try {
              const callDate = newCallDate || new Date(editingCall.date).toISOString().split('T')[0]
              const callTime = newCallTime || new Date(editingCall.date).toTimeString().slice(0, 5)
              const dateTime = `${callDate}T${callTime}:00`
              
              // Вычисляем duration из времени начала и окончания
              let duration: number | null = editingCall.duration
              if (newCallTime && newCallEndTime) {
                const start = new Date(`${callDate}T${newCallTime}:00`)
                const end = new Date(`${callDate}T${newCallEndTime}:00`)
                duration = Math.round((end.getTime() - start.getTime()) / 60000) // в минутах
              }
              
              const res = await fetch(`/api/calls/${editingCall.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  title: newCallTitle, 
                  date: dateTime,
                  duration: duration
                }),
              })
              
              if (res.ok) {
                setEditingCall(null)
                setShowCallForm(false)
                setNewCallTitle('')
                setNewCallDate('')
                setNewCallTime('')
                setNewCallEndTime('')
                fetchWeekData()
              }
            } catch (error) {
              console.error('Error updating call:', error)
            }
          } : handleAddCall} className="mb-6 bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="space-y-4">
              <input
                type="text"
                value={newCallTitle}
                onChange={(e) => setNewCallTitle(e.target.value)}
                placeholder="Название события (можно: завтра в 18:00, в понедельник в 14:30, 25.01 в 10:00, 29 января)"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <div className="flex gap-4">
                <input
                  type="date"
                  value={newCallDate}
                  onChange={(e) => setNewCallDate(e.target.value)}
                  placeholder="Дата (опционально, можно указать в названии)"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <input
                  type="time"
                  value={newCallTime}
                  onChange={(e) => setNewCallTime(e.target.value)}
                  placeholder="Время начала"
                  className="px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <input
                  type="time"
                  value={newCallEndTime}
                  onChange={(e) => setNewCallEndTime(e.target.value)}
                  placeholder="Время окончания"
                  className="px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <button type="submit" className="px-6 py-3 bg-green-600 text-white rounded-lg text-base font-medium hover:bg-green-700 transition-colors">
                  {editingCall ? 'Сохранить' : 'Добавить'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCallForm(false)
                    setEditingCall(null)
                    setNewCallTitle('')
                    setNewCallDate('')
                    setNewCallTime('')
                    setNewCallEndTime('')
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
        </form>
      )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Цели недели</h2>
              <button
                onClick={() => {
                  setNewGoalPeriod('week')
                  setShowAddForm(true)
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Добавить
              </button>
            </div>
          <div className="space-y-2">
            {weekGoals.map((goal) => (
              <div key={goal.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={goal.completed}
                  onChange={() => handleToggle(goal)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span
                  className={`flex-1 text-sm ${goal.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}
                >
                  {goal.title}
                </span>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="text-red-600 hover:text-red-800 text-xs"
                >
                  ×
                </button>
              </div>
            ))}
            {weekGoals.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">Нет целей недели</div>
            )}
          </div>
        </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Цели месяца</h2>
              <button
                onClick={() => {
                  setNewGoalPeriod('month')
                  setShowAddForm(true)
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Добавить
              </button>
            </div>
          <div className="space-y-2">
            {monthGoals.map((goal) => (
              <div key={goal.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={goal.completed}
                  onChange={() => handleToggle(goal)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span
                  className={`flex-1 text-sm ${goal.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}
                >
                  {goal.title}
                </span>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="text-red-600 hover:text-red-800 text-xs"
                >
                  ×
                </button>
              </div>
            ))}
            {monthGoals.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">Нет целей месяца</div>
            )}
          </div>
        </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Цели квартала</h2>
              <button
                onClick={() => {
                  setNewGoalPeriod('quarter')
                  setShowAddForm(true)
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Добавить
              </button>
            </div>
          <div className="space-y-2">
            {quarterGoals.map((goal) => (
              <div key={goal.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={goal.completed}
                  onChange={() => handleToggle(goal)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span
                  className={`flex-1 text-sm ${goal.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}
                >
                  {goal.title}
                </span>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="text-red-600 hover:text-red-800 text-xs"
                >
                  ×
                </button>
              </div>
            ))}
            {quarterGoals.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">Нет целей квартала</div>
            )}
          </div>
        </div>
      </div>

      {/* Form for adding goals */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="mb-6 bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex gap-4">
            <select
              value={newGoalPeriod}
              onChange={(e) => setNewGoalPeriod(e.target.value as 'week' | 'month' | 'quarter')}
              className="px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="week">Неделя</option>
              <option value="month">Месяц</option>
              <option value="quarter">Квартал</option>
            </select>
            <input
              type="text"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              placeholder="Название цели"
              required
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 transition-colors"
            >
              Добавить
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setNewGoalTitle('')
              }}
              className="px-6 py-3 border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Modal for editing task */}
      {editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
          setEditingTask(null)
          setEditTaskTitle('')
          setEditTaskDate('')
          setEditTaskPriority('movable')
          setTaskDescription('')
        }}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Редактировать задачу</h3>
              <button
                onClick={() => {
                  setEditingTask(null)
                  setEditTaskTitle('')
                  setEditTaskDate('')
                  setEditTaskPriority('movable')
                  setTaskDescription('')
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Название</label>
                <input
                  type="text"
                  value={editTaskTitle}
                  onChange={(e) => setEditTaskTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Дата</label>
                <input
                  type="date"
                  value={editTaskDate}
                  onChange={(e) => setEditTaskDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Приоритет</label>
                <select
                  value={editTaskPriority}
                  onChange={(e) => setEditTaskPriority(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="main">🔴 Главная задача дня</option>
                  <option value="important">🟡 Важные задачи</option>
                  <option value="movable">⚪ Можно перенести</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Описание</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Добавьте описание задачи..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[200px] resize-y"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 transition-colors"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null)
                    setEditTaskTitle('')
                    setEditTaskDate('')
                    setEditTaskPriority('movable')
                    setTaskDescription('')
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Calendar Section */}
      <div className="mt-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Календарь задач</h2>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'week' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Неделя
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'month' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Месяц
                </button>
          </div>
              <button onClick={() => navigateWeek('prev')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">←</button>
              <button onClick={goToToday} className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">Сегодня</button>
              <button onClick={() => navigateWeek('next')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">→</button>
        </div>
        </div>


        {showTaskForm && (
            <form onSubmit={handleAddTask} className="mb-6 bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Название задачи (можно: очень важно/важно/не важно, сегодня/завтра/в понедельник, 25.01)"
                    required
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="main">🔴 Главная задача дня</option>
                    <option value="important">🟡 Важные задачи</option>
                    <option value="movable">⚪ Можно перенести</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    placeholder="Дата (опционально, можно указать в названии)"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 transition-colors">
                    Добавить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTaskForm(false)
                      setNewTaskTitle('')
                      setNewTaskDate('')
                      setNewTaskPriority('movable')
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
            </div>
          </form>
        )}

        {(showCallForm || editingCall) && viewMode === 'month' && (
          <form onSubmit={editingCall ? async (e) => {
            e.preventDefault()
            if (!editingCall) return
            try {
              const callDate = newCallDate || new Date(editingCall.date).toISOString().split('T')[0]
              const callTime = newCallTime || new Date(editingCall.date).toTimeString().slice(0, 5)
              const dateTime = `${callDate}T${callTime}:00`
              
              // Вычисляем duration из времени начала и окончания
              let duration: number | null = editingCall.duration
              if (newCallTime && newCallEndTime) {
                const start = new Date(`${callDate}T${newCallTime}:00`)
                const end = new Date(`${callDate}T${newCallEndTime}:00`)
                duration = Math.round((end.getTime() - start.getTime()) / 60000) // в минутах
              }
              
              const res = await fetch(`/api/calls/${editingCall.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  title: newCallTitle, 
                  date: dateTime,
                  duration: duration
                }),
              })
              
              if (res.ok) {
                setEditingCall(null)
                setShowCallForm(false)
                setNewCallTitle('')
                setNewCallDate('')
                setNewCallTime('')
                setNewCallEndTime('')
                fetchWeekData()
              }
            } catch (error) {
              console.error('Error updating call:', error)
            }
          } : handleAddCall} className="mb-6 bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="space-y-4">
              <input
                type="text"
                value={newCallTitle}
                onChange={(e) => setNewCallTitle(e.target.value)}
                placeholder="Название события (можно: завтра в 18:00, в понедельник в 14:30, 25.01 в 10:00, 29 января)"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <div className="flex gap-4">
                <input
                  type="date"
                  value={newCallDate}
                  onChange={(e) => setNewCallDate(e.target.value)}
                  placeholder="Дата (опционально, можно указать в названии)"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <input
                  type="time"
                  value={newCallTime}
                  onChange={(e) => setNewCallTime(e.target.value)}
                  placeholder="Время начала"
                  className="px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <input
                  type="time"
                  value={newCallEndTime}
                  onChange={(e) => setNewCallEndTime(e.target.value)}
                  placeholder="Время окончания"
                  className="px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <button type="submit" className="px-6 py-3 bg-green-600 text-white rounded-lg text-base font-medium hover:bg-green-700 transition-colors">
                  {editingCall ? 'Сохранить' : 'Добавить'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCallForm(false)
                    setEditingCall(null)
                    setNewCallTitle('')
                    setNewCallDate('')
                    setNewCallTime('')
                    setNewCallEndTime('')
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </form>
        )}

          {/* Calendar */}
          {viewMode === 'week' ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-200">
                {getWeekDates(calendarDate).map((date, index) => {
                const isToday = getDateKey(date) === getDateKey(new Date())
                return (
                  <div
                    key={index}
                    className={`p-4 text-center border-r border-gray-200 last:border-r-0 ${
                      isToday ? 'bg-red-600 text-white' : 'bg-white text-gray-900'
                    }`}
                  >
                    <div className={`text-xs font-medium uppercase mb-1 ${isToday ? 'text-red-100' : 'text-gray-500'}`}>
                      {date.toLocaleDateString('ru-RU', { weekday: 'short' })}
                    </div>
                    <div className={`text-xl font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>
                      {date.getDate()}
                    </div>
                    {/* Процент выполнения дня */}
                    {(() => {
                      const dayTasksForPct = getDayTasks(date)
                      const total = dayTasksForPct.length
                      const completed = dayTasksForPct.filter(t => t.completed).length
                      const pct = total ? Math.round((completed / total) * 100) : 0
                      return (
                        <div className="mt-2 flex justify-center">
                          <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                            isToday ? 'border-white/90 text-white bg-red-500/80' : 'border-green-500 text-green-700 bg-green-50'
                          }`}>
                            {pct}%
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
            
            <div className="grid grid-cols-7 min-h-[600px]">
          {getWeekDates(calendarDate).map((date, index) => {
            const dayTasks = getDayTasks(date)
            const dayCalls = getDayCalls(date)
            const isToday = getDateKey(date) === getDateKey(new Date())

            return (
                  <div
                    key={index}
                    className={`flex flex-col border-r border-gray-200 last:border-r-0 p-4 ${
                      isToday ? 'bg-red-50' : 'bg-white'
                    }`}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (e.dataTransfer) {
                        e.dataTransfer.dropEffect = 'move'
                      }
                    }}
                    onDrop={(e) => {
                      console.log('Drop handler вызван для дня:', date.toISOString().split('T')[0])
                      handleDrop(e, date)
                    }}
                  >
                    {/* Плашка «Выходной» */}
                    {isDayOff(date) && (
                      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-sky-100 border-2 border-sky-400 px-3 py-2 text-sky-800">
                        <span className="text-sm font-semibold">Выходной</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveDayOff(getDateKey(date))
                          }}
                          className="text-sky-600 hover:text-sky-800 font-bold text-lg leading-none"
                          title="Убрать выходной"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {/* Calls for this day */}
                {dayCalls.length > 0 && (
                      <div className="mb-4 space-y-2">
                    {dayCalls.map((call) => (
                          <div
                            key={call.id}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation()
                              handleCallDragStart(e, call)
                            }}
                            onDragEnd={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              const callDate = new Date(call.date)
                              const endTime = call.duration ? new Date(callDate.getTime() + call.duration * 60000) : null
                              setEditingCall(call)
                              setNewCallTitle(call.title)
                              setNewCallDate(callDate.toISOString().split('T')[0])
                              setNewCallTime(callDate.toTimeString().slice(0, 5))
                              setNewCallEndTime(endTime ? endTime.toTimeString().slice(0, 5) : '')
                              setShowCallForm(true)
                            }}
                            className="bg-green-100 border-l-4 border-green-500 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          >
                            <div 
                              className="flex items-start justify-between" 
                              onDragStart={(e) => e.stopPropagation()}
                              onDragOver={handleDragOver}
                              onDrop={(e) => { e.stopPropagation(); handleDrop(e, date) }}
                            >
                              <div 
                                className="flex-1" 
                                onDragStart={(e) => e.stopPropagation()}
                                onDragOver={handleDragOver}
                                onDrop={(e) => { e.stopPropagation(); handleDrop(e, date) }}
                              >
                                <div className="text-xs font-semibold text-green-700 mb-1">
                                  {formatTime(call.date)}
                                  {call.duration && ` - ${new Date(new Date(call.date).getTime() + call.duration * 60000).toTimeString().slice(0, 5)}`}
                                </div>
                                <div className="text-sm font-medium text-green-900">{call.title}</div>
                                {call.participant && (
                                  <div className="text-xs text-green-600 mt-1">👤 {call.participant}</div>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteCall(call.id)
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="text-red-600 hover:text-red-800 text-lg font-bold ml-2"
                              >
                                ×
                              </button>
                            </div>
                      </div>
                    ))}
                  </div>
                )}

                    {/* Tasks for this day - grouped by priority */}
                    <div className="space-y-3">
                      {['main', 'important', 'movable'].map((priority) => {
                        const priorityTasks = dayTasks.filter(t => (t.priority || 'movable') === priority)
                        if (priorityTasks.length === 0) return null
                        
                        return (
                          <div key={priority} className="space-y-2">
                            <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${
                              priority === 'main' ? 'text-red-600' :
                              priority === 'important' ? 'text-yellow-600' :
                              'text-gray-500'
                            }`}>
                              {getPriorityIcon(priority)} {getPriorityLabel(priority)}
                            </div>
                            {priorityTasks.map((task) => (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation()
                                  handleDragStart(e, task)
                                }}
                                onDragEnd={(e) => e.stopPropagation()}
                                className={`group rounded-lg p-3 cursor-move hover:shadow-md transition-all ${
                                  task.completed ? 'opacity-50' : ''
                                } ${
                                  priority === 'main' ? 'bg-red-50 border-2 border-red-200 hover:border-red-300' :
                                  priority === 'important' ? 'bg-yellow-50 border-2 border-yellow-200 hover:border-yellow-300' :
                                  'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div 
                                  className="flex items-start gap-3" 
                                  onDragStart={(e) => e.stopPropagation()}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => { e.stopPropagation(); handleDrop(e, date) }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={task.completed}
                                    onChange={() => handleToggleTask(task)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                  />
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingTask(task)
                                      setEditTaskTitle(task.title)
                                      setEditTaskDate(new Date(task.date).toISOString().split('T')[0])
                                      setEditTaskPriority(task.priority || 'movable')
                                      setTaskDescription(task.description || '')
                                    }}
                                    className={`flex-1 text-sm font-medium cursor-pointer ${
                                      task.completed ? 'line-through text-gray-500' : 
                                      priority === 'main' ? 'text-red-900' :
                                      priority === 'important' ? 'text-yellow-900' :
                                      'text-gray-900'
                                    }`}
                                  >
                        {task.title}
                      </span>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleMoveTaskToNextDay(task)
                                      }}
                                      className="text-gray-500 hover:text-blue-600 text-sm font-medium"
                                      title="На следующий день"
                                    >
                                      →
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleEditTask(task)
                                      }}
                                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                      title="Редактировать"
                                    >
                                      ✎
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteTask(task.id)
                                      }}
                                      className="text-red-600 hover:text-red-800 text-lg font-bold"
                                      title="Удалить"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                    </div>
                  ))}
                          </div>
                        )
                      })}
                      {dayTasks.length === 0 && dayCalls.length === 0 && (
                        <div className="text-sm text-gray-400 text-center py-8">Нет задач</div>
                      )}
                </div>
              </div>
            )
          })}
            </div>
          </div>
          ) : (
            /* Month calendar */
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, index) => (
                  <div key={index} className="p-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {getMonthDates(calendarDate).map((date, index) => {
                  const dayTasks = getDayTasks(date)
                  const dayCalls = getDayCalls(date)
                  const isToday = getDateKey(date) === getDateKey(new Date())
                  const isCurrentMonth = date.getMonth() === calendarDate.getMonth()
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-[120px] border-r border-b border-gray-200 p-2 ${
                        isToday ? 'bg-red-50' : isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                      }`}
                      onDragOver={handleDragOver}
                      onDragEnter={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (e.dataTransfer) {
                          e.dataTransfer.dropEffect = 'move'
                        }
                      }}
                      onDrop={(e) => {
                        console.log('Drop handler вызван для дня (месяц):', date.toISOString().split('T')[0])
                        handleDrop(e, date)
                      }}
                    >
                      <div className={`text-xs font-medium mb-1 ${
                        isToday ? 'text-red-600 font-bold' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {date.getDate()}
                      </div>
                      {/* Плашка «Выходной» в месячном виде */}
                      {isDayOff(date) && (
                        <div className="mb-1 flex items-center justify-between gap-0.5 rounded bg-sky-100 border border-sky-400 px-1.5 py-0.5 text-sky-800">
                          <span className="text-xs font-semibold truncate">Выходной</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveDayOff(getDateKey(date))
                            }}
                            className="text-sky-600 hover:text-sky-800 font-bold text-sm leading-none shrink-0"
                            title="Убрать выходной"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      {/* Calls */}
                      {dayCalls.length > 0 && (
                        <div className="mb-1 space-y-1">
                          {dayCalls.slice(0, 2).map((call) => (
                            <div
                              key={call.id}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation()
                                handleCallDragStart(e, call)
                              }}
                              onDragOver={handleDragOver}
                              onDrop={(e) => { e.stopPropagation(); handleDrop(e, date) }}
                              className="bg-green-100 border-l-2 border-green-500 rounded px-1.5 py-0.5 text-xs truncate cursor-move hover:opacity-80"
                              title={call.title}
                            >
                              <span className="text-green-700 font-semibold" onDragStart={(e) => e.stopPropagation()}>{formatTime(call.date)}</span>
                              <span className="text-green-900 ml-1" onDragStart={(e) => e.stopPropagation()}>{call.title}</span>
                            </div>
                          ))}
                          {dayCalls.length > 2 && (
                            <div className="text-xs text-green-600">+{dayCalls.length - 2}</div>
                          )}
                        </div>
                      )}
                      
                      {/* Tasks - только главные и важные */}
                      <div className="space-y-0.5">
                        {dayTasks
                          .filter(t => (t.priority || 'movable') !== 'movable')
                          .slice(0, 3)
                          .map((task) => {
                            const priority = task.priority || 'movable'
                            return (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation()
                                  handleDragStart(e, task)
                                }}
                                onClick={() => {
                                  setViewingTask(task)
                                  setTaskDescription(task.description || '')
                                }}
                                className={`group/task text-xs truncate px-1 py-0.5 rounded cursor-pointer hover:opacity-80 flex items-center justify-between gap-0.5 ${
                                  priority === 'main' ? 'bg-red-100 text-red-900' :
                                  priority === 'important' ? 'bg-yellow-100 text-yellow-900' :
                                  'bg-gray-100 text-gray-700'
                                }`}
                                title={task.title}
                              >
                                <span className="truncate min-w-0">{task.completed ? '✓ ' : ''}{task.title}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleMoveTaskToNextDay(task)
                                  }}
                                  className="shrink-0 text-gray-400 hover:text-blue-600 opacity-0 group-hover/task:opacity-100 transition-opacity"
                                  title="На следующий день"
                                >
                                  →
                                </button>
                              </div>
                            )
                          })}
                        {dayTasks.filter(t => (t.priority || 'movable') !== 'movable').length > 3 && (
                          <div className="text-xs text-gray-500">+{dayTasks.filter(t => (t.priority || 'movable') !== 'movable').length - 3}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
