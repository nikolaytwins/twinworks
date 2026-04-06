'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { getWeekKey, getMonthKey, getTodayDateString, getDateString } from '@/app/tracker/utils'

interface Metrics {
  totalAccounts: number
  cushionAmount: number
  goalsAmount: number
  agencyExpectedRevenue: number
  agencyActualRevenue: number
  agencyExpectedProfit: number
  agencyActualProfit: number
  agencyAvgRevenue: number
  agencyAvgProfit: number
  avgTotalRevenue: number
  avgTotalProfit: number
  impulseExpectedRevenue: number
  impulseActualRevenue: number
  impulseExpectedProfit: number
  impulseActualProfit: number
  totalExpectedProfit: number
  totalRevenue: number
  balance: number
  totalExpectedExpenses: number
  projectedExpenses?: number
  dailyExpenseLimit?: number
  daysRemaining?: number
  newMonthEndForecast?: number
  pessimisticForecast?: number
  daysSinceConfirmed?: number
  availableNow?: number
}

interface Goal {
  id: string
  period: string
  name: string
  targetAmount: number
  currentAmount: number
  linkedAccountBalance: number | null
  deadline: string | null
}

type GoalPriority = 'low' | 'medium' | 'high'

interface ChecklistGoal {
  id: string
  period: string
  title: string
  completed: boolean
  order: number
  priority?: GoalPriority
  description?: string | null
}

interface Transaction {
  id: string
  date: string
  type: string
  amount: number
  category: string | null
  description: string | null
}

function PriorityModal({ 
  goal, 
  onClose, 
  onToggle 
}: { 
  goal: ChecklistGoal | null
  onClose: () => void
  onToggle: (id: string, newCompleted: boolean) => void
}) {
  if (!goal) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{goal.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {goal.description && (
          <p className="text-gray-700 mb-4 whitespace-pre-wrap">{goal.description}</p>
        )}
        {!goal.description && (
          <p className="text-gray-500 mb-4 italic">Нет подробного описания</p>
        )}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={goal.completed}
            onChange={() => onToggle(goal.id, !goal.completed)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label className="text-sm text-gray-700">
            {goal.completed ? 'Выполнено' : 'Не выполнено'}
          </label>
        </div>
      </div>
    </div>
  )
}

function PrioritiesDisplay({ 
  period, 
  goals, 
  onGoalClick, 
  onToggle 
}: { 
  period: string
  goals: ChecklistGoal[]
  onGoalClick: (goal: ChecklistGoal) => void
  onToggle: (id: string, newCompleted: boolean) => void
}) {
  const filtered = goals.filter(g => g.period === period)
  
  if (filtered.length === 0) {
    return <div className="text-sm text-gray-500 italic py-2">Нет приоритетов</div>
  }

  return (
    <div className="space-y-2">
      {filtered.map((goal) => (
        <div 
          key={goal.id} 
          className={`flex items-center space-x-3 p-3 rounded cursor-pointer hover:bg-gray-50 transition-colors ${
            goal.completed ? 'opacity-60' : ''
          }`}
          onClick={() => onGoalClick(goal)}
        >
          <input
            type="checkbox"
            checked={goal.completed}
            onChange={(e) => {
              e.stopPropagation()
              onToggle(goal.id, !goal.completed)
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 text-blue-600 rounded cursor-pointer flex-shrink-0"
          />
          <span className={`text-base flex-1 ${
            goal.completed 
              ? 'line-through text-gray-500' 
              : 'text-gray-900 font-medium'
          }`}>
            {goal.title}
          </span>
        </div>
      ))}
    </div>
  )
}

interface DailyTask {
  id: string
  title: string
  description?: string | null
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
  completed?: boolean
}

interface Lead {
  id: string
  contact: string
  source: string
  status: string
  nextContactDate: string | null
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новые',
  contact_established: 'Контакт установлен',
  commercial_proposal: 'Коммерческое предложение',
  thinking: 'Думает / изучает',
  paid: 'Оплачен',
  pause: 'Пауза',
}

export default function PersonalDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [checklistGoals, setChecklistGoals] = useState<ChecklistGoal[]>([])
  const [planningGoals, setPlanningGoals] = useState<{
    year: ChecklistGoal[]
    quarter: ChecklistGoal[]
    month: ChecklistGoal[]
    week: ChecklistGoal[]
  }>({
    year: [],
    quarter: [],
    month: [],
    week: []
  })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [expectedExpenses, setExpectedExpenses] = useState(0)
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([])
  const [calls, setCalls] = useState<Call[]>([])
  const [leadsToContact, setLeadsToContact] = useState<Lead[]>([])
  const [upcomingLeadsToContact, setUpcomingLeadsToContact] = useState<Lead[]>([])
  const [dailyLogHistory, setDailyLogHistory] = useState<Array<{ date: string; dayOff: string | null; workoutType: string | null; sleepDone: boolean; reels: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [balanceAtLastMonthEnd, setBalanceAtLastMonthEnd] = useState<number | null>(null)
  const [balanceAtMonthStart, setBalanceAtMonthStart] = useState<number | null>(null)
  const [initialStartBalance, setInitialStartBalance] = useState<number | null>(null)
  const [todayLog, setTodayLog] = useState<{
    stepsDone: boolean | null
    proteinDone: boolean | null
    sleepDone: boolean | null
    workoutType: 'gym' | 'home' | null
    alcohol: boolean | null
    dayOff: 'none' | 'partial' | 'full' | null
    junkFood: boolean | null
    reels: boolean | null
    gamesDone: boolean | null
    contentWritingDone: boolean | null
  } | null>(null)
  
  // Недельные и месячные метрики для быстрой отметки
  const [youtubeDone, setYoutubeDone] = useState(false)
  const [telegramDone, setTelegramDone] = useState(false)
  const [threadsDone, setThreadsDone] = useState(false)
  const [socialDone, setSocialDone] = useState(false)
  const [clientSearchDone, setClientSearchDone] = useState(false)
  const [selectedPriority, setSelectedPriority] = useState<ChecklistGoal | null>(null)
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null)
  const [taskDescription, setTaskDescription] = useState('')
  const [selectedWeekDay, setSelectedWeekDay] = useState<Date | null>(null)
  const [weekTasks, setWeekTasks] = useState<Record<string, DailyTask[]>>({})
  const [weekCalls, setWeekCalls] = useState<Record<string, Call[]>>({})
  const [selectedDayData, setSelectedDayData] = useState<{
    dayKey: string
    tasks: DailyTask[]
    calls: Call[]
  } | null>(null)
  const [quickCallTitle, setQuickCallTitle] = useState('')
  const [quickCallTime, setQuickCallTime] = useState('')
  const [nutritionSummary, setNutritionSummary] = useState<{
    proteinTotal: number
    proteinTarget: number
    remaining: number
    percent: number
    logs: { id: string; createdAt: string; rawText: string; protein: number }[]
  } | null>(null)
  const [nutritionError, setNutritionError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  // Верхняя строка: привычки по дням недели (Пн–Вс) и слоты тренировка/поиск клиентов
  type WeekDayLog = { date: string; stepsDone: boolean; proteinDone: boolean; sleepDone: boolean; junkFood: boolean; contentWritingDone: boolean; reels: boolean }
  const [weekDailyLogs, setWeekDailyLogs] = useState<WeekDayLog[]>([])
  const [weekWorkoutSlots, setWeekWorkoutSlots] = useState<(boolean | string | null)[]>([])
  const [weekClientSearchSlots, setWeekClientSearchSlots] = useState<(boolean | null)[]>([])
  const [weekProfiSlots, setWeekProfiSlots] = useState<(boolean | null)[]>([])
  const [weekThreadsSlots, setWeekThreadsSlots] = useState<(boolean | null)[]>([])
  /** Пользовательские привычки (созданные в /me/habits) */
  type CustomHabit = { id: string; name: string; type: string; slotsCount: number; order: number; isMain: boolean }
  const [customHabits, setCustomHabits] = useState<CustomHabit[]>([])
  const [customHabitSlots, setCustomHabitSlots] = useState<Record<string, (boolean | null)[]>>({})
  /** Пн выбранной недели для привычек и целей недели; null = текущая неделя */
  const [dashboardWeekMonday, setDashboardWeekMonday] = useState<Date | null>(null)
  /** Сегодня — выходной по планированию (day_offs) */
  const [todayIsDayOff, setTodayIsDayOff] = useState(false)
  /** Компы раз в неделю: лимит на текущую/выбранную неделю уже использован */
  const [compyWeekUsed, setCompyWeekUsed] = useState(false)
  /** Смещение дня в компактном блоке «Задачи на сегодня» относительно понедельника выбранной недели (может быть < 0 или > 6 для вчера/других недель) */
  const [topRowDayOffset, setTopRowDayOffset] = useState(0)
  /** Задачи и звонки для дня вне текущей выбранной недели (подгружаются по стрелкам) */
  const [overflowDayTasks, setOverflowDayTasks] = useState<Record<string, DailyTask[]>>({})
  const [overflowDayCalls, setOverflowDayCalls] = useState<Record<string, Call[]>>({})
  // Быстрое добавление целей в верхних плашках
  const [newWeekGoalTitle, setNewWeekGoalTitle] = useState('')
  const [newMonthGoalTitle, setNewMonthGoalTitle] = useState('')
  const [newQuarterGoalTitle, setNewQuarterGoalTitle] = useState('')

  useEffect(() => {
    let cancelled = false
    const timeout = setTimeout(() => {
      if (cancelled) return
      setFetchError('Загрузка заняла слишком много времени. Проверьте, что dev-сервер запущен (npm run dev) и откройте http://127.0.0.1:3000')
      setLoading(false)
    }, 8000)
    fetchData().finally(() => {
      cancelled = true
      clearTimeout(timeout)
    })
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    if (dashboardWeekMonday === null) return
    loadWeekData(dashboardWeekMonday)
  }, [dashboardWeekMonday])

  // По умолчанию в блоке «Задачи на сегодня» показывать сегодня, когда выбрана текущая неделя
  useEffect(() => {
    if (dashboardWeekMonday === null) {
      const today = new Date()
      setTopRowDayOffset((today.getDay() + 6) % 7) // Пн=0 .. Вс=6
    }
  }, [dashboardWeekMonday])

  // Подгрузить задачи/звонки для дня вне выбранной недели (когда перешли стрелкой на вчера/другую неделю)
  useEffect(() => {
    const monday = dashboardWeekMonday ?? getCurrentWeekMonday()
    const displayDay = new Date(monday)
    displayDay.setDate(monday.getDate() + topRowDayOffset)
    const dayKey = getDateString(displayDay)
    const weekStart = getDateString(monday)
    const weekEnd = getDateString(new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000))
    const isInWeek = dayKey >= weekStart && dayKey <= weekEnd
    if (isInWeek || overflowDayTasks[dayKey] !== undefined) return
    let cancelled = false
    const tzOffset = new Date().getTimezoneOffset()
    Promise.all([
      fetch(`/api/daily-tasks?date=${dayKey}&tzOffset=${tzOffset}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
      fetch(`/api/calls?date=${dayKey}&tzOffset=${tzOffset}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
    ]).then(([tasksRes, callsRes]) => {
      if (cancelled) return
      const tasks = Array.isArray(tasksRes) ? tasksRes : []
      const calls = Array.isArray(callsRes) ? callsRes : []
      setOverflowDayTasks(prev => ({ ...prev, [dayKey]: tasks }))
      setOverflowDayCalls(prev => ({ ...prev, [dayKey]: calls }))
    })
    return () => { cancelled = true }
  }, [topRowDayOffset, dashboardWeekMonday])

  // Изолированная загрузка данных по питанию (не трогаем основной fetchData)
  useEffect(() => {
    const loadNutrition = async () => {
      try {
        const res = await fetch('/api/nutrition/today', { cache: 'no-store' })
        if (res.status === 403) {
          // Модуль выключен — просто не показываем ошибок
          return
        }
        if (!res.ok) {
          setNutritionError('Не удалось загрузить данные по белку.')
          return
        }
        const json = await res.json()
        setNutritionSummary(json)
      } catch (e) {
        console.error('Error loading nutrition summary:', e)
        setNutritionError('Не удалось загрузить данные по белку.')
      }
    }
    loadNutrition()
  }, [])

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  const getCurrentWeekMonday = (): Date => {
    const now = new Date()
    const currentDay = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (currentDay === 0 ? 6 : currentDay - 1))
    return monday
  }

  const loadWeekData = async (monday: Date) => {
    const startDateWeek = getDateString(monday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const endDateWeek = getDateString(sunday)
    const weekKey = getWeekKey(monday)
    try {
      const habitsRes = await fetch('/api/habits', { cache: 'no-store' }).then(r => r.json()).catch(() => [])
      const habitsList = Array.isArray(habitsRes) ? habitsRes : []
      const weeklyHabitIds = habitsList.filter((h: CustomHabit) => h.type === 'weekly').map((h: CustomHabit) => h.id)
      const habitSlotsPromises = weeklyHabitIds.map((id: string) =>
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=habit_${id}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] }))
      )
      const [weekLogsRes, weekGoalsRes, workoutsRes, profiRes, threadsRes, compyRes, ...habitSlotsResults] = await Promise.all([
        fetch(`/api/tracker/daily-log?startDate=${startDateWeek}&endDate=${endDateWeek}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        fetch(`/api/checklist-goals?period=${weekKey}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=workouts_week`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] })),
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=profi_week`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] })),
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=threads_week`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] })),
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=compy_week`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] })),
        ...habitSlotsPromises,
      ])
      setCustomHabits(habitsList)
      const compySlots = Array.isArray(compyRes?.slots) ? compyRes.slots : []
      setCompyWeekUsed(compySlots[0] === true)
      const slotsByHabit: Record<string, (boolean | null)[]> = {}
      weeklyHabitIds.forEach((id: string, idx: number) => {
        const res = habitSlotsResults[idx]
        const arr = Array.isArray(res?.slots) ? res.slots.slice(0, 7) : []
        while (arr.length < 7) arr.push(null)
        slotsByHabit[id] = arr
      })
      setCustomHabitSlots(slotsByHabit)
      const weekLogs = Array.isArray(weekLogsRes) ? weekLogsRes : []
      const weekLogsByDate: Record<string, any> = {}
      weekLogs.forEach((l: any) => { weekLogsByDate[l.date] = l })
      const weekDays: WeekDayLog[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        const dateKey = getDateString(d)
        const log = weekLogsByDate[dateKey]
        weekDays.push({
          date: dateKey,
          stepsDone: Boolean(log?.stepsDone),
          proteinDone: Boolean(log?.proteinDone),
          sleepDone: Boolean(log?.sleepDone),
          junkFood: Boolean(log?.junkFood),
          contentWritingDone: Boolean(log?.contentWritingDone),
          reels: Boolean(log?.reels)
        })
      }
      setWeekDailyLogs(weekDays)
      const goalsRaw = Array.isArray(weekGoalsRes) ? weekGoalsRes : (weekGoalsRes?.goals ? weekGoalsRes.goals : [])
      const normalized = (Array.isArray(goalsRaw) ? goalsRaw : []).map((g: any) => ({
        ...g,
        id: String(g.id),
        completed: g.completed === true || g.completed === 1
      })).filter((g: any) => g.period === 'week')
      setPlanningGoals(prev => ({ ...prev, week: normalized }))
      const w3 = Array.isArray(workoutsRes?.slots) ? workoutsRes.slots.slice(0, 3) : []
      while (w3.length < 3) w3.push(null)
      setWeekWorkoutSlots(w3)
      const p7 = Array.isArray(profiRes?.slots) ? profiRes.slots.slice(0, 7) : []
      while (p7.length < 7) p7.push(null)
      setWeekProfiSlots(p7)
      const t7 = Array.isArray(threadsRes?.slots) ? threadsRes.slots.slice(0, 7) : []
      while (t7.length < 7) t7.push(null)
      setWeekThreadsSlots(t7)
      const weekTasksMap: Record<string, DailyTask[]> = {}
      const weekCallsMap: Record<string, Call[]> = {}
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        const dayKey = getDateString(d)
        const [tasksRes, callsRes] = await Promise.all([
          fetch(`/api/daily-tasks?date=${dayKey}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
          fetch(`/api/calls?date=${dayKey}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        ])
        weekTasksMap[dayKey] = Array.isArray(tasksRes) ? tasksRes : []
        weekCallsMap[dayKey] = Array.isArray(callsRes) ? callsRes : []
      }
      setWeekTasks(weekTasksMap)
      setWeekCalls(weekCallsMap)
    } catch (_) {
      setWeekDailyLogs([])
    }
  }

  const fetchData = async () => {
    setFetchError(null)
    if (typeof window !== 'undefined') console.log('[Dashboard] Загрузка данных...')
    try {
      const today = getTodayDateString()
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const currentQuarter = Math.floor((month - 1) / 3) + 1
      const week = getWeekNumber(now)
      
      // Формируем периоды для планирования целей
      const yearPeriod = year.toString()
      const quarterPeriod = `Q${currentQuarter}`
      const monthPeriod = `${year}-${String(month).padStart(2, '0')}`
      const weekPeriod = `${year}-W${String(week).padStart(2, '0')}`
      
      const FETCH_MS = 8000
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), FETCH_MS)
      )
      const fetchWithTimeout = (url: string) =>
        Promise.race([
          fetch(url, { cache: 'no-store' }).then(r => r.json()),
          timeoutPromise
        ])

      const endDate = today
      const startDateObj = new Date(today)
      startDateObj.setDate(startDateObj.getDate() - 6)
      const startDate = startDateObj.toISOString().slice(0, 10)

      const [dashboardRes, checklistRes, tasksRes, callsRes, todayLogRes, historyRes, dailyLogPeriodRes,
             yearGoalsRes, quarterGoalsRes, monthGoalsRes, weekGoalsRes, dayOffsRes] = await Promise.race([
        Promise.all([
          fetchWithTimeout('/api/dashboard'),
          fetch('/api/checklist-goals', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
          fetch(`/api/daily-tasks?date=${today}&tzOffset=${new Date().getTimezoneOffset()}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
          fetch(`/api/calls?date=${today}&tzOffset=${new Date().getTimezoneOffset()}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
          fetch(`/api/tracker/daily-log?date=${today}&_=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null),
          fetch('/api/history', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
          fetch(`/api/tracker/daily-log?startDate=${startDate}&endDate=${endDate}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
          fetch(`/api/checklist-goals?period=${yearPeriod}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
          fetch(`/api/checklist-goals?period=${quarterPeriod}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
          fetch(`/api/checklist-goals?period=${monthPeriod}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
          fetch(`/api/checklist-goals?period=${weekPeriod}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
          fetch(`/api/day-offs?startDate=${today}&endDate=${today}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        ]),
        timeoutPromise
      ])
      
      // Если API вернул ошибку (например 500) — показываем сообщение и кнопку «Повторить»
      if (!dashboardRes?.metrics || dashboardRes.error) {
        setFetchError(dashboardRes?.error ?? 'Не удалось загрузить данные.')
        setLoading(false)
        return
      }
      
      // Нормализуем цели планирования: id как строка, completed как boolean
      const normalizeGoals = (goals: any[]) => {
        return Array.isArray(goals) ? goals.map((g: any) => ({
          ...g,
          id: String(g.id),
          completed: g.completed === true || g.completed === 1
        })) : []
      }
      
      setPlanningGoals({
        year: normalizeGoals(yearGoalsRes),
        quarter: normalizeGoals(quarterGoalsRes),
        month: normalizeGoals(monthGoalsRes),
        week: normalizeGoals(weekGoalsRes)
      })
      const logs = Array.isArray(dailyLogPeriodRes) ? dailyLogPeriodRes : []
      setDailyLogHistory(logs.map((l: any) => ({
        date: l.date,
        dayOff: l.dayOff ?? null,
        workoutType: l.workoutType ?? null,
        sleepDone: Boolean(l.sleepDone),
        reels: Boolean(l.reels)
      })))
      // Верхняя строка: логи за текущую неделю (Пн–Вс)
      const currentDay = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - (currentDay === 0 ? 6 : currentDay - 1))
      const startDateWeek = getDateString(monday)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const endDateWeek = getDateString(sunday)
      try {
        const weekLogsRes = await fetch(`/api/tracker/daily-log?startDate=${startDateWeek}&endDate=${endDateWeek}`, { cache: 'no-store' }).then(r => r.json()).catch(() => [])
        const weekLogs = Array.isArray(weekLogsRes) ? weekLogsRes : []
        const weekLogsByDate: Record<string, any> = {}
        weekLogs.forEach((l: any) => { weekLogsByDate[l.date] = l })
        const weekDays: WeekDayLog[] = []
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday)
          d.setDate(monday.getDate() + i)
          const dateKey = getDateString(d)
          const log = weekLogsByDate[dateKey]
          weekDays.push({
            date: dateKey,
            stepsDone: Boolean(log?.stepsDone),
            proteinDone: Boolean(log?.proteinDone),
            sleepDone: Boolean(log?.sleepDone),
            junkFood: Boolean(log?.junkFood),
            contentWritingDone: Boolean(log?.contentWritingDone),
            reels: Boolean(log?.reels)
          })
        }
        setWeekDailyLogs(weekDays)
      } catch (_) {
        setWeekDailyLogs([])
      }
      
      // Инициализация выбранного дня: при первом заходе выбираем сегодня
      setSelectedWeekDay((prev) => prev ?? now)
      setSelectedDayData((prev) => {
        if (prev) return prev
        return {
          dayKey: today,
          tasks: Array.isArray(tasksRes) ? tasksRes : [],
          calls: Array.isArray(callsRes) ? callsRes : [],
        }
      })
      
      // Загружаем задачи для всех дней недели (monday уже вычислен выше)
      const tzOffset = new Date().getTimezoneOffset()
      const weekPromises = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(monday)
        day.setDate(monday.getDate() + i)
        const dayKey = getDateString(day)
        return Promise.all([
          fetch(`/api/daily-tasks?date=${dayKey}&tzOffset=${tzOffset}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(tasks => ({ dayKey, tasks }))
            .catch(() => ({ dayKey, tasks: [] })),
          fetch(`/api/calls?date=${dayKey}&tzOffset=${tzOffset}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(calls => ({ dayKey, calls }))
            .catch(() => ({ dayKey, calls: [] }))
        ])
      })
      
      const weekResults = await Promise.all(weekPromises)
      const weekTasksMap: Record<string, DailyTask[]> = {}
      const weekCallsMap: Record<string, Call[]> = {}
      weekResults.forEach(([tasksResult, callsResult]) => {
        weekTasksMap[tasksResult.dayKey] = tasksResult.tasks
        weekCallsMap[callsResult.dayKey] = callsResult.calls
      })
      setWeekTasks(weekTasksMap)
      setWeekCalls(weekCallsMap)
      
      // Получаем баланс на начало месяца и конец прошлого месяца из истории
      if (Array.isArray(historyRes) && historyRes.length > 0) {
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1
        
        // Находим запись за текущий месяц
        const currentMonthRecord = historyRes.find((h: any) => h.year === currentYear && h.month === currentMonth)
        if (currentMonthRecord) {
          setBalanceAtMonthStart(currentMonthRecord.totalAccounts)
        }
        
        // Находим запись за прошлый месяц
        let prevMonthRecord = null
        if (currentMonth === 1) {
          prevMonthRecord = historyRes.find((h: any) => h.year === currentYear - 1 && h.month === 12)
        } else {
          prevMonthRecord = historyRes.find((h: any) => h.year === currentYear && h.month === currentMonth - 1)
        }
        
        if (prevMonthRecord) {
          setBalanceAtLastMonthEnd(prevMonthRecord.totalAccounts)
          // Если нет записи за текущий месяц, используем конец прошлого месяца как начало текущего
          if (!currentMonthRecord) {
            setBalanceAtMonthStart(prevMonthRecord.totalAccounts)
          }
        }
        
        // Находим первую запись в истории (начальный баланс)
        const sortedHistory = [...historyRes].sort((a: any, b: any) => {
          if (a.year !== b.year) return a.year - b.year
          return a.month - b.month
        })
        if (sortedHistory.length > 0) {
          setInitialStartBalance(sortedHistory[0].totalAccounts)
        }
      }
      
      setMetrics(dashboardRes.metrics)
      const goalsData = dashboardRes.goals || []
      setGoals(goalsData)
      setTransactions(dashboardRes.transactions || [])
      setExpectedExpenses(dashboardRes.settings?.expectedMonthlyExpenses || 0)
      setChecklistGoals(Array.isArray(checklistRes) ? normalizeGoals(checklistRes) : normalizeGoals(checklistRes?.goals || []))
      setDailyTasks(Array.isArray(tasksRes) ? tasksRes : [])
      setCalls(Array.isArray(callsRes) ? callsRes : [])
      // Выходной: сегодня в списке day_offs
      const dayOffsList = Array.isArray(dayOffsRes) ? dayOffsRes : []
      setTodayIsDayOff(dayOffsList.includes(today))
      setLeadsToContact(dashboardRes.leadsToContact || [])
      setUpcomingLeadsToContact(dashboardRes.upcomingLeadsToContact || [])
      
      // Привычки: единственный источник — GET /api/tracker/daily-log?date=<today>. Нет записи за today = всё false.
      const todayDateKey = today
      const hasRecordForToday = todayLogRes != null && typeof todayLogRes === 'object' && typeof (todayLogRes as { date?: unknown }).date === 'string' && (todayLogRes as { date: string }).date === todayDateKey
      const statusForToday = hasRecordForToday
        ? {
            stepsDone: (todayLogRes as { stepsDone?: unknown }).stepsDone === true,
            proteinDone: (todayLogRes as { proteinDone?: unknown }).proteinDone === true,
            sleepDone: (todayLogRes as { sleepDone?: unknown }).sleepDone === true,
            workoutType: ((todayLogRes as { workoutType?: unknown }).workoutType as 'gym' | 'home' | null) ?? null,
            alcohol: (todayLogRes as { alcohol?: unknown }).alcohol === true,
            dayOff: ((todayLogRes as { dayOff?: unknown }).dayOff as 'none' | 'partial' | 'full' | null) ?? null,
            junkFood: (todayLogRes as { junkFood?: unknown }).junkFood === true,
            reels: (todayLogRes as { reels?: unknown }).reels === true,
            gamesDone: (todayLogRes as { gamesDone?: unknown }).gamesDone === true,
            contentWritingDone: (todayLogRes as { contentWritingDone?: unknown }).contentWritingDone === true
          }
        : {
            stepsDone: false,
            proteinDone: false,
            sleepDone: false,
            workoutType: null,
            alcohol: null,
            dayOff: null,
            junkFood: null,
            reels: false,
            gamesDone: false,
            contentWritingDone: false
          }
      setTodayLog(statusForToday)
      
      // Загружаем недельные и месячные метрики
      const weekKey = getWeekKey(now)
      const monthKey = getMonthKey(now)
      
      // Загружаем YouTube (месячный)
      try {
        const youtubeRes = await fetch(`/api/tracker/slot-progress?periodKey=${monthKey}&metricKey=youtube_month`, { cache: 'no-store' })
        const youtubeData = await youtubeRes.json()
        const youtubeSlots = Array.isArray(youtubeData?.slots) ? youtubeData.slots : []
        setYoutubeDone(youtubeSlots.some((slot: boolean) => slot === true))
      } catch (error) {
        console.error('Error loading YouTube:', error)
      }
      
      // Загружаем Telegram, Threads, Social, ClientSearch, Workouts (недельные)
      try {
        const [tgRes, threadsRes, socialRes, profiRes, workoutsRes, compyRes] = await Promise.all([
          fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=tg_week`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] })),
          fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=threads_week`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] })),
          fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=social_week`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] })),
          fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=profi_week`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] })),
          fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=workouts_week`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] })),
          fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=compy_week`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] })),
        ])
        
        const tgSlots = Array.isArray(tgRes?.slots) ? tgRes.slots : []
        const threadsSlots = Array.isArray(threadsRes?.slots) ? threadsRes.slots : []
        const socialSlots = Array.isArray(socialRes?.slots) ? socialRes.slots : []
        const profiSlots = Array.isArray(profiRes?.slots) ? profiRes.slots : []
        const workoutSlots = Array.isArray(workoutsRes?.slots) ? workoutsRes.slots : []
        
        setTelegramDone(tgSlots.some((slot: boolean) => slot === true))
        setThreadsDone(threadsSlots.some((slot: boolean) => slot === true))
        if (hasRecordForToday) {
          setSocialDone(socialSlots.some((slot: boolean) => slot === true))
          setClientSearchDone(profiSlots.some((slot: boolean) => slot === true) || threadsSlots.some((slot: boolean) => slot === true))
        } else {
          setSocialDone(false)
          setClientSearchDone(false)
        }
        const w3 = [...workoutSlots.slice(0, 3)]
        while (w3.length < 3) w3.push(null)
        setWeekWorkoutSlots(w3)
        const p7 = [...profiSlots.slice(0, 7)]
        while (p7.length < 7) p7.push(null)
        setWeekProfiSlots(p7)
        const t7 = [...threadsSlots.slice(0, 7)]
        while (t7.length < 7) t7.push(null)
        setWeekThreadsSlots(t7)
        const compySlots = Array.isArray(compyRes?.slots) ? compyRes.slots : []
        setCompyWeekUsed(compySlots[0] === true)
        // Пользовательские привычки: загружаем список и слоты на текущую неделю
        try {
          const habitsRes = await fetch('/api/habits', { cache: 'no-store' }).then(r => r.json()).catch(() => [])
          const habitsList = Array.isArray(habitsRes) ? habitsRes : []
          setCustomHabits(habitsList)
          const weeklyIds = habitsList.filter((x: CustomHabit) => x.type === 'weekly').map((x: CustomHabit) => x.id)
          const slotsByHabit: Record<string, (boolean | null)[]> = {}
          for (const id of weeklyIds) {
            const res = await fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=habit_${id}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ slots: [] }))
            const arr = Array.isArray(res?.slots) ? res.slots.slice(0, 7) : []
            while (arr.length < 7) arr.push(null)
            slotsByHabit[id] = arr
          }
          setCustomHabitSlots(slotsByHabit)
        } catch (_) {}
      } catch (error) {
        console.error('Error loading weekly metrics:', error)
      }
    } catch (error) {
      console.error('[Dashboard] Ошибка загрузки:', error)
      const msg = error instanceof Error && error.message === 'timeout'
        ? 'Сервер не ответил вовремя. Убедитесь, что запущен npm run dev и открыт правильный адрес (например http://127.0.0.1:3000).'
        : 'Не удалось загрузить данные.'
      setFetchError(msg)
    } finally {
      setLoading(false)
      if (typeof window !== 'undefined') console.log('[Dashboard] Загрузка завершена.')
    }
  }

  // Сохранение привычки за конкретный день (для верхней строки). Отправляем полное состояние дня, иначе API перезапишет остальные поля.
  const saveDayHabit = async (dateKey: string, field: keyof Omit<WeekDayLog, 'date'>, value: boolean) => {
    const day = weekDailyLogs.find(d => d.date === dateKey)
    const merged = day ? { ...day, [field]: value } : { date: dateKey, stepsDone: false, proteinDone: false, sleepDone: false, junkFood: false, contentWritingDone: false, reels: false, [field]: value }
    try {
      const res = await fetch('/api/tracker/daily-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateKey,
          stepsDone: merged.stepsDone,
          proteinDone: merged.proteinDone,
          sleepDone: merged.sleepDone,
          junkFood: merged.junkFood,
          contentWritingDone: merged.contentWritingDone,
          reels: merged.reels,
        }),
      })
      if (res.ok) {
        setWeekDailyLogs(prev => prev.map(d => d.date === dateKey ? { ...d, [field]: value } : d))
        if (dateKey === getTodayDateString() && todayLog) setTodayLog({ ...todayLog, [field]: value })
      }
    } catch (e) {
      console.error('saveDayHabit', e)
    }
  }

  const saveWorkoutSlot = async (index: number) => {
    const next = [...weekWorkoutSlots]
    const isChecked = next[index] === true || next[index] === 'gym' || next[index] === 'home'
    next[index] = isChecked ? null : 'gym'
    setWeekWorkoutSlots(next)
    try {
      await fetch('/api/tracker/slot-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: getWeekKey(new Date()), metricKey: 'workouts_week', slots: next }),
      })
      // Чтобы тренировка отображалась в трекере, обновляем daily-log за сегодня (трекер читает workoutType из daily-log)
      if (!isChecked) {
        const today = getTodayDateString()
        const body = {
          date: today,
          stepsDone: todayLog?.stepsDone ?? false,
          proteinDone: todayLog?.proteinDone ?? false,
          sleepDone: todayLog?.sleepDone ?? false,
          workoutType: 'gym' as const,
          alcohol: todayLog?.alcohol ?? false,
          dayOff: todayLog?.dayOff ?? null,
          junkFood: todayLog?.junkFood ?? false,
          reels: todayLog?.reels ?? false,
          gamesDone: todayLog?.gamesDone ?? false,
          contentWritingDone: todayLog?.contentWritingDone ?? false,
        }
        await fetch('/api/tracker/daily-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        setTodayLog(prev => prev ? { ...prev, workoutType: 'gym' } : null)
      }
    } catch (e) {
      console.error('saveWorkoutSlot', e)
      setWeekWorkoutSlots(weekWorkoutSlots)
    }
  }

  const saveClientSearchSlot = async (dayIndex: number) => {
    const next = [...weekClientSearchSlots]
    next[dayIndex] = next[dayIndex] === true ? null : true
    setWeekClientSearchSlots(next)
    try {
      await fetch('/api/tracker/slot-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: getWeekKey(new Date()), metricKey: 'client_search_week', slots: next }),
      })
    } catch (e) {
      console.error('saveClientSearchSlot', e)
      setWeekClientSearchSlots(weekClientSearchSlots)
    }
  }

  const saveProfiSlot = async (dayIndex: number) => {
    const next = [...weekProfiSlots]
    next[dayIndex] = next[dayIndex] === true ? null : true
    setWeekProfiSlots(next)
    try {
      await fetch('/api/tracker/slot-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: getWeekKey(new Date()), metricKey: 'profi_week', slots: next }),
      })
    } catch (e) {
      console.error('saveProfiSlot', e)
      setWeekProfiSlots(weekProfiSlots)
    }
  }

  const saveThreadsSlot = async (dayIndex: number) => {
    const next = [...weekThreadsSlots]
    next[dayIndex] = next[dayIndex] === true ? null : true
    setWeekThreadsSlots(next)
    try {
      await fetch('/api/tracker/slot-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: getWeekKey(new Date()), metricKey: 'threads_week', slots: next }),
      })
    } catch (e) {
      console.error('saveThreadsSlot', e)
      setWeekThreadsSlots(weekThreadsSlots)
    }
  }

  /** Отметить поход в компы с друзьями (1 раз в неделю). Только для текущей недели. */
  const saveCompyUsed = async () => {
    if (compyWeekUsed) return
    const weekKey = getWeekKey(new Date())
    setCompyWeekUsed(true)
    try {
      await fetch('/api/tracker/slot-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: weekKey, metricKey: 'compy_week', slots: [true] }),
      })
    } catch (e) {
      console.error('saveCompyUsed', e)
      setCompyWeekUsed(false)
    }
  }

  /** Отменить отметку похода в компы за эту неделю. */
  const cancelCompyUsed = async () => {
    if (!compyWeekUsed) return
    const weekKey = getWeekKey(new Date())
    setCompyWeekUsed(false)
    try {
      await fetch('/api/tracker/slot-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: weekKey, metricKey: 'compy_week', slots: [false] }),
      })
    } catch (e) {
      console.error('cancelCompyUsed', e)
      setCompyWeekUsed(true)
    }
  }

  const getPeriodKey = (periodValue: string): 'year' | 'quarter' | 'month' | 'week' | null => {
    if (/^\d{4}$/.test(periodValue)) return 'year'
    if (/^Q[1-4]$/.test(periodValue)) return 'quarter'
    if (/^\d{4}-\d{2}$/.test(periodValue)) return 'month'
    if (/^\d{4}-W\d{1,2}$/.test(periodValue)) return 'week'
    return null
  }

  const handleAddChecklistGoal = async (period: 'week' | 'month' | 'quarter', title: string) => {
    const t = title?.trim()
    if (!t) return false
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const currentQuarter = Math.floor((month - 1) / 3) + 1
    const week = getWeekNumber(now)
    const periodMap = {
      week: `${year}-W${String(week).padStart(2, '0')}`,
      month: `${year}-${String(month).padStart(2, '0')}`,
      quarter: `Q${currentQuarter}` as string,
    }
    const periodValue = periodMap[period]
    try {
      const res = await fetch('/api/checklist-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: periodValue, title: t }),
      })
      if (!res.ok) return false
      const data = await res.json()
      const goal = data.goal ?? data
      const newGoal: ChecklistGoal = {
        id: String(goal.id),
        period: periodValue,
        title: goal.title ?? t,
        completed: Boolean(goal.completed),
        order: goal.order ?? 0,
        priority: (goal.priority as GoalPriority) ?? 'medium',
        description: goal.notes ?? null,
      }
      setPlanningGoals(prev => ({
        ...prev,
        [period]: [...prev[period], newGoal],
      }))
      return true
    } catch (e) {
      console.error('handleAddChecklistGoal', e)
      return false
    }
  }

  const handlePriorityToggle = async (id: string, newCompleted: boolean) => {
    const sid = String(id)
    try {
      let goal: ChecklistGoal | undefined
      let period: 'year' | 'quarter' | 'month' | 'week' | null = null

      if (planningGoals.year.find(g => String(g.id) === sid)) {
        goal = planningGoals.year.find(g => String(g.id) === sid)!
        period = 'year'
      } else if (planningGoals.quarter.find(g => String(g.id) === sid)) {
        goal = planningGoals.quarter.find(g => String(g.id) === sid)!
        period = 'quarter'
      } else if (planningGoals.month.find(g => String(g.id) === sid)) {
        goal = planningGoals.month.find(g => String(g.id) === sid)!
        period = 'month'
      } else if (planningGoals.week.find(g => String(g.id) === sid)) {
        goal = planningGoals.week.find(g => String(g.id) === sid)!
        period = 'week'
      } else {
        const fromChecklist = checklistGoals.find(g => String(g.id) === sid)
        if (fromChecklist) {
          goal = fromChecklist
          period = getPeriodKey((goal as any).period || '')
        }
      }

      if (!goal) return

      // Явное новое значение — не переключаем по текущему состоянию, чтобы повторный onChange не сбрасывал галочку
      const updatedGoal = { ...goal, completed: newCompleted }
      setChecklistGoals(prev => prev.map(g => (String(g.id) === sid ? updatedGoal : g)))
      if (period) {
        setPlanningGoals(prev => ({
          ...prev,
          [period]: prev[period].map(g => (String(g.id) === sid ? updatedGoal : g))
        }))
      }
      if (selectedPriority && String(selectedPriority.id) === sid) {
        setSelectedPriority(updatedGoal)
      }

      const res = await fetch(`/api/checklist-goals/${sid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goal.title,
          completed: newCompleted,
          notes: (goal as any).notes ?? goal.description ?? null
        }),
      })

      if (!res.ok) {
        setChecklistGoals(prev => prev.map(g => (String(g.id) === sid ? goal! : g)))
        if (period) {
          setPlanningGoals(prev => ({
            ...prev,
            [period]: prev[period].map(g => (String(g.id) === sid ? goal! : g))
          }))
        }
        if (selectedPriority && String(selectedPriority.id) === sid) {
          setSelectedPriority(goal)
        }
      }
    } catch (error) {
      console.error('Error toggling priority:', error)
    }
  }

  const handleDailyTaskToggle = async (task: DailyTask) => {
    // Оптимистичное обновление UI
    const updatedTask = { ...task, completed: !task.completed }
    
    // Обновляем dailyTasks
    setDailyTasks(dailyTasks.map(t => 
      t.id === task.id ? updatedTask : t
    ))
    
    // Обновляем weekTasks для всех дней
    setWeekTasks(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(dayKey => {
        updated[dayKey] = updated[dayKey].map((t: DailyTask) => 
          t.id === task.id ? updatedTask : t
        )
      })
      return updated
    })
    
    // Обновляем данные выбранного дня, если задача в нём отображается
    setSelectedDayData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === task.id ? updatedTask : t
        ),
      }
    })
    
    // Обновляем selectedTask если это та же задача
    if (selectedTask?.id === task.id) {
      setSelectedTask(updatedTask)
    }
    
    try {
      const res = await fetch(`/api/daily-tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed }),
      })

      if (!res.ok) {
        // Откатываем изменения при ошибке
        setDailyTasks(dailyTasks.map(t => 
          t.id === task.id ? task : t
        ))
        setWeekTasks(prev => {
          const updated = { ...prev }
          Object.keys(updated).forEach(dayKey => {
            updated[dayKey] = updated[dayKey].map((t: DailyTask) => 
              t.id === task.id ? task : t
            )
          })
          return updated
        })
        setSelectedDayData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === task.id ? task : t
            ),
          }
        })
        if (selectedTask?.id === task.id) {
          setSelectedTask(task)
        }
        console.error('Error toggling task:', res.statusText)
      }
    } catch (error) {
      // Откатываем изменения при ошибке
      setDailyTasks(dailyTasks.map(t => 
        t.id === task.id ? task : t
      ))
      setWeekTasks(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(dayKey => {
          updated[dayKey] = updated[dayKey].map((t: DailyTask) => 
            t.id === task.id ? task : t
          )
        })
        return updated
      })
      setSelectedDayData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === task.id ? task : t
          ),
        }
      })
      if (selectedTask?.id === task.id) {
        setSelectedTask(task)
      }
      console.error('Error toggling task:', error)
    }
  }

  /** Перенести задачу на следующий день (для блока «Задачи на сегодня»). */
  const moveTaskToNextDay = async (task: DailyTask, fromDayKey: string) => {
    const fromDate = new Date(fromDayKey + 'T12:00:00')
    const nextDate = new Date(fromDate)
    nextDate.setDate(fromDate.getDate() + 1)
    const nextDayKey = getDateString(nextDate)
    try {
      const res = await fetch(`/api/daily-tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: nextDayKey + 'T12:00:00.000Z' }),
      })
      if (!res.ok) return
      const movedTask = { ...task, date: nextDayKey + 'T12:00:00.000Z' }
      setWeekTasks((prev) => {
        const next = { ...prev }
        next[fromDayKey] = (next[fromDayKey] || []).filter((t: DailyTask) => t.id !== task.id)
        next[nextDayKey] = [...(next[nextDayKey] || []), movedTask]
        return next
      })
      setSelectedDayData((prev) => prev && prev.dayKey === fromDayKey ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== task.id) } : prev)
    } catch (e) {
      console.error('moveTaskToNextDay', e)
    }
  }

  const handleCallToggle = async (call: Call) => {
    const updatedCall = { ...call, completed: !call.completed }

    // Обновляем weekCalls
    setWeekCalls(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(dayKey => {
        updated[dayKey] = updated[dayKey].map((c: Call) =>
          c.id === call.id ? updatedCall : c
        )
      })
      return updated
    })

    // Обновляем выбранный день
    setSelectedDayData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        calls: prev.calls.map(c => (c.id === call.id ? updatedCall : c)),
      }
    })

    try {
      const res = await fetch(`/api/calls/${call.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !call.completed }),
      })
      if (!res.ok) {
        // Откат
        setWeekCalls(prev => {
          const updated = { ...prev }
          Object.keys(updated).forEach(dayKey => {
            updated[dayKey] = updated[dayKey].map((c: Call) =>
              c.id === call.id ? call : c
            )
          })
          return updated
        })
        setSelectedDayData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            calls: prev.calls.map(c => (c.id === call.id ? call : c)),
          }
        })
        console.error('Error toggling call:', res.statusText)
      }
    } catch (error) {
      // Откат
      setWeekCalls(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(dayKey => {
          updated[dayKey] = updated[dayKey].map((c: Call) =>
            c.id === call.id ? call : c
          )
        })
        return updated
      })
      setSelectedDayData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          calls: prev.calls.map(c => (c.id === call.id ? call : c)),
        }
      })
      console.error('Error toggling call:', error)
    }
  }

  const handleViewTask = (task: DailyTask) => {
    setSelectedTask(task)
    setTaskDescription(task.description || '')
  }

  const saveHabit = async (updates: Partial<NonNullable<typeof todayLog>>) => {
    if (!todayLog) {
      console.error('todayLog is null, cannot save habit')
      alert('Данные о привычках еще не загружены. Пожалуйста, подождите.')
      return
    }
    
    console.log('saveHabit called with updates:', updates)
    console.log('current todayLog:', todayLog)
    
    const today = new Date().toISOString().split('T')[0]
    const updated = { ...todayLog, ...updates }
    
    console.log('updated log:', updated)
    
    // Оптимистичное обновление UI - сразу показываем изменения
    setTodayLog(updated)
    
    try {
      const requestBody = {
        date: today,
        stepsDone: updated.stepsDone,
        proteinDone: updated.proteinDone,
        sleepDone: updated.sleepDone,
        workoutType: updated.workoutType,
        alcohol: updated.alcohol,
        dayOff: updated.dayOff,
        junkFood: updated.junkFood,
        reels: updated.reels,
        gamesDone: updated.gamesDone,
        contentWritingDone: updated.contentWritingDone
      }
      
      console.log('Sending request to API:', requestBody)
      
      const res = await fetch('/api/tracker/daily-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      console.log('API response status:', res.status)
      
      const data = await res.json()
      console.log('API response data:', data)
      
      if (data.success) {
        console.log('Successfully saved')
        // Обновляем состояние с данными с сервера (на случай если сервер вернул что-то другое)
        if (data.log) {
          setTodayLog({
            stepsDone: Boolean(data.log.stepsDone),
            proteinDone: Boolean(data.log.proteinDone),
            sleepDone: Boolean(data.log.sleepDone),
            workoutType: data.log.workoutType || null,
            alcohol: Boolean(data.log.alcohol),
            dayOff: data.log.dayOff || null,
            junkFood: Boolean(data.log.junkFood),
            reels: Boolean(data.log.reels),
            gamesDone: Boolean(data.log.gamesDone),
            contentWritingDone: Boolean(data.log.contentWritingDone)
          })
        }
        
        // Автоматически обновляем недельные слоты в трекере
        const todayDate = new Date()
        // Используем ISO недели (понедельник = начало недели)
        const weekKey = getWeekKey(todayDate)
        
        // Если изменили тренировку, обновляем недельный слот
        if (updates.workoutType !== undefined) {
          try {
            // Получаем текущие слоты тренировок
            const workoutRes = await fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=workouts_week`, { cache: 'no-store' })
            const workoutData = await workoutRes.json()
            let slots = Array.isArray(workoutData?.slots) ? workoutData.slots : Array(3).fill(null)
            
            const oldWorkoutType = todayLog.workoutType
            const newWorkoutType = updates.workoutType
            
            if (newWorkoutType === null) {
              // Если убираем тренировку - удаляем слот с предыдущим типом
              if (oldWorkoutType) {
                const slotIndex = slots.findIndex((slot: string | null) => slot === oldWorkoutType)
                if (slotIndex !== -1) {
                  slots[slotIndex] = null
                }
              }
            } else if (oldWorkoutType === null) {
              // Если добавляем тренировку - заполняем первый пустой слот
              const firstEmptyIndex = slots.findIndex((slot: string | null) => slot === null)
              if (firstEmptyIndex !== -1) {
                slots[firstEmptyIndex] = newWorkoutType
              }
            } else if (oldWorkoutType !== newWorkoutType) {
              // Если меняем тип тренировки - обновляем слот
              const slotIndex = slots.findIndex((slot: string | null) => slot === oldWorkoutType)
              if (slotIndex !== -1) {
                slots[slotIndex] = newWorkoutType
              }
            }
            
            // Сохраняем обновленные слоты
            await fetch('/api/tracker/slot-progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                periodKey: weekKey,
                metricKey: 'workouts_week',
                slots
              })
            })
          } catch (error) {
            console.error('Error updating workout slots:', error)
          }
        }
        
        // Reels теперь обрабатывается отдельной кнопкой в медиа, не через saveHabit
        
      } else {
        console.error('API returned success=false:', data)
        // Откатываем оптимистичное обновление при ошибке
        setTodayLog(todayLog)
        alert('Ошибка при сохранении привычки. Проверьте консоль для деталей.')
      }
    } catch (error) {
      console.error('Error saving habit:', error)
      // Откатываем оптимистичное обновление при ошибке
      setTodayLog(todayLog)
      alert('Ошибка при сохранении привычки: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleSaveTaskDescription = async () => {
    if (!selectedTask) return
    
    try {
      const res = await fetch(`/api/daily-tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: taskDescription }),
      })

      if (res.ok) {
        setDailyTasks(dailyTasks.map(t => 
          t.id === selectedTask.id ? { ...t, description: taskDescription } : t
        ))
        setSelectedTask({ ...selectedTask, description: taskDescription })
      }
    } catch (error) {
      console.error('Error saving task description:', error)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading || !metrics) {
    if (fetchError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-red-600">{fetchError}</div>
          <button
            onClick={() => {
              setLoading(true)
              setFetchError(null)
              fetchData()
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Повторить
          </button>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <div className="text-gray-500">Загрузка...</div>
        <p className="text-sm text-gray-400 max-w-md text-center">
          Если ничего не появляется — откройте http://127.0.0.1:3000 в браузере. Через 8 сек появится подсказка или кнопка «Повторить».
        </p>
      </div>
    )
  }

  // Calculate monthly expenses
  const monthlyExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum: number, t) => sum + t.amount, 0)

  // Update goal current amounts from linked accounts
  const goalsWithCurrent = goals.map((goal) => {
    let current = goal.currentAmount
    if (goal.linkedAccountBalance !== null) {
      current = goal.linkedAccountBalance
    }
    return { ...goal, currentAmount: current }
  })

  // Группируем цели по периодам
  const goalsByPeriod = {
    year: goalsWithCurrent.filter(g => g.period === 'year'),
    quarter: goalsWithCurrent.filter(g => g.period === 'quarter'),
    month: goalsWithCurrent.filter(g => g.period === 'month'),
    week: goalsWithCurrent.filter(g => g.period === 'week')
  }

  const allGoals = [...goalsWithCurrent].sort((a, b) => {
    const aDeadline = a.deadline ? new Date(a.deadline).getTime() : 0
    const bDeadline = b.deadline ? new Date(b.deadline).getTime() : 0
    return aDeadline - bDeadline
  })

  const today = new Date()
  const todayFormatted = today.toLocaleDateString('ru-RU', { 
    day: 'numeric', 
    month: 'long' 
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">#NBD</h1>
        <div className="flex space-x-3">
          <button
            onClick={async () => {
              await fetch('/api/history/save-current', { method: 'POST' })
              alert('Текущий месяц сохранён в историю!')
            }}
            className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Сохранить месяц
          </button>
          <Link
            href="/me/history"
            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-600 rounded-md"
          >
            История →
          </Link>
        </div>
      </div>

      {/* Самый верх: Прибыль всех проектов + Дельта — широкие плашки */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4 flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-0.5">Прибыль всех проектов</div>
          <div className={`text-2xl font-bold ${metrics.totalExpectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {metrics.totalExpectedProfit >= 0 ? '+' : ''}{metrics.totalExpectedProfit.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-xs text-gray-500 mt-1">Выручка: {metrics.totalRevenue.toLocaleString('ru-RU')} ₽</div>
          {(metrics.avgTotalProfit != null || metrics.avgTotalRevenue != null) && (
            <div className="mt-1.5 text-xs text-gray-500 space-y-0.5">
              {metrics.avgTotalProfit != null && (
                <span className={metrics.totalExpectedProfit > metrics.avgTotalProfit ? 'text-green-600' : metrics.totalExpectedProfit < metrics.avgTotalProfit ? 'text-red-600' : ''}>
                  Прибыль: {metrics.totalExpectedProfit > metrics.avgTotalProfit ? '↑' : metrics.totalExpectedProfit < metrics.avgTotalProfit ? '↓' : '='}{' '}
                  {metrics.totalExpectedProfit > metrics.avgTotalProfit
                    ? `${((metrics.totalExpectedProfit / metrics.avgTotalProfit - 1) * 100).toFixed(1)}% к средней`
                    : metrics.totalExpectedProfit < metrics.avgTotalProfit
                    ? `${((1 - metrics.totalExpectedProfit / metrics.avgTotalProfit) * 100).toFixed(1)}% к средней`
                    : 'на уровне'}
                </span>
              )}
              {metrics.avgTotalRevenue != null && (
                <span className={metrics.totalRevenue > metrics.avgTotalRevenue ? 'text-green-600' : metrics.totalRevenue < metrics.avgTotalRevenue ? 'text-red-600' : ''}>
                  {' · '}Выручка: {metrics.totalRevenue > metrics.avgTotalRevenue ? '↑' : metrics.totalRevenue < metrics.avgTotalRevenue ? '↓' : '='}{' '}
                  {metrics.totalRevenue > metrics.avgTotalRevenue
                    ? `${((metrics.totalRevenue / metrics.avgTotalRevenue - 1) * 100).toFixed(1)}%`
                    : metrics.totalRevenue < metrics.avgTotalRevenue
                    ? `${((1 - metrics.totalRevenue / metrics.avgTotalRevenue) * 100).toFixed(1)}%`
                    : 'на уровне'}
                </span>
              )}
            </div>
          )}
        </div>
        {metrics.newMonthEndForecast != null && balanceAtMonthStart !== null && (
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4 flex flex-col justify-center">
            <div className="text-sm text-gray-600 mb-0.5">Дельта</div>
            <div className={`text-2xl font-bold ${metrics.newMonthEndForecast - balanceAtMonthStart >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.newMonthEndForecast - balanceAtMonthStart >= 0 ? '+' : ''}{(metrics.newMonthEndForecast - balanceAtMonthStart).toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-gray-500 mt-1">К 1-му числа: {balanceAtMonthStart.toLocaleString('ru-RU')} ₽ → прогноз: {metrics.newMonthEndForecast.toLocaleString('ru-RU')} ₽</div>
            {metrics.pessimisticForecast != null && (
              <div className={`text-xs mt-1 ${metrics.pessimisticForecast - balanceAtMonthStart >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                Без ожидаемых оплат: {metrics.pessimisticForecast - balanceAtMonthStart >= 0 ? '+' : ''}{(metrics.pessimisticForecast - balanceAtMonthStart).toLocaleString('ru-RU')} ₽
              </div>
            )}
          </div>
        )}
      </div>

      {/* Верхняя строка: Привычки (слева) + Цели недели / месяца / квартала (справа) */}
      {(() => {
        const displayMonday = dashboardWeekMonday ?? getCurrentWeekMonday()
        const monday = new Date(displayMonday)
        const sundayLabel = new Date(monday)
        sundayLabel.setDate(monday.getDate() + 6)
        const weekLabel = `${monday.getDate()} ${monday.toLocaleDateString('ru-RU', { month: 'short' })} – ${sundayLabel.getDate()} ${sundayLabel.toLocaleDateString('ru-RU', { month: 'short' })}`
        const isCurrentWeek = !dashboardWeekMonday
        const emptyDay = (d: Date): WeekDayLog => ({
          date: getDateString(d),
          stepsDone: false,
          proteinDone: false,
          sleepDone: false,
          junkFood: false,
          contentWritingDone: false,
          reels: false,
        })
        const displayWeekLogs = weekDailyLogs.length >= 7
          ? weekDailyLogs.slice(0, 7)
          : Array.from({ length: 7 }, (_, i) => {
              const d = new Date(monday)
              d.setDate(monday.getDate() + i)
              return emptyDay(d)
            })
        const workoutSlots = weekWorkoutSlots.length >= 3 ? weekWorkoutSlots : [null, null, null]
        const profiSlots = weekProfiSlots.length >= 7 ? weekProfiSlots : Array(7).fill(null)
        const threadsSlots = weekThreadsSlots.length >= 7 ? weekThreadsSlots : Array(7).fill(null)
        const habitCheckClass = 'habit-checkbox w-5 h-5 rounded-sm border-2 border-gray-300 bg-gray-100 text-white focus:ring-2 focus:ring-sky-400 focus:ring-offset-0 checked:bg-sky-500 checked:border-sky-500'
        return (
      <>
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr_0.9fr_0.9fr] gap-4 mb-6">
        {/* 1. Главные привычки */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
          <div className="border-l-4 border-violet-500 pl-4 py-3">
            <h2 className="text-lg font-bold text-gray-900">Главные привычки</h2>
            <Link href="/me/habits" className="ml-2 text-sm text-violet-600 hover:text-violet-800 font-medium">Управление привычками</Link>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const prev = new Date(monday)
                  prev.setDate(prev.getDate() - 7)
                  setDashboardWeekMonday(prev)
                }}
                className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-violet-600"
                title="Предыдущая неделя"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-xs text-gray-600 font-medium min-w-[120px]">{weekLabel}</span>
              <button
                type="button"
                onClick={() => {
                  const next = new Date(monday)
                  next.setDate(next.getDate() + 7)
                  setDashboardWeekMonday(next)
                }}
                className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-violet-600"
                title="Следующая неделя"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              {!isCurrentWeek && (
                <button
                  type="button"
                  onClick={() => {
                    setDashboardWeekMonday(null)
                    loadWeekData(getCurrentWeekMonday())
                  }}
                  className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                >
                  Текущая
                </button>
              )}
            </div>
          </div>
          <div className="px-4 pb-3">
            <table className="w-full min-w-0 text-sm table-fixed">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="text-left py-2.5 font-medium w-[52%]">Привычка</th>
                  {['П', 'В', 'С', 'Ч', 'П', 'С', 'В'].map((letter, i) => (
                    <th key={i} className="text-center py-2.5 px-1.5 w-10">{letter}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100 hover:bg-gray-50/80">
                  <td className="py-2.5 text-gray-800 font-medium">Шаги</td>
                  {displayWeekLogs.map((day) => (
                    <td key={day.date} className="text-center py-1 px-1.5">
                      <input
                        type="checkbox"
                        checked={day.stepsDone}
                        onChange={() => saveDayHabit(day.date, 'stepsDone', !day.stepsDone)}
                        className={habitCheckClass}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100 hover:bg-gray-50/80">
                  <td className="py-2.5 text-gray-800 font-medium">Белок</td>
                  {displayWeekLogs.map((day) => (
                    <td key={day.date} className="text-center py-1 px-1.5">
                      <input
                        type="checkbox"
                        checked={day.proteinDone}
                        onChange={() => saveDayHabit(day.date, 'proteinDone', !day.proteinDone)}
                        className={habitCheckClass}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100 hover:bg-gray-50/80">
                  <td className="py-2.5 text-gray-800 font-medium">Сон</td>
                  {displayWeekLogs.map((day) => (
                    <td key={day.date} className="text-center py-1 px-1.5">
                      <input
                        type="checkbox"
                        checked={day.sleepDone}
                        onChange={() => saveDayHabit(day.date, 'sleepDone', !day.sleepDone)}
                        className={habitCheckClass}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100 hover:bg-gray-50/80">
                  <td className="py-2.5 text-gray-800 font-medium">Профи ру</td>
                  {profiSlots.slice(0, 7).map((checked, i) => (
                    <td key={i} className="text-center py-1 px-1.5">
                      <input
                        type="checkbox"
                        checked={checked === true}
                        onChange={() => saveProfiSlot(i)}
                        className={habitCheckClass}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-200/80 hover:bg-gray-50/80">
                  <td className="py-2.5 text-gray-800 font-medium">Тредс</td>
                  {threadsSlots.slice(0, 7).map((checked, i) => (
                    <td key={i} className="text-center py-1 px-1.5">
                      <input
                        type="checkbox"
                        checked={checked === true}
                        onChange={() => saveThreadsSlot(i)}
                        className={habitCheckClass}
                      />
                    </td>
                  ))}
                </tr>
                {customHabits.filter(h => h.isMain && h.type === 'weekly').map((h) => {
                  const slots = customHabitSlots[h.id] ?? Array(7).fill(null)
                  return (
                    <tr key={h.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                      <td className="py-2.5 text-gray-800 font-medium">{h.name}</td>
                      {slots.slice(0, 7).map((checked, i) => (
                        <td key={i} className="text-center py-1 px-1.5">
                          <input
                            type="checkbox"
                            checked={checked === true}
                            onChange={async () => {
                              const next = [...slots]
                              next[i] = next[i] === true ? null : true
                              setCustomHabitSlots(prev => ({ ...prev, [h.id]: next }))
                              try {
                                await fetch('/api/tracker/slot-progress', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ periodKey: getWeekKey(displayMonday), metricKey: `habit_${h.id}`, slots: next }),
                                })
                              } catch (e) { console.error(e) }
                            }}
                            className={habitCheckClass}
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* Тренировка — вне календаря, не привязана к дням недели */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Не привязано к дням календаря</p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-800">Тренировка (на неделю)</span>
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      type="checkbox"
                      checked={workoutSlots[i] === true || workoutSlots[i] === 'gym' || workoutSlots[i] === 'home'}
                      onChange={() => saveWorkoutSlot(i)}
                      className={habitCheckClass}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ОТДЫХ — если сегодня выходной */}
            {todayIsDayOff && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-sky-800 mb-2">Сегодня выходной — ОТДЫХ</h3>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Отдых: тренировки, массаж, рисование, настолки, кофе с друзьями, к родителям, кинотеатр, компы с друзьями.</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Не отдых: кофейня, книга, сериалы, бары, флирт.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Компы раз в неделю */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-amber-900 mb-1.5">Компы раз в неделю (с друзьями)</h3>
              {compyWeekUsed ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-amber-800">Лимит использован.</span>
                  <button type="button" onClick={cancelCompyUsed} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300">Отменить</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-amber-800">Можно сходить.</span>
                  <button type="button" onClick={saveCompyUsed} className="px-2 py-1 bg-amber-500 text-white rounded text-xs font-medium hover:bg-amber-600">Отметить поход</button>
                </div>
              )}
            </div>

            {/* Привычки на сегодня — квадратики (как внизу) */}
            {todayLog && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Привычки на сегодня</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  <button type="button" onClick={() => saveHabit({ alcohol: todayLog.alcohol === null ? true : !todayLog.alcohol })} className={`flex flex-col items-center justify-center text-center p-3 rounded-lg border-2 transition-all min-h-[72px] ${todayLog.alcohol === true ? 'bg-green-50 border-green-500 text-green-700' : todayLog.alcohol === false ? 'bg-red-50 border-red-500 text-red-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                    <span className="text-lg">🍷</span>
                    <span className="text-xs font-medium">Алкоголь</span>
                    <span className="text-[10px] text-gray-500">{todayLog.alcohol === true ? '✅' : todayLog.alcohol === false ? 'Был' : '—'}</span>
                  </button>
                  <button type="button" onClick={() => { const next = todayLog.dayOff === null ? 'partial' : todayLog.dayOff === 'partial' ? 'full' : null; saveHabit({ dayOff: next }) }} className={`flex flex-col items-center justify-center text-center p-3 rounded-lg border-2 transition-all min-h-[72px] ${todayLog.dayOff ? 'bg-sky-50 border-sky-500 text-sky-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                    <span className="text-lg">{todayLog.dayOff === 'full' ? '💤' : todayLog.dayOff === 'partial' ? '⏳' : '📅'}</span>
                    <span className="text-xs font-medium">Выходной</span>
                    <span className="text-[10px] text-gray-500">{todayLog.dayOff === 'full' ? 'Полный' : todayLog.dayOff === 'partial' ? 'Частичный' : '—'}</span>
                  </button>
                  <button type="button" onClick={() => saveHabit({ junkFood: todayLog.junkFood === null ? true : !todayLog.junkFood })} className={`flex flex-col items-center justify-center text-center p-3 rounded-lg border-2 transition-all min-h-[72px] ${todayLog.junkFood === true ? 'bg-green-50 border-green-500 text-green-700' : todayLog.junkFood === false ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                    <span className="text-lg">🍔</span>
                    <span className="text-xs font-medium">Без вредной еды</span>
                    <span className="text-[10px] text-gray-500">{todayLog.junkFood === true ? '✅' : todayLog.junkFood === false ? 'Была' : '—'}</span>
                  </button>
                  <button type="button" onClick={() => saveHabit({ gamesDone: !todayLog.gamesDone })} className={`flex flex-col items-center justify-center text-center p-3 rounded-lg border-2 transition-all min-h-[72px] ${todayLog.gamesDone ? 'bg-gray-100 border-gray-600 text-gray-800' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                    <span className="text-lg">🎮</span>
                    <span className="text-xs font-medium">Игры</span>
                    <span className="text-[10px] text-gray-500">{todayLog.gamesDone ? '✅' : '—'}</span>
                  </button>
                  <button type="button" onClick={() => saveHabit({ contentWritingDone: !todayLog.contentWritingDone })} className={`flex flex-col items-center justify-center text-center p-3 rounded-lg border-2 transition-all min-h-[72px] ${todayLog.contentWritingDone ? 'bg-gray-100 border-gray-600 text-gray-800' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                    <span className="text-lg">✍️</span>
                    <span className="text-xs font-medium">Контент</span>
                    <span className="text-[10px] text-gray-500">{todayLog.contentWritingDone ? '✅' : '—'}</span>
                  </button>
                  <button type="button" onClick={async () => { const weekKey = getWeekKey(new Date()); try { const res = await fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=social_week`, { cache: 'no-store' }); const data = await res.json(); let slots = Array.isArray(data?.slots) ? data.slots : Array(2).fill(null); const lastFilled = slots.findLastIndex((s: boolean) => s === true); if (lastFilled !== -1) { slots[lastFilled] = null; setSocialDone(false) } else { const firstEmpty = slots.findIndex((s: boolean) => s === null || s === false); if (firstEmpty !== -1) { slots[firstEmpty] = true; setSocialDone(true) } }; await fetch('/api/tracker/slot-progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periodKey: weekKey, metricKey: 'social_week', slots }) }) } catch (e) { console.error(e) } }} className={`flex flex-col items-center justify-center text-center p-3 rounded-lg border-2 transition-all min-h-[72px] ${socialDone ? 'bg-green-50 border-green-500 text-green-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                    <span className="text-lg">🎉</span>
                    <span className="text-xs font-medium">Соц выход</span>
                    <span className="text-[10px] text-gray-500">{socialDone ? '✅' : '—'}</span>
                  </button>
                  <button type="button" onClick={async () => { const weekKey = getWeekKey(new Date()); const dayIndex = (() => { const d = new Date(); return d.getDay() === 0 ? 6 : d.getDay() - 1 })(); try { const res = await fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=reels_week`, { cache: 'no-store' }); const data = await res.json(); let slots = Array.isArray(data?.slots) ? data.slots : Array(7).fill(null); if (dayIndex < slots.length) { slots[dayIndex] = slots[dayIndex] === true ? null : true; setTodayLog(prev => prev ? { ...prev, reels: slots[dayIndex] === true } : null); await fetch('/api/tracker/slot-progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periodKey: weekKey, metricKey: 'reels_week', slots }) }); const today = getDateString(new Date()); await fetch('/api/tracker/daily-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, reels: slots[dayIndex] === true }) }) } } catch (e) { console.error(e) } }} className={`flex flex-col items-center justify-center text-center p-3 rounded-lg border-2 transition-all min-h-[72px] ${todayLog.reels ? 'bg-pink-50 border-pink-500 text-pink-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                    <span className="text-lg">📹</span>
                    <span className="text-xs font-medium">Рилс</span>
                    <span className="text-[10px] text-gray-500">{todayLog.reels ? '✅' : '—'}</span>
                  </button>
                  {customHabits.filter(h => h.type === 'weekly' && !h.isMain).map((h) => {
                    const dayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
                    const slots = customHabitSlots[h.id] ?? Array(7).fill(null)
                    const done = slots[dayIndex] === true
                    return (
                      <button key={h.id} type="button" onClick={async () => { const weekKey = getWeekKey(new Date()); const current = customHabitSlots[h.id] ?? Array(7).fill(null); const next = current.slice(0, 7); while (next.length < 7) next.push(null); next[dayIndex] = next[dayIndex] === true ? null : true; setCustomHabitSlots(prev => ({ ...prev, [h.id]: next })); try { await fetch('/api/tracker/slot-progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periodKey: weekKey, metricKey: `habit_${h.id}`, slots: next }) }) } catch (e) { console.error(e) } }} className={`flex flex-col items-center justify-center text-center p-3 rounded-lg border-2 transition-all min-h-[72px] ${done ? 'bg-sky-50 border-sky-500 text-sky-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                        <span className="text-lg">✓</span>
                        <span className="text-xs font-medium truncate w-full px-0.5">{h.name}</span>
                        <span className="text-[10px] text-gray-500">{done ? '✅' : '—'}</span>
                      </button>
                    )
                  })}
                </div>
                <Link href="/tracker" className="inline-block mt-2 text-xs text-violet-600 hover:text-violet-800">Открыть трекер →</Link>
              </div>
            )}
          </div>
        </div>

        {/* 2. Задачи на сегодня — компактно: стрелки день, круговой прогресс, задачи по приоритетам, клиенты дожать */}
        {(() => {
          const displayMonday = dashboardWeekMonday ?? getCurrentWeekMonday()
          const displayDay = new Date(displayMonday)
          displayDay.setDate(displayMonday.getDate() + topRowDayOffset)
          const dayKey = getDateString(displayDay)
          const dayTasks = weekTasks[dayKey] ?? overflowDayTasks[dayKey] ?? []
          const dayCalls = weekCalls[dayKey] ?? overflowDayCalls[dayKey] ?? []
          const totalTasks = dayTasks.length
          const completedTasks = dayTasks.filter((t: DailyTask) => t.completed).length
          const pct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0
          const mainTasks = dayTasks.filter((t: DailyTask) => (t.priority || 'movable') === 'main')
          const importantTasks = dayTasks.filter((t: DailyTask) => (t.priority || 'movable') === 'important')
          const movableTasks = dayTasks.filter((t: DailyTask) => (t.priority || 'movable') === 'movable')
          const dayLabel = displayDay.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
          return (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden flex flex-col">
          <div className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50/50">
            <h2 className="text-lg font-bold text-gray-900">Задачи на сегодня</h2>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setTopRowDayOffset((o) => o - 1)} className="p-1 rounded text-gray-500 hover:bg-blue-100 hover:text-blue-600" title="Предыдущий день"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                <span className="text-sm font-medium text-gray-700 min-w-[72px] text-center">{dayLabel}</span>
                <button type="button" onClick={() => setTopRowDayOffset((o) => o + 1)} className="p-1 rounded text-gray-500 hover:bg-blue-100 hover:text-blue-600" title="Следующий день"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center" title={`${completedTasks}/${totalTasks}`}>
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-blue-700">{totalTasks ? pct : 0}%</span>
                </div>
                <span className="text-xs text-gray-500 tabular-nums">{completedTasks}/{totalTasks}</span>
              </div>
            </div>
          </div>
          <div className="px-4 pb-3 flex-1 min-h-0">
            {dayTasks.length === 0 && dayCalls.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-3">Нет задач на этот день</p>
            ) : (
              <div className="space-y-3 pt-2">
                {mainTasks.map((task) => (
                  <div key={task.id} onClick={() => handleViewTask(task)} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${task.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-red-50 border-red-200 hover:bg-red-100'}`}>
                    <input type="checkbox" checked={task.completed} onChange={(e) => { e.stopPropagation(); handleDailyTaskToggle(task) }} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-gray-300 text-red-600 shrink-0" />
                    <span className={`text-sm truncate flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>{task.title}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveTaskToNextDay(task, dayKey) }} className="p-1 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 shrink-0" title="Перенести на завтра"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
                  </div>
                ))}
                {importantTasks.map((task) => (
                  <div key={task.id} onClick={() => handleViewTask(task)} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${task.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'}`}>
                    <input type="checkbox" checked={task.completed} onChange={(e) => { e.stopPropagation(); handleDailyTaskToggle(task) }} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-gray-300 text-amber-600 shrink-0" />
                    <span className={`text-sm truncate flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveTaskToNextDay(task, dayKey) }} className="p-1 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 shrink-0" title="Перенести на завтра"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
                  </div>
                ))}
                {movableTasks.map((task) => (
                  <div key={task.id} onClick={() => handleViewTask(task)} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${task.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                    <input type="checkbox" checked={task.completed} onChange={(e) => { e.stopPropagation(); handleDailyTaskToggle(task) }} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-gray-300 text-gray-600 shrink-0" />
                    <span className={`text-sm truncate flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.title}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveTaskToNextDay(task, dayKey) }} className="p-1 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 shrink-0" title="Перенести на завтра"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
                  </div>
                ))}
                {leadsToContact.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Клиенты дожать</div>
                    <div className="space-y-1.5">
                      {leadsToContact.slice(0, 3).map((lead) => (
                        <div key={lead.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200">
                          <span className="text-sm font-medium text-gray-900 truncate flex-1">{lead.contact}</span>
                          <Link href="/agency/leads" className="text-xs text-blue-600 hover:text-blue-800 shrink-0 ml-1">→</Link>
                        </div>
                      ))}
                      {leadsToContact.length > 3 && <div className="text-xs text-gray-500">+{leadsToContact.length - 3}</div>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
          )
        })()}

        {/* 3. Цели недели */}
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden flex flex-col">
          <div className="border-l-4 border-amber-500 pl-4 py-3 bg-amber-50/50">
            <h2 className="text-lg font-bold text-gray-900">Цели недели</h2>
            {planningGoals.week.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <div className="flex-1 min-w-0 h-2 rounded-full bg-amber-100 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(planningGoals.week.filter(g => g.completed).length / planningGoals.week.length) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-amber-700 tabular-nums shrink-0">{planningGoals.week.filter(g => g.completed).length}/{planningGoals.week.length}</span>
              </div>
            )}
          </div>
          <div className="px-4 pb-3 flex-1 min-h-0">
            {planningGoals.week.length > 0 ? (
              <div className="space-y-3 pt-2">
                {planningGoals.week.map((goal) => (
                  <div key={goal.id} onClick={() => setSelectedPriority(goal)} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${goal.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'}`}>
                    <input type="checkbox" checked={goal.completed} onChange={(e) => { e.stopPropagation(); handlePriorityToggle(String(goal.id), !goal.completed) }} className="w-5 h-5 rounded-sm border-2 border-gray-300 text-amber-600 shrink-0 checked:bg-amber-500 checked:border-amber-500" />
                    <span className={`text-sm truncate flex-1 ${goal.completed ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>{goal.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic py-3">Нет целей</p>
            )}
          </div>
          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={newWeekGoalTitle}
              onChange={(e) => setNewWeekGoalTitle(e.target.value)}
              placeholder="Добавить цель..."
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              onKeyDown={async (e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const ok = await handleAddChecklistGoal('week', newWeekGoalTitle)
                if (ok) setNewWeekGoalTitle('')
              }}
            />
            <button
              type="button"
              onClick={async () => {
                const ok = await handleAddChecklistGoal('week', newWeekGoalTitle)
                if (ok) setNewWeekGoalTitle('')
              }}
              className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shrink-0"
            >+</button>
          </div>
        </div>

        {/* 4. Цели месяца */}
        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden flex flex-col">
          <div className="border-l-4 border-emerald-500 pl-4 py-3 bg-emerald-50/50">
            <h2 className="text-lg font-bold text-gray-900">Цели месяца</h2>
            {planningGoals.month.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <div className="flex-1 min-w-0 h-2 rounded-full bg-emerald-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(planningGoals.month.filter(g => g.completed).length / planningGoals.month.length) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-emerald-700 tabular-nums shrink-0">{planningGoals.month.filter(g => g.completed).length}/{planningGoals.month.length}</span>
              </div>
            )}
          </div>
          <div className="px-4 pb-3 flex-1 min-h-0">
            {planningGoals.month.length > 0 ? (
              <div className="space-y-3 pt-2">
                {planningGoals.month.map((goal) => (
                  <div key={goal.id} onClick={() => setSelectedPriority(goal)} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${goal.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'}`}>
                    <input type="checkbox" checked={goal.completed} onChange={(e) => { e.stopPropagation(); handlePriorityToggle(String(goal.id), !goal.completed) }} className="w-5 h-5 rounded-sm border-2 border-gray-300 text-emerald-600 shrink-0 checked:bg-emerald-500 checked:border-emerald-500" />
                    <span className={`text-sm truncate flex-1 ${goal.completed ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>{goal.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic py-3">Нет целей</p>
            )}
          </div>
          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={newMonthGoalTitle}
              onChange={(e) => setNewMonthGoalTitle(e.target.value)}
              placeholder="Добавить цель..."
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              onKeyDown={async (e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const ok = await handleAddChecklistGoal('month', newMonthGoalTitle)
                if (ok) setNewMonthGoalTitle('')
              }}
            />
            <button
              type="button"
              onClick={async () => {
                const ok = await handleAddChecklistGoal('month', newMonthGoalTitle)
                if (ok) setNewMonthGoalTitle('')
              }}
              className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0"
            >+</button>
        </div>
      </div>
      </div>

      {/* Цели квартала (слева) + Финансы (справа) */}
      <div className="mt-4 mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden flex flex-col">
          <div className="border-l-4 border-purple-500 pl-4 py-3 bg-purple-50/50">
            <h2 className="text-lg font-bold text-gray-900">Цели квартала</h2>
            {planningGoals.quarter.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <div className="flex-1 min-w-0 h-2 rounded-full bg-purple-100 overflow-hidden">
                  <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${(planningGoals.quarter.filter(g => g.completed).length / planningGoals.quarter.length) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-purple-700 tabular-nums shrink-0">{planningGoals.quarter.filter(g => g.completed).length}/{planningGoals.quarter.length}</span>
              </div>
            )}
          </div>
          <div className="px-4 pb-3 flex-1 min-h-0">
            {planningGoals.quarter.length > 0 ? (
              <div className="space-y-3 pt-2">
                {planningGoals.quarter.map((goal) => (
                  <div key={goal.id} onClick={() => setSelectedPriority(goal)} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${goal.completed ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-purple-50 border-purple-200 hover:bg-purple-100'}`}>
                    <input type="checkbox" checked={goal.completed} onChange={(e) => { e.stopPropagation(); handlePriorityToggle(String(goal.id), !goal.completed) }} className="w-5 h-5 rounded-sm border-2 border-gray-300 text-purple-600 shrink-0 checked:bg-purple-500 checked:border-purple-500" />
                    <span className={`text-sm truncate flex-1 ${goal.completed ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>{goal.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic py-3">Нет целей</p>
            )}
          </div>
          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={newQuarterGoalTitle}
              onChange={(e) => setNewQuarterGoalTitle(e.target.value)}
              placeholder="Добавить цель..."
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              onKeyDown={async (e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const ok = await handleAddChecklistGoal('quarter', newQuarterGoalTitle)
                if (ok) setNewQuarterGoalTitle('')
              }}
            />
            <button
              type="button"
              onClick={async () => {
                const ok = await handleAddChecklistGoal('quarter', newQuarterGoalTitle)
                if (ok) setNewQuarterGoalTitle('')
              }}
              className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center font-bold shrink-0"
            >+</button>
          </div>
        </div>

        {/* Правая плашка: финансы */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Финансы</h2>
            <Link href="/me/finance" className="text-sm px-3 py-1.5 rounded-md border border-blue-600 text-blue-600 hover:bg-blue-50">
              Открыть финансы
            </Link>
          </div>

          {/* Цель «Капитал» (авто из «доступно сейчас») + остальные финансовые цели */}
          {(() => {
            const capitalTarget = 600000
            const capitalCurrent = metrics.availableNow ?? 0
            const capitalGoal = {
              id: 'capital',
              name: 'Капитал',
              targetAmount: capitalTarget,
              currentAmount: capitalCurrent,
              period: 'month',
              deadline: null as string | null,
              linkedAccountBalance: null as number | null,
            }
            const goalsToShow = [capitalGoal, ...allGoals].slice(0, 3)
            return (
              <div className="space-y-4">
                {goalsToShow.map((goal) => {
                  const progress = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0
                  return (
                    <div key={goal.id} className="bg-white rounded-xl border border-blue-200 shadow-sm p-5">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold text-gray-900">{goal.name}</span>
                        <span className="text-sm text-gray-500">
                          {goal.currentAmount.toLocaleString('ru-RU')} / {goal.targetAmount.toLocaleString('ru-RU')} ₽
                          <span className="ml-1.5 font-medium text-blue-600">({progress.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-4 rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>
      </>
        )
      })()}

      {/* Белок сегодня (изолированный виджет) */}
      {nutritionSummary && (
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Белок сегодня
              </div>
              <div className="mt-1 text-sm text-gray-800">
                {nutritionSummary.proteinTotal.toFixed(0)} /{' '}
                {nutritionSummary.proteinTarget.toFixed(0)} г белка
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Осталось примерно {nutritionSummary.remaining.toFixed(0)} г
              </div>
            </div>
            <div className="flex-1 md:max-w-md">
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${
                    nutritionSummary.percent >= 100 ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${nutritionSummary.percent}%` }}
                />
              </div>
              {nutritionSummary.logs.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  Последние:{' '}
                  {nutritionSummary.logs.slice(0, 3).map((log, idx) => {
                    const time = new Date(log.createdAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    return (
                      <span key={log.id}>
                        {idx > 0 && '; '}
                        {time}: +{log.protein.toFixed(0)} г
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <div>
              <a
                href="/me/nutrition"
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                Открыть питание
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Цели на 2026 и Стратегия 2026 — два столбца */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Цели на 2026 — крупные плашки как в Стратегии, с приоритетом и описанием */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Цели на 2026</h2>
            <Link href="/me/planning-goals?tab=year" className="text-sm text-blue-600 hover:text-blue-800">
              Планирование →
            </Link>
          </div>
          {planningGoals.year.length > 0 ? (
            <>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                <span>Выполнено {planningGoals.year.filter(g => g.completed).length} из {planningGoals.year.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all"
                  style={{ width: `${planningGoals.year.length ? (planningGoals.year.filter(g => g.completed).length / planningGoals.year.length) * 100 : 0}%` }}
                />
              </div>
              <div className="space-y-4">
                {[...planningGoals.year]
                  .sort((a, b) => {
                    const order = { high: 0, medium: 1, low: 2 }
                    const pa = (a.priority || 'medium') as GoalPriority
                    const pb = (b.priority || 'medium') as GoalPriority
                    return (order[pa] ?? 1) - (order[pb] ?? 1)
                  })
                  .map((goal) => {
                  const priority = (goal.priority || 'medium') as GoalPriority
                  const priorityStyles: Record<GoalPriority, { bg: string; border: string; accent: string }> = {
                    high: { bg: 'bg-emerald-50', border: 'border-emerald-500', accent: 'text-emerald-700' },
                    medium: { bg: 'bg-indigo-50', border: 'border-indigo-500', accent: 'text-indigo-700' },
                    low: { bg: 'bg-gray-100', border: 'border-gray-400', accent: 'text-gray-700' },
                  }
                  const style = priorityStyles[priority] ?? priorityStyles.medium
                  const description = (goal as any).notes ?? goal.description ?? ''
                  return (
                    <div
                      key={String(goal.id)}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return
                        setSelectedPriority(goal)
                      }}
                      className={`rounded-lg border-l-4 ${style.bg} ${style.border} p-4 cursor-pointer transition-colors hover:opacity-95 ${
                        goal.completed ? 'opacity-75' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={goal.completed}
                          onChange={() => handlePriorityToggle(String(goal.id), !goal.completed)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 mt-0.5 text-blue-600 rounded cursor-pointer flex-shrink-0"
                          aria-label={`Отметить: ${goal.title}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-gray-900 ${goal.completed ? 'line-through text-gray-500' : ''}`}>
                            {goal.title}
                          </div>
                          {description && (
                            <div className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap">{description}</div>
                          )}
                        </div>
                        {goal.completed && <span className="text-green-600 text-sm flex-shrink-0">✓</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 italic">Нет целей на год</p>
          )}
        </div>

        {/* Стратегия 2026 — карточки по направлениям + не делать */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Стратегия 2026</h2>

          {/* Приоритеты 1–5: крупные карточки с пояснениями */}
          <div className="space-y-4 mb-6">
            {[
              { n: 1, title: 'Агентство', role: 'Финансовый фундамент', do: 'Оптимизирую, делегирую, усиливаю процессы. Никаких резких экспериментов. Повышены цены, новая упаковка. Международка и новые постоянники — аккуратный тест без фокуса на это.', dont: 'Не распыляюсь на новые услуги', bg: 'bg-emerald-50', border: 'border-emerald-500', accent: 'text-emerald-700' },
              { n: 1, title: 'Медиа (личный бренд)', role: 'Входящий поток людей', do: 'Говорю о пути, выборе, решениях. Нативно показываю связь жизни и работы', dont: 'Не прогреваю, не убеждаю', bg: 'bg-emerald-50', border: 'border-emerald-500', accent: 'text-emerald-700' },
              { n: 2, title: 'Tripwire', role: 'Монетизация внимания + мост', do: 'Короткий продукт «облегчение → завершение». Один формат, один вход', dont: 'Не усложняю, не расширяю', bg: 'bg-indigo-50', border: 'border-indigo-500', accent: 'text-indigo-700' },
              { n: 2, title: 'Курс по дизайну', role: 'Закрытие цикла + доход', do: 'Evergreen. Редкие персональные приглашения, без запусков', dont: 'Не переписываю контент', bg: 'bg-indigo-50', border: 'border-indigo-500', accent: 'text-indigo-700' },
              { n: 3, title: 'Deizy → агентство', role: 'Рост эффективности', do: 'Внедряю как инструмент, а не как отдельный бизнес', dont: 'Не делаю из этого продукт', bg: 'bg-violet-50', border: 'border-violet-500', accent: 'text-violet-700' },
              { n: 4, title: 'IP-вселенная', role: 'Будущее', do: 'Идеи, заметки, контуры. Без реализации', dont: 'Не строю сейчас', bg: 'bg-gray-100', border: 'border-gray-400', accent: 'text-gray-700', pause: true },
              { n: 5, title: 'Картины', role: 'Личное / фон', do: 'Творчество без плана продаж', dont: 'Не привязываю к деньгам', bg: 'bg-gray-100', border: 'border-gray-400', accent: 'text-gray-700', pause: true },
            ].map((item, idx) => (
              <div key={idx} className={`rounded-lg border-l-4 ${item.bg} ${item.border} p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`font-bold ${item.accent}`}>{item.n}</span>
                  <span className="font-semibold text-gray-900">{item.title}</span>
                  {item.pause && <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">на паузе</span>}
                </div>
                <div className="text-xs text-gray-500 mb-1.5">{item.role}</div>
                <div className="text-sm text-gray-800 mb-1"><span className="text-green-700 font-medium">Делаю:</span> {item.do}</div>
                <div className="text-sm text-gray-700"><span className="text-red-700 font-medium">Не делаю:</span> {item.dont}</div>
              </div>
            ))}
          </div>

          {/* Не делать — отдельный блок (Exis, клуб, книга) */}
          <div className="border-t border-red-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-red-600 font-semibold">Не делать</span>
            </div>
            <div className="space-y-3">
              {[
                { title: 'Exis', role: 'Хвост', do: 'Закрываю, не возвращаюсь', dont: 'Не рефлексирую' },
                { title: 'Закрытый клуб', role: 'Потенциал', do: 'Не запускать без аудитории', dont: 'Не «пробовать»' },
                { title: 'Книга', role: 'Отложено', do: 'Только заметки', dont: 'Не писать полноценно' },
              ].map((item, idx) => (
                <div key={idx} className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="font-semibold text-red-800">{item.title}</div>
                  <div className="text-xs text-red-600/80 mb-1">{item.role}</div>
                  <div className="text-sm text-gray-700"><span className="text-green-700">Делаю:</span> {item.do}</div>
                  <div className="text-sm text-gray-700"><span className="text-red-700">Не делаю:</span> {item.dont}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Priority Modal */}
      <PriorityModal 
        goal={selectedPriority}
        onClose={() => setSelectedPriority(null)}
        onToggle={handlePriorityToggle}
      />

      {/* Task Description Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedTask(null)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{selectedTask.title}</h3>
              <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Описание задачи
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Добавьте описание задачи..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={6}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedTask.completed}
                  onChange={() => handleDailyTaskToggle(selectedTask)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label className="text-sm text-gray-700">
                  {selectedTask.completed ? 'Выполнено' : 'Не выполнено'}
                </label>
              </div>
              <button
                onClick={handleSaveTaskDescription}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
