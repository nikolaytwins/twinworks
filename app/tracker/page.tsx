'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface DailyLog {
  date: string
  dayMode: 'strong' | 'light' | 'rest' | null
  stepsDone: boolean
  proteinDone: boolean
  sleepDone: boolean
  workoutType: 'gym' | 'home' | 'none' | null
  alcohol: boolean
  dayOff: 'none' | 'partial' | 'full' | null
  junkFood: boolean
  reels: boolean
  gamesDone: boolean
  contentWritingDone: boolean
}

interface SlotProgress {
  periodKey: string
  metricKey: string
  slots: (boolean | string | null)[]
}

interface ZoneWarning {
  warnings: string[]
}

import {
  getWeekKey,
  getMonthKey,
  getQuarterKey,
  getTodayDateString,
  getDateString,
  getWeeksInMonth,
  getDaysInMonth,
  getDayOfWeek,
  getWeekLabel,
  getCalendarGridDates,
  getDayIndex,
  getYearFebDecDates,
  getDaysInYearFebDec,
  getYearFebDecMonthBoundaries
} from './utils'

const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const monthNamesShort = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const monthLabelsShort = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function getDayOfWeekLabels(): string[] {
  return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
}

function CircularProgress({
  pct,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  color = 'rgb(99 102 241)',
  bgColor = 'rgb(229 231 235)',
  hideInnerText = false,
}: {
  pct: number
  size?: number
  strokeWidth?: number
  label: string
  sublabel?: string
  color?: string
  bgColor?: string
  hideInnerText?: boolean
}) {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const dash = (pct / 100) * circumference
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={bgColor}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        {!hideInnerText && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-bold text-gray-900 tabular-nums ${size <= 50 ? 'text-[10px]' : 'text-xl'}`}>
              {Math.round(pct)}%
            </span>
          </div>
        )}
      </div>
      {label && (
        <div className="mt-2 text-center">
          <div className="text-sm font-semibold text-gray-800 leading-tight">{label}</div>
          {sublabel && <div className="text-xs text-gray-500 mt-0.5">{sublabel}</div>}
        </div>
      )}
    </div>
  )
}

export default function TrackerPage() {
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null)
  const [zones, setZones] = useState<ZoneWarning | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Выбранный месяц для просмотра истории
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date())
  
  // Логи за месяц для календаря
  const [monthLogs, setMonthLogs] = useState<DailyLog[]>([])
  
  // Год для heatmap за год (Фев–Дек)
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())
  const [yearLogs, setYearLogs] = useState<DailyLog[]>([])
  const [fullYearLogs, setFullYearLogs] = useState<DailyLog[]>([])
  const [yearSlotData, setYearSlotData] = useState<{ byWeek: Record<string, Record<string, (boolean | null)[]>> }>({ byWeek: {} })
  
  // Модалка для выбора тренировки
  const [workoutModalDate, setWorkoutModalDate] = useState<string | null>(null)
  // Редактирование дня из календаря (только 6 привычек)
  const [calendarEditDate, setCalendarEditDate] = useState<string | null>(null)
  // Раскрывающиеся блоки
  const [showByMonthStats, setShowByMonthStats] = useState(false)
  const [showZones, setShowZones] = useState(false)
  const [showDayMode, setShowDayMode] = useState(false)
  
  // Табы для фильтрации календаря (включая пользовательские: habit_<id>)
  const [activeTab, setActiveTab] = useState<string>('steps')
  const [showAll, setShowAll] = useState(false)
  
  // Пользовательские привычки (созданные в /me/habits)
  type CustomHabit = { id: string; name: string; type: string; slotsCount: number; order: number; isMain: boolean }
  const [customHabits, setCustomHabits] = useState<CustomHabit[]>([])
  const [customHabitWeeks, setCustomHabitWeeks] = useState<Record<string, Record<string, (boolean | null)[]>>>({})
  
  // Слоты для разных метрик
  const [youtubeSlots, setYoutubeSlots] = useState<(boolean | null)[]>([])
  // Недельные метрики - теперь храним по неделям месяца
  const [reelsWeeks, setReelsWeeks] = useState<Record<string, (boolean | null)[]>>({})
  const [tgWeeks, setTgWeeks] = useState<Record<string, (boolean | null)[]>>({})
  const [threadsWeeks, setThreadsWeeks] = useState<Record<string, (boolean | null)[]>>({})
  const [workoutWeeks, setWorkoutWeeks] = useState<Record<string, ('gym' | 'home' | null)[]>>({})
  const [socialWeeks, setSocialWeeks] = useState<Record<string, (boolean | null)[]>>({})
  const [clientSearchWeeks, setClientSearchWeeks] = useState<Record<string, (boolean | null)[]>>({})
  const [profiWeeks, setProfiWeeks] = useState<Record<string, (boolean | null)[]>>({})
  const [tripSlot, setTripSlot] = useState<(boolean | null)[]>([])

  // Статистика привычек (круговые прогресс-бары)
  type HabitStat = { key: string; name: string; completed: number; max: number; pct: number }
  type MonthStat = { month: string; completed: number; max: number; pct: number }
  const [monthStats, setMonthStats] = useState<{ overallPct: number; byHabit: HabitStat[] } | null>(null)
  const [yearStats, setYearStats] = useState<{ overallPct: number; byHabit: HabitStat[] } | null>(null)
  const [yearByMonthStats, setYearByMonthStats] = useState<{ key: string; name: string; months: MonthStat[] }[] | null>(null)

  useEffect(() => {
    fetchData()
  }, [selectedMonth])

  // Загрузка данных за год (Фев–Дек) для heatmap и полный год (Янв–Дек) для календаря кружочков
  useEffect(() => {
    const startDateFeb = `${selectedYear}-02-01`
    const endDate = `${selectedYear}-12-31`
    const startDateFull = `${selectedYear}-01-01`
    Promise.all([
      fetch(`/api/tracker/daily-log?startDate=${startDateFeb}&endDate=${endDate}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/tracker/daily-log?startDate=${startDateFull}&endDate=${endDate}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/tracker/slot-progress?year=${selectedYear}`, { cache: 'no-store' }).then(r => r.json()),
    ]).then(([logsResFeb, logsResFull, slotsRes]) => {
      const logsListFeb = Array.isArray(logsResFeb) ? logsResFeb : []
      const logsMapFeb = new Map<string, DailyLog>()
      logsListFeb.forEach((log: any) => {
        logsMapFeb.set(log.date, {
          date: log.date,
          dayMode: log.dayMode,
          stepsDone: Boolean(log.stepsDone),
          proteinDone: Boolean(log.proteinDone),
          sleepDone: Boolean(log.sleepDone),
          workoutType: log.workoutType,
          alcohol: Boolean(log.alcohol),
          dayOff: log.dayOff || null,
          junkFood: Boolean(log.junkFood),
          reels: Boolean(log.reels),
          gamesDone: Boolean(log.gamesDone),
          contentWritingDone: Boolean(log.contentWritingDone)
        })
      })
      setYearLogs(Array.from(logsMapFeb.values()))
      const logsListFull = Array.isArray(logsResFull) ? logsResFull : []
      const logsMapFull = new Map<string, DailyLog>()
      logsListFull.forEach((log: any) => {
        logsMapFull.set(log.date, {
          date: log.date,
          dayMode: log.dayMode,
          stepsDone: Boolean(log.stepsDone),
          proteinDone: Boolean(log.proteinDone),
          sleepDone: Boolean(log.sleepDone),
          workoutType: log.workoutType,
          alcohol: Boolean(log.alcohol),
          dayOff: log.dayOff || null,
          junkFood: Boolean(log.junkFood),
          reels: Boolean(log.reels),
          gamesDone: Boolean(log.gamesDone),
          contentWritingDone: Boolean(log.contentWritingDone)
        })
      })
      setFullYearLogs(Array.from(logsMapFull.values()))
      const byWeek = (slotsRes?.byWeek ?? {}) as Record<string, Record<string, (boolean | null)[]>>
      Object.keys(byWeek).forEach(wk => {
        Object.keys(byWeek[wk]).forEach(mk => {
          const arr = byWeek[wk][mk]
          if (!Array.isArray(arr)) byWeek[wk][mk] = []
        })
      })
      setYearSlotData({ byWeek })
    }).catch(e => {
      console.error('Year data fetch failed:', e)
      setYearLogs([])
      setFullYearLogs([])
      setYearSlotData({ byWeek: {} })
    })
  }, [selectedYear])

  const refetchYearData = () => {
    const startDateFeb = `${selectedYear}-02-01`
    const endDate = `${selectedYear}-12-31`
    const startDateFull = `${selectedYear}-01-01`
    Promise.all([
      fetch(`/api/tracker/daily-log?startDate=${startDateFeb}&endDate=${endDate}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/tracker/daily-log?startDate=${startDateFull}&endDate=${endDate}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/tracker/slot-progress?year=${selectedYear}`, { cache: 'no-store' }).then(r => r.json()),
    ]).then(([logsResFeb, logsResFull, slotsRes]) => {
      const toLog = (list: any[]) => {
        const map = new Map<string, DailyLog>()
        ;(Array.isArray(list) ? list : []).forEach((log: any) => {
          map.set(log.date, {
            date: log.date,
            dayMode: log.dayMode,
            stepsDone: Boolean(log.stepsDone),
            proteinDone: Boolean(log.proteinDone),
            sleepDone: Boolean(log.sleepDone),
            workoutType: log.workoutType,
            alcohol: Boolean(log.alcohol),
            dayOff: log.dayOff || null,
            junkFood: Boolean(log.junkFood),
            reels: Boolean(log.reels),
            gamesDone: Boolean(log.gamesDone),
            contentWritingDone: Boolean(log.contentWritingDone)
          })
        })
        return Array.from(map.values())
      }
      setYearLogs(toLog(logsResFeb))
      setFullYearLogs(toLog(logsResFull))
      const byWeek = (slotsRes?.byWeek ?? {}) as Record<string, Record<string, (boolean | null)[]>>
      setYearSlotData({ byWeek })
    }).catch(() => {})
  }

  // Рефетч при возврате на вкладку (чтобы отметки с дашборда подтянулись)
  useEffect(() => {
    const onFocus = () => {
      fetchData()
      const startDate = `${selectedYear}-02-01`
      const endDate = `${selectedYear}-12-31`
      Promise.all([
        fetch(`/api/tracker/daily-log?startDate=${startDate}&endDate=${endDate}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/tracker/slot-progress?year=${selectedYear}`, { cache: 'no-store' }).then(r => r.json()),
      ]).then(([logsRes, slotsRes]) => {
        const logsList = Array.isArray(logsRes) ? logsRes : []
        const logsMap = new Map<string, DailyLog>()
        logsList.forEach((log: any) => {
          logsMap.set(log.date, {
            date: log.date,
            dayMode: log.dayMode,
            stepsDone: Boolean(log.stepsDone),
            proteinDone: Boolean(log.proteinDone),
            sleepDone: Boolean(log.sleepDone),
            workoutType: log.workoutType,
            alcohol: Boolean(log.alcohol),
            dayOff: log.dayOff || null,
            junkFood: Boolean(log.junkFood),
            reels: Boolean(log.reels),
            gamesDone: Boolean(log.gamesDone),
            contentWritingDone: Boolean(log.contentWritingDone)
          })
        })
        setYearLogs(Array.from(logsMap.values()))
        const byWeek = (slotsRes?.byWeek ?? {}) as Record<string, Record<string, (boolean | null)[]>>
        setYearSlotData({ byWeek })
      }).catch(() => {})
    }
    const onVisibility = () => { if (!document.hidden) onFocus() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    const y = selectedMonth.getFullYear()
    const m = selectedMonth.getMonth() + 1
    const monthKey = `${y}-${String(m).padStart(2, '0')}`
    Promise.all([
      fetch(`/api/tracker/habit-stats?month=${monthKey}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      fetch(`/api/tracker/habit-stats?year=${y}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      fetch(`/api/tracker/habit-stats?year=${y}&byMonth=1`, { cache: 'no-store' }).then(r => r.json()).catch(() => null),
    ]).then(([monthData, yearData, yearByMonthData]) => {
      setMonthStats(monthData?.overallPct != null ? { overallPct: monthData.overallPct, byHabit: monthData.byHabit || [] } : null)
      setYearStats(yearData?.overallPct != null ? { overallPct: yearData.overallPct, byHabit: yearData.byHabit || [] } : null)
      setYearByMonthStats(yearByMonthData?.byHabitPerMonth || null)
    })
  }, [selectedMonth])

  const fetchData = async () => {
    try {
      const today = new Date()
      const todayStr = getTodayDateString()
      const selectedYear = selectedMonth.getFullYear()
      const selectedMonthNum = selectedMonth.getMonth() + 1
      const monthKey = getMonthKey(selectedMonth)
      const quarterKey = getQuarterKey(selectedMonth)

      // Загружаем дневной лог за сегодня
      const logRes = await fetch(`/api/tracker/daily-log?date=${todayStr}`, { cache: 'no-store' })
      const logData = await logRes.json()
      if (logData && logData.date) {
        setTodayLog({
          date: logData.date || todayStr,
          dayMode: logData.dayMode,
          stepsDone: Boolean(logData.stepsDone),
          proteinDone: Boolean(logData.proteinDone),
          sleepDone: Boolean(logData.sleepDone),
          workoutType: logData.workoutType,
          alcohol: Boolean(logData.alcohol),
          dayOff: logData.dayOff || null,
          junkFood: Boolean(logData.junkFood),
          reels: Boolean(logData.reels),
          gamesDone: Boolean(logData.gamesDone),
          contentWritingDone: Boolean(logData.contentWritingDone)
        })
      } else {
        setTodayLog({
          date: todayStr,
          dayMode: null,
          stepsDone: false,
          proteinDone: false,
          sleepDone: false,
          workoutType: null,
          alcohol: false,
          dayOff: null,
          junkFood: false,
          reels: false,
          gamesDone: false,
          contentWritingDone: false
        })
      }

      // Загружаем все логи за выбранный месяц для календаря
      const monthStart = new Date(selectedYear, selectedMonthNum - 1, 1)
      const monthEnd = new Date(selectedYear, selectedMonthNum, 0)
      const startDate = getDateString(monthStart)
      const endDate = getDateString(monthEnd)
      
      const monthLogsRes = await fetch(`/api/tracker/daily-log?startDate=${startDate}&endDate=${endDate}`, { cache: 'no-store' })
      const monthLogsData = await monthLogsRes.json()
      const logsMap = new Map<string, DailyLog>()
      if (Array.isArray(monthLogsData)) {
        monthLogsData.forEach((log: any) => {
          logsMap.set(log.date, {
            date: log.date,
            dayMode: log.dayMode,
            stepsDone: Boolean(log.stepsDone),
            proteinDone: Boolean(log.proteinDone),
            sleepDone: Boolean(log.sleepDone),
            workoutType: log.workoutType,
            alcohol: Boolean(log.alcohol),
            dayOff: log.dayOff || null,
            junkFood: Boolean(log.junkFood),
            reels: Boolean(log.reels),
            gamesDone: Boolean(log.gamesDone),
            contentWritingDone: Boolean(log.contentWritingDone)
          })
        })
      }
      setMonthLogs(Array.from(logsMap.values()))

      // Загружаем YouTube (месячный)
      const youtubeRes = await fetch(`/api/tracker/slot-progress?periodKey=${monthKey}&metricKey=youtube_month`, { cache: 'no-store' })
      const youtubeData = await youtubeRes.json()
      setYoutubeSlots(Array.isArray(youtubeData?.slots) ? youtubeData.slots : Array(4).fill(null))

      // Пользовательские привычки (недельные)
      const habitsRes = await fetch('/api/habits', { cache: 'no-store' }).then(r => r.json()).catch(() => [])
      const habitsList = Array.isArray(habitsRes) ? habitsRes : []
      const weeklyHabits = habitsList.filter((h: CustomHabit) => h.type === 'weekly')
      setCustomHabits(habitsList)

      // Загружаем все недели месяца для недельных метрик (+ profi_week для единой «Профи»)
      const weeksInMonth = getWeeksInMonth(selectedYear, selectedMonthNum)
      
      const weekPromises = weeksInMonth.flatMap(weekKey => [
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=reels_week`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=tg_week`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=threads_week`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=profi_week`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=workouts_week`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=social_week`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=client_search_week`, { cache: 'no-store' }).then(r => r.json()),
        ...weeklyHabits.map((h: CustomHabit) =>
          fetch(`/api/tracker/slot-progress?periodKey=${weekKey}&metricKey=habit_${h.id}`, { cache: 'no-store' }).then(r => r.json())
        ),
      ])
      
      const weekResults = await Promise.all(weekPromises)
      let resultIndex = 0
      
      const reelsWeeksData: Record<string, (boolean | null)[]> = {}
      const tgWeeksData: Record<string, (boolean | null)[]> = {}
      const threadsWeeksData: Record<string, (boolean | null)[]> = {}
      const profiWeeksData: Record<string, (boolean | null)[]> = {}
      const workoutWeeksData: Record<string, ('gym' | 'home' | null)[]> = {}
      const socialWeeksData: Record<string, (boolean | null)[]> = {}
      const clientSearchWeeksData: Record<string, (boolean | null)[]> = {}
      const customHabitWeeksData: Record<string, Record<string, (boolean | null)[]>> = {}
      weeklyHabits.forEach((h: CustomHabit) => { customHabitWeeksData[h.id] = {} })
      
      for (const weekKey of weeksInMonth) {
        const reelsData = weekResults[resultIndex++]
        const tgData = weekResults[resultIndex++]
        const threadsData = weekResults[resultIndex++]
        const profiData = weekResults[resultIndex++]
        const workoutData = weekResults[resultIndex++]
        const socialData = weekResults[resultIndex++]
        const clientSearchData = weekResults[resultIndex++]
        
        reelsWeeksData[weekKey] = Array.isArray(reelsData?.slots) ? reelsData.slots : Array(7).fill(null)
        tgWeeksData[weekKey] = Array.isArray(tgData?.slots) ? tgData.slots : Array(7).fill(null)
        threadsWeeksData[weekKey] = Array.isArray(threadsData?.slots) ? threadsData.slots : Array(7).fill(null)
        profiWeeksData[weekKey] = Array.isArray(profiData?.slots) ? profiData.slots : Array(7).fill(null)
        workoutWeeksData[weekKey] = Array.isArray(workoutData?.slots) ? (workoutData.slots as ('gym' | 'home' | null)[]) : Array(3).fill(null)
        socialWeeksData[weekKey] = Array.isArray(socialData?.slots) ? socialData.slots : Array(7).fill(null)
        clientSearchWeeksData[weekKey] = Array.isArray(clientSearchData?.slots) ? clientSearchData.slots : Array(7).fill(null)
        for (const h of weeklyHabits) {
          const habitData = weekResults[resultIndex++]
          customHabitWeeksData[h.id][weekKey] = Array.isArray(habitData?.slots) ? habitData.slots.slice(0, 7) : Array(7).fill(null)
          while (customHabitWeeksData[h.id][weekKey].length < 7) customHabitWeeksData[h.id][weekKey].push(null)
        }
      }
      
      setReelsWeeks(reelsWeeksData)
      setTgWeeks(tgWeeksData)
      setThreadsWeeks(threadsWeeksData)
      setProfiWeeks(profiWeeksData)
      setWorkoutWeeks(workoutWeeksData)
      setSocialWeeks(socialWeeksData)
      setClientSearchWeeks(clientSearchWeeksData)
      setCustomHabitWeeks(customHabitWeeksData)

      // Загружаем поездку (квартальная)
      const tripRes = await fetch(`/api/tracker/slot-progress?periodKey=${quarterKey}&metricKey=trip_quarter`, { cache: 'no-store' })
      const tripData = await tripRes.json()
      setTripSlot(Array.isArray(tripData?.slots) ? tripData.slots : Array(1).fill(null))

      // Загружаем зоны внимания
      try {
        const zonesRes = await fetch('/api/tracker/zones', { cache: 'no-store' })
        const zonesData = await zonesRes.json()
        setZones(zonesData || { warnings: [] })
      } catch (error) {
        console.error('Error fetching zones:', error)
        setZones({ warnings: [] })
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveDailyLog = async (updates: Partial<DailyLog>) => {
    const todayStr = getTodayDateString()
    await saveDailyLogForDate(todayStr, updates)
  }

  const saveDailyLogForDate = async (dateStr: string, updates: Partial<DailyLog>) => {
    const existingLog = monthLogs.find(log => log.date === dateStr) || {
      date: dateStr,
      dayMode: null,
      stepsDone: false,
      proteinDone: false,
      sleepDone: false,
      workoutType: null,
      alcohol: false,
      dayOff: null,
      junkFood: false,
      reels: false,
      gamesDone: false,
      contentWritingDone: false
    }
    
    const updated = { ...existingLog, ...updates, date: dateStr }
    try {
      const res = await fetch('/api/tracker/daily-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      })
      const data = await res.json()
      if (data.success && data.log) {
        const savedLog = {
          date: data.log.date || dateStr,
          dayMode: data.log.dayMode,
          stepsDone: Boolean(data.log.stepsDone),
          proteinDone: Boolean(data.log.proteinDone),
          sleepDone: Boolean(data.log.sleepDone),
          workoutType: data.log.workoutType,
          alcohol: Boolean(data.log.alcohol),
          dayOff: data.log.dayOff || null,
          junkFood: Boolean(data.log.junkFood),
          reels: Boolean(data.log.reels),
          gamesDone: Boolean(data.log.gamesDone),
          contentWritingDone: Boolean(data.log.contentWritingDone)
        }
        
        // Обновляем todayLog если это сегодня
        if (dateStr === getTodayDateString()) {
          setTodayLog(savedLog)
        }
        
        // Обновляем данные для календаря
        fetchData()
        if (dateStr.startsWith(String(selectedYear))) refetchYearData()
      }
    } catch (error) {
      console.error('Error saving daily log:', error)
    }
  }

  const saveSlotProgress = async (metricKey: string, slots: (boolean | string | null)[], periodKey: string) => {
    try {
      const res = await fetch('/api/tracker/slot-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey, metricKey, slots })
      })
      const data = await res.json()
      if (data.success) {
        // Обновляем данные после сохранения
        fetchData()
      }
    } catch (error) {
      console.error('Error saving slot progress:', error)
    }
  }

  const toggleWeekSlot = (
    weekKey: string,
    index: number,
    metricKey: string,
    currentSlots: Record<string, (boolean | null)[]>,
    setSlots: (s: Record<string, (boolean | null)[]>) => void
  ) => {
    const newSlots: Record<string, (boolean | null)[]> = { ...currentSlots }
    if (!newSlots[weekKey]) {
      newSlots[weekKey] = Array(7).fill(null)
    }
    const weekSlots = [...newSlots[weekKey]]
    weekSlots[index] = weekSlots[index] ? null : true
    newSlots[weekKey] = weekSlots
    setSlots(newSlots)
    saveSlotProgress(metricKey, weekSlots, weekKey)
  }

  const toggleCustomHabitSlot = (habitId: string, weekKey: string, index: number) => {
    const byWeek = customHabitWeeks[habitId] || {}
    const weekSlots = [...(byWeek[weekKey] || Array(7).fill(null))]
    while (weekSlots.length < 7) weekSlots.push(null)
    weekSlots[index] = weekSlots[index] ? null : true
    setCustomHabitWeeks(prev => ({
      ...prev,
      [habitId]: { ...(prev[habitId] || {}), [weekKey]: weekSlots },
    }))
    saveSlotProgress(`habit_${habitId}`, weekSlots, weekKey)
  }

  const toggleWeekWorkoutSlot = async (weekKey: string, index: number, currentSlots: Record<string, ('gym' | 'home' | null)[]>, setSlots: (s: Record<string, ('gym' | 'home' | null)[]>) => void) => {
    const newSlots = { ...currentSlots }
    if (!newSlots[weekKey]) {
      newSlots[weekKey] = Array(3).fill(null)
    }
    const weekSlots = [...newSlots[weekKey]]
    // Циклически переключаем: null -> gym -> home -> null
    if (weekSlots[index] === null) {
      weekSlots[index] = 'gym'
    } else if (weekSlots[index] === 'gym') {
      weekSlots[index] = 'home'
    } else {
      weekSlots[index] = null
    }
    newSlots[weekKey] = weekSlots
    setSlots(newSlots)
    await saveSlotProgress('workouts_week', weekSlots, weekKey)
    
    // Если тренировка была отмечена и это текущая неделя, сохраняем в daily_log за сегодня
    const today = new Date()
    const todayWeekKey = getWeekKey(today)
    if (weekKey === todayWeekKey && weekSlots[index] !== null) {
      const todayStr = getTodayDateString()
      await saveDailyLog({ workoutType: weekSlots[index] })
    }
  }

  const toggleMonthSlot = (index: number, metricKey: string, currentSlots: (boolean | null)[], setSlots: (s: (boolean | null)[]) => void) => {
    const newSlots = [...currentSlots]
    newSlots[index] = newSlots[index] ? null : true
    setSlots(newSlots)
    const monthKey = getMonthKey(selectedMonth)
    saveSlotProgress(metricKey, newSlots, monthKey)
  }

  const toggleQuarterSlot = (index: number, metricKey: string, currentSlots: (boolean | null)[], setSlots: (s: (boolean | null)[]) => void) => {
    const newSlots = [...currentSlots]
    newSlots[index] = newSlots[index] ? null : true
    setSlots(newSlots)
    const quarterKey = getQuarterKey(selectedMonth)
    saveSlotProgress(metricKey, newSlots, quarterKey)
  }

  // Получить лог за дату
  const getLogForDate = (date: Date): DailyLog | null => {
    const dateStr = getDateString(date)
    return monthLogs.find(log => log.date === dateStr) || null
  }

  // Проверить наличие недельной метрики в конкретный день
  const hasWeeklyMetric = (date: Date, metricKey: 'reels_week' | 'tg_week' | 'threads_week' | 'social_week'): boolean => {
    const weekKey = getWeekKey(date)
    let slots: (boolean | null)[] = []
    
    if (metricKey === 'reels_week') {
      slots = reelsWeeks[weekKey] || []
      // Для Reels проверяем конкретный день недели
      const dayOfWeek = date.getDay()
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Понедельник = 0, Воскресенье = 6
      return dayIndex < slots.length && slots[dayIndex] === true
    } else if (metricKey === 'tg_week') {
      slots = tgWeeks[weekKey] || []
      // Для TG, Threads, Social - проверяем, есть ли хотя бы один заполненный слот
      // Но это не означает, что событие было в конкретный день
      // Поэтому возвращаем false - недельные метрики не привязаны к конкретному дню
      return false
    } else if (metricKey === 'threads_week') {
      slots = threadsWeeks[weekKey] || []
      return false
    } else if (metricKey === 'social_week') {
      slots = socialWeeks[weekKey] || []
      return false
    }
    
    return false
  }

  // Получить иконку для дня в зависимости от активного таба
  const getDayIcon = (day: Date, log: DailyLog | null): string | null => {
    switch (activeTab) {
      case 'steps':
        return log?.stepsDone ? '👟' : null
      case 'protein':
        return log?.proteinDone ? '🍗' : null
      case 'sleep':
        return log?.sleepDone ? '🌙' : null
      case 'workout':
        if (log?.workoutType === 'gym') return '🏋️'
        if (log?.workoutType === 'home') return '🏋️'
        return null
      case 'reels':
        return hasWeeklyMetric(day, 'reels_week') ? '📹' : null
      case 'telegram':
        // Недельные метрики не привязаны к конкретному дню, поэтому не показываем в календаре
        return null
      case 'threads':
        // Недельные метрики не привязаны к конкретному дню, поэтому не показываем в календаре
        return null
      case 'social':
        // Недельные метрики не привязаны к конкретному дню, поэтому не показываем в календаре
        return null
      case 'clientsearch':
        // Недельные метрики не привязаны к конкретному дню, поэтому не показываем в календаре
        return null
      case 'dayoff':
        if (log?.dayOff === 'full') return '💤'
        if (log?.dayOff === 'partial') return '⏳'
        return null
      case 'alcohol':
        // Инвертированная логика: alcohol=true означает "не было", alcohol=false/null означает "был"
        // Показываем иконку только если был алкоголь (т.е. alcohol === false или null или undefined)
        if (!log) return null
        return !log.alcohol ? '🍷' : null
      case 'games':
        return log?.gamesDone ? '🎮' : null
      case 'content':
        return log?.contentWritingDone ? '✍️' : null
      default:
        if (activeTab.startsWith('habit_')) {
          const habitId = activeTab.replace('habit_', '')
          const weekKey = getWeekKey(day)
          const slots = customHabitWeeks[habitId]?.[weekKey] || []
          const dayIndex = day.getDay() === 0 ? 6 : day.getDay() - 1
          return dayIndex < slots.length && slots[dayIndex] === true ? '✓' : null
        }
        return null
    }
  }

  // Выполнена ли привычка за день для текущего таба (для точки в календаре)
  const isDayDoneForTab = (day: Date, log: DailyLog | null): boolean => {
    switch (activeTab) {
      case 'steps': return Boolean(log?.stepsDone)
      case 'protein': return Boolean(log?.proteinDone)
      case 'sleep': return Boolean(log?.sleepDone)
      case 'workout': return Boolean(log?.workoutType === 'gym' || log?.workoutType === 'home')
      case 'reels': return hasWeeklyMetric(day, 'reels_week')
      case 'dayoff': return log?.dayOff === 'full' || log?.dayOff === 'partial'
      case 'alcohol': return log ? log.alcohol === true : false
      case 'games': return Boolean(log?.gamesDone)
      case 'content': return Boolean(log?.contentWritingDone)
      default:
        if (activeTab.startsWith('habit_')) {
          const habitId = activeTab.replace('habit_', '')
          const weekKey = getWeekKey(day)
          const slots = customHabitWeeks[habitId]?.[weekKey] || []
          const dayIndex = day.getDay() === 0 ? 6 : day.getDay() - 1
          return dayIndex < slots.length && slots[dayIndex] === true
        }
        return false
    }
  }

  /** Для heatmap: выполнена ли привычка в день (по key). Данные из monthLogs и слотов. */
  const isDoneForHabit = (habitKey: string, day: Date, log: DailyLog | null): boolean => {
    const weekKey = getWeekKey(day)
    const dayIdx = getDayIndex(day)
    if (habitKey === 'steps') return Boolean(log?.stepsDone)
    if (habitKey === 'protein') return Boolean(log?.proteinDone)
    if (habitKey === 'sleep') return Boolean(log?.sleepDone)
    if (habitKey === 'reels') return Boolean(log?.reels)
    if (habitKey === 'workout') return Boolean(log?.workoutType === 'gym' || log?.workoutType === 'home')
    if (habitKey === 'dayoff') return Boolean(log?.dayOff === 'full' || log?.dayOff === 'partial')
    if (habitKey === 'alcohol') return log ? log.alcohol === true : false
    if (habitKey === 'junkFood') return Boolean(log?.junkFood)
    if (habitKey === 'games') return Boolean(log?.gamesDone)
    if (habitKey === 'content') return Boolean(log?.contentWritingDone)
    if (habitKey === 'profi') {
      const p = profiWeeks[weekKey]
      const t = threadsWeeks[weekKey]
      const pv = p && dayIdx < p.length ? p[dayIdx] === true : false
      const tv = t && dayIdx < t.length ? t[dayIdx] === true : false
      return pv || tv
    }
    if (habitKey === 'tg_week') return (tgWeeks[weekKey] && dayIdx < tgWeeks[weekKey].length && tgWeeks[weekKey][dayIdx] === true)
    if (habitKey === 'social_week') return (socialWeeks[weekKey] && dayIdx < socialWeeks[weekKey].length && socialWeeks[weekKey][dayIdx] === true)
    if (habitKey === 'client_search_week') return (clientSearchWeeks[weekKey] && dayIdx < clientSearchWeeks[weekKey].length && clientSearchWeeks[weekKey][dayIdx] === true)
    if (habitKey.startsWith('habit_')) {
      const id = habitKey.replace('habit_', '')
      const slots = customHabitWeeks[id]?.[weekKey] ?? []
      return dayIdx < slots.length && slots[dayIdx] === true
    }
    return false
  }

  const HEATMAP_ROW_COLORS: Record<string, string> = {
    steps: 'bg-green-500',
    protein: 'bg-blue-500',
    sleep: 'bg-purple-500',
    reels: 'bg-pink-500',
    workout: 'bg-indigo-500',
    dayoff: 'bg-gray-600',
    alcohol: 'bg-red-500',
    junkFood: 'bg-orange-500',
    games: 'bg-indigo-500',
    content: 'bg-teal-500',
    profi: 'bg-gray-700',
    tg_week: 'bg-blue-400',
    social_week: 'bg-green-400',
    client_search_week: 'bg-orange-500',
  }

  /** Для годового heatmap: выполнено в день (данные из yearLogs и yearSlotData) */
  const yearLogsByDate = new Map(yearLogs.map(l => [l.date, l]))
  const getLogForDateYear = (date: Date) => yearLogsByDate.get(getDateString(date)) ?? null
  const fullYearLogsByDate = new Map(fullYearLogs.map(l => [l.date, l]))
  const getLogForDateFullYear = (date: Date) => fullYearLogsByDate.get(getDateString(date)) ?? null
  const isDoneForHabitYear = (habitKey: string, date: Date, log: DailyLog | null, byWeek: Record<string, Record<string, (boolean | null)[]>>): boolean => {
    const weekKey = getWeekKey(date)
    const dayIdx = getDayIndex(date)
    if (habitKey === 'steps') return Boolean(log?.stepsDone)
    if (habitKey === 'protein') return Boolean(log?.proteinDone)
    if (habitKey === 'sleep') return Boolean(log?.sleepDone)
    if (habitKey === 'reels') return Boolean(log?.reels)
    if (habitKey === 'workout') return Boolean(log?.workoutType === 'gym' || log?.workoutType === 'home')
    if (habitKey === 'dayoff') return Boolean(log?.dayOff === 'full' || log?.dayOff === 'partial')
    if (habitKey === 'alcohol') return log ? log.alcohol === true : false
    if (habitKey === 'junkFood') return Boolean(log?.junkFood)
    if (habitKey === 'games') return Boolean(log?.gamesDone)
    if (habitKey === 'content') return Boolean(log?.contentWritingDone)
    if (habitKey === 'profi') {
      const p = byWeek[weekKey]?.profi_week
      const t = byWeek[weekKey]?.threads_week
      const pv = p && dayIdx < p.length ? p[dayIdx] === true : false
      const tv = t && dayIdx < t.length ? t[dayIdx] === true : false
      return pv || tv
    }
    if (habitKey === 'tg_week') return (byWeek[weekKey]?.tg_week && dayIdx < byWeek[weekKey].tg_week.length && byWeek[weekKey].tg_week[dayIdx] === true)
    if (habitKey === 'social_week') return (byWeek[weekKey]?.social_week && dayIdx < byWeek[weekKey].social_week.length && byWeek[weekKey].social_week[dayIdx] === true)
    if (habitKey === 'client_search_week') return (byWeek[weekKey]?.client_search_week && dayIdx < byWeek[weekKey].client_search_week.length && byWeek[weekKey].client_search_week[dayIdx] === true)
    if (habitKey.startsWith('habit_')) {
      const id = habitKey.replace('habit_', '')
      const slots = byWeek[weekKey]?.[`habit_${id}`] ?? []
      return dayIdx < slots.length && slots[dayIdx] === true
    }
    return false
  }
  const getMaxForYear = (habitKey: string): number => habitKey === 'workout' ? 132 : getDaysInYearFebDec(selectedYear)

  /** Количество выполненных дней за год (Фев–Дек) для привычки */
  const getCompletedForYear = (habitKey: string): number => {
    const byWeek = yearSlotData.byWeek
    let count = 0
    const yearDates = getYearFebDecDates(selectedYear)
    yearDates.forEach((d) => {
      const log = getLogForDateYear(d)
      if (isDoneForHabitYear(habitKey, d, log, byWeek)) count++
    })
    return count
  }

  const HABIT_KEYS = ['steps', 'protein', 'sleep', 'alcohol', 'junkFood', 'workout'] as const
  /** Список строк календаря/привычек: только шаги, белок, сон, алкоголь, вредная еда, тренировки */
  const heatmapRows: { key: string; name: string }[] = [
    { key: 'steps', name: 'Шаги' },
    { key: 'protein', name: 'Белок' },
    { key: 'sleep', name: 'Сон' },
    { key: 'alcohol', name: 'Алкоголь' },
    { key: 'junkFood', name: 'Вредная еда' },
    { key: 'workout', name: 'Тренировки' },
  ]

  // Цвет точки для активного таба (когда привычка выполнена)
  const getTabDotColor = (): string => {
    switch (activeTab) {
      case 'steps': return 'bg-green-500'
      case 'protein': return 'bg-blue-500'
      case 'sleep': return 'bg-purple-500'
      case 'workout': return 'bg-indigo-500'
      case 'reels': return 'bg-pink-500'
      case 'dayoff': return 'bg-gray-600'
      case 'alcohol': return 'bg-red-500'
      case 'games': return 'bg-indigo-500'
      case 'content': return 'bg-teal-500'
      default: return activeTab.startsWith('habit_') ? 'bg-violet-500' : 'bg-gray-500'
    }
  }

  // Получить полный tooltip для дня
  const getDayTooltip = (day: Date, log: DailyLog | null): string => {
    const tips = []
    
    // Ежедневные привычки
    tips.push(`Шаги: ${log?.stepsDone ? '✅' : '❌'}`)
    tips.push(`Белок: ${log?.proteinDone ? '✅' : '❌'}`)
    tips.push(`Сон: ${log?.sleepDone ? '✅' : '❌'}`)
    
    // Тренировка
    tips.push(`Тренировка: ${log?.workoutType === 'gym' ? 'Зал' : log?.workoutType === 'home' ? 'Дом' : 'нет'}`)
    
    // Недельные метрики
    tips.push(`Reels: ${hasWeeklyMetric(day, 'reels_week') ? 'пост был' : 'нет'}`)
    tips.push(`Telegram: ${hasWeeklyMetric(day, 'tg_week') ? 'пост был' : 'нет'}`)
    tips.push(`Threads: ${hasWeeklyMetric(day, 'threads_week') ? 'пост был' : 'нет'}`)
    tips.push(`Соц выход: ${hasWeeklyMetric(day, 'social_week') ? 'был' : 'нет'}`)
    
    // Выходной, алкоголь и вредная еда
    tips.push(`Выходной: ${log?.dayOff === 'full' ? 'полный' : log?.dayOff === 'partial' ? 'частичный' : 'нет'}`)
    tips.push(`Алкоголь: ${log?.alcohol ? 'не было ✅' : 'был ❌'}`)
    tips.push(`Вредная еда: ${log?.junkFood ? 'не было ✅' : 'была ❌'}`)
    tips.push(`Игры: ${log?.gamesDone ? '✅' : '❌'}`)
    tips.push(`Контент: ${log?.contentWritingDone ? '✅' : '❌'}`)
    
    // Итог дня
    let score = 0
    if (log?.stepsDone) score++
    if (log?.proteinDone) score++
    if (log?.sleepDone) score++
    if (log?.alcohol) score++ // alcohol=true означает "не было алкоголя"
    if (log?.junkFood) score++ // junkFood=true означает "не было вредной еды"
    tips.push(`Итог дня: ${score}/5`)
    
    return tips.join('\n')
  }

  // Статистика за месяц
  const getMonthStats = () => {
    const days = getDaysInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
    const logsMap = new Map(monthLogs.map(log => [log.date, log]))
    
    let stepsCount = 0
    let proteinCount = 0
    let sleepCount = 0
    let gymCount = 0
    let homeCount = 0
    
    days.forEach(day => {
      const dateStr = getDateString(day)
      const log = logsMap.get(dateStr)
      if (log) {
        if (log.stepsDone) stepsCount++
        if (log.proteinDone) proteinCount++
        if (log.sleepDone) sleepCount++
        if (log.workoutType === 'gym') gymCount++
        if (log.workoutType === 'home') homeCount++
      }
    })
    
    return {
      totalDays: days.length,
      stepsCount,
      proteinCount,
      sleepCount,
      gymCount,
      homeCount,
      workoutCount: gymCount + homeCount
    }
  }

  const stats = getMonthStats()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  const completedCount = (slots: (boolean | null)[]) => slots.filter(s => s === true).length
  const workoutCompletedCount = (slots: ('gym' | 'home' | null)[]) => slots.filter(s => s !== null).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Трекер привычек</h1>

        {/* Статистика привычек — круговые прогресс-бары */}
        {(monthStats || yearStats) && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 mb-8 overflow-hidden">
            <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Статистика привычек</h2>

            {/* 1. Общий % за месяц — крупный круг */}
            {monthStats && (
              <div className="flex justify-center mb-10">
                <CircularProgress
                  pct={monthStats.overallPct}
                  size={180}
                  strokeWidth={14}
                  label="Все привычки за месяц"
                  sublabel={`${monthNames[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`}
                  color="rgb(99 102 241)"
                />
              </div>
            )}

            {/* 2. По каждой привычке за выбранный месяц */}
            {monthStats && monthStats.byHabit.length > 0 && (
              <div className="mb-10">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 text-center">
                  По привычке за месяц
                </h3>
                <div className="flex flex-wrap justify-center gap-8">
                  {monthStats.byHabit.filter((h) => HABIT_KEYS.includes(h.key as any)).map((h) => (
                    <CircularProgress
                      key={h.key}
                      pct={h.pct}
                      size={100}
                      strokeWidth={8}
                      label={h.name}
                      sublabel={`${h.completed}/${h.max}`}
                      color="rgb(99 102 241)"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 3. По каждой привычке за год (фев–дек) */}
            {yearStats && yearStats.byHabit.length > 0 && (
              <div className="mb-10">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 text-center">
                  По привычке за год (февраль – декабрь)
                </h3>
                <div className="flex flex-wrap justify-center gap-8">
                  {yearStats.byHabit.filter((h) => HABIT_KEYS.includes(h.key as any)).map((h) => (
                    <CircularProgress
                      key={h.key}
                      pct={h.pct}
                      size={100}
                      strokeWidth={8}
                      label={h.name}
                      sublabel={`${h.completed}/${h.max}`}
                      color="rgb(34 197 94)"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 4. По каждой привычке по месяцам — раскрывающийся блок */}
            {yearByMonthStats && yearByMonthStats.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowByMonthStats((v) => !v)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-gray-700"
                >
                  По привычке по месяцам (% за месяц)
                  <span className="text-gray-500">{showByMonthStats ? '▼' : '▶'}</span>
                </button>
                {showByMonthStats && (
                  <div className="p-4 bg-white border-t border-gray-200">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-2 font-semibold text-gray-700">Привычка</th>
                            {yearByMonthStats[0]?.months.map((mo) => (
                              <th key={mo.month} className="text-center py-2 px-1 font-medium text-gray-600 w-14">
                                {monthNamesShort[parseInt(mo.month.slice(5), 10) - 1]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {yearByMonthStats.filter((row) => HABIT_KEYS.includes(row.key as any)).map((row) => (
                            <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50/50">
                              <td className="py-2 px-2 font-medium text-gray-800 whitespace-nowrap">{row.name}</td>
                              {row.months.map((mo) => (
                                <td key={mo.month} className="py-2 px-1 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <CircularProgress
                                      pct={mo.pct}
                                      size={48}
                                      strokeWidth={5}
                                      label=""
                                      color="rgb(99 102 241)"
                                      hideInnerText
                                    />
                                    <span className="text-xs font-medium text-gray-700 tabular-nums">{mo.pct}%</span>
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Зоны внимания — скрытый по умолчанию */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowZones((v) => !v)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold text-gray-900">Зоны внимания</h2>
            <span className="text-gray-500">{showZones ? '▼' : '▶'}</span>
          </button>
          {showZones && (
            <div className="px-6 pb-6 pt-0 border-t border-gray-100">
              {zones && zones.warnings && zones.warnings.length > 0 ? (
                <div className="space-y-2">
                  {zones.warnings.map((warning, idx) => (
                    <div key={idx} className="text-red-600 font-medium">⚠️ {warning}</div>
                  ))}
                </div>
              ) : (
                <div className="text-green-600 font-medium">✓ Всё под контролем</div>
              )}
            </div>
          )}
        </div>

        {/* Режим дня — скрытый по умолчанию */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDayMode((v) => !v)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold text-gray-900">Режим дня</h2>
            <span className="text-sm text-gray-500">Сегодня: {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
            <span className="text-gray-500 ml-2">{showDayMode ? '▼' : '▶'}</span>
          </button>
          {showDayMode && (
            <div className="px-6 pb-6 pt-0 border-t border-gray-100">
              <p className="text-sm text-gray-600 mb-4">Каждый день - отдельная запись. Завтра режим будет пустым, пока не выберете новый.</p>
              <div className="flex space-x-4">
                {(['strong', 'light', 'rest'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => saveDailyLog({ dayMode: todayLog?.dayMode === mode ? null : mode })}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      todayLog?.dayMode === mode
                        ? mode === 'strong'
                          ? 'bg-blue-600 text-white'
                          : mode === 'light'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {mode === 'strong' ? 'Сильный' : mode === 'light' ? 'Лёгкий' : 'Отдых'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Календарь за год: 12 месяцев кружочками (как на референсе), светлая тема */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Календарь за год</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedYear((y) => y - 1)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                ←
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">{selectedYear}</span>
              <button
                onClick={() => setSelectedYear((y) => y + 1)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                →
              </button>
              {selectedYear !== new Date().getFullYear() && (
                <button
                  onClick={() => setSelectedYear(new Date().getFullYear())}
                  className="px-3 py-1 text-sm bg-violet-600 text-white hover:bg-violet-700 rounded"
                >
                  Текущий год
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {heatmapRows.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => setActiveTab(row.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === row.key ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {row.name}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500 mb-4">Клик по дню — поправить привычки за тот день.</p>
          <div className="grid grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
              const gridDates = getCalendarGridDates(selectedYear, m)
              const color = HEATMAP_ROW_COLORS[activeTab] ?? 'bg-violet-500'
              const todayStr = getTodayDateString()
              return (
                <div key={m} className="flex flex-col items-center">
                  <div className="text-sm font-medium text-gray-800 mb-2">{monthLabelsShort[m - 1]}</div>
                  <div className="grid grid-cols-7 gap-1" style={{ width: 'fit-content' }}>
                    {gridDates.map((d, idx) => {
                      const inMonth = d.getMonth() + 1 === m
                      const log = getLogForDateFullYear(d)
                      const done = inMonth && isDoneForHabit(activeTab, d, log)
                      const isToday = getDateString(d) === todayStr
                      let circleClass = 'rounded-full flex-shrink-0 w-4 h-4 '
                      if (!inMonth) circleClass += 'bg-gray-100'
                      else if (isToday) circleClass += 'bg-orange-500'
                      else if (done) circleClass += color
                      else circleClass += 'bg-gray-300'
                      if (inMonth) circleClass += ' cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-400'
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={circleClass}
                          title={inMonth ? `${getDateString(d)} — нажмите, чтобы изменить` : ''}
                          disabled={!inMonth}
                          onClick={() => inMonth && setCalendarEditDate(getDateString(d))}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Ежедневные привычки */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Система жизни / привлекательность</h2>
            <span className="text-sm text-gray-500">Ежедневно</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">Каждый день - отдельная запись. Завтра галочки будут пустыми, пока не отметите заново.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">10 000 шагов</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={todayLog?.stepsDone || false}
                  onChange={(e) => {
                    console.log('Steps checkbox changed to:', e.target.checked)
                    saveDailyLog({ stepsDone: e.target.checked })
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Белок 140г</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={todayLog?.proteinDone || false}
                  onChange={(e) => saveDailyLog({ proteinDone: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Сон 8 часов</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={todayLog?.sleepDone || false}
                  onChange={(e) => saveDailyLog({ sleepDone: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Компьютерные игры</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={todayLog?.gamesDone || false}
                  onChange={(e) => saveDailyLog({ gamesDone: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Написание контента</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={todayLog?.contentWritingDone || false}
                  onChange={(e) => saveDailyLog({ contentWritingDone: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Тренировки */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Тренировки (3/нед)</h2>
          {(() => {
            const weeksInMonth = getWeeksInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
            return weeksInMonth.map((weekKey) => {
              const slots = workoutWeeks[weekKey] || Array(3).fill(null)
              const completed = workoutCompletedCount(slots)
              return (
                <div key={weekKey} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{getWeekLabel(weekKey)}</span>
                    <span className="text-sm text-gray-600 font-medium">{completed}/3</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {slots.map((slot, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleWeekWorkoutSlot(weekKey, idx, workoutWeeks, setWorkoutWeeks)}
                        className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-sm transition-all ${
                          slot === 'gym'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : slot === 'home'
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200'
                        }`}
                        title={slot === 'gym' ? 'Зал' : slot === 'home' ? 'Дом' : 'Пусто'}
                      >
                        {slot === 'gym' ? '🏋️' : slot === 'home' ? '🏠' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          })()}
        </div>

        {/* Медиа */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Медиа</h2>
          
          {/* YouTube */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-medium">YouTube (4/мес)</span>
              <span className="text-gray-600 text-sm">{completedCount(youtubeSlots)}/4</span>
            </div>
            <div className="flex space-x-2">
              {youtubeSlots.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleMonthSlot(idx, 'youtube_month', youtubeSlots, setYoutubeSlots)}
                  className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                    slot
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {slot ? '✓' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Reels */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-medium">Reels (1/день, 7/нед)</span>
            </div>
            {(() => {
              const weeksInMonth = getWeeksInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
              return weeksInMonth.map((weekKey) => {
                const slots = reelsWeeks[weekKey] || Array(7).fill(null)
                const completed = completedCount(slots)
                return (
                  <div key={weekKey} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">{getWeekLabel(weekKey)}</span>
                      <span className="text-sm text-gray-600 font-medium">{completed}/7</span>
                    </div>
                    <div className="flex space-x-1">
                      {slots.map((slot, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleWeekSlot(weekKey, idx, 'reels_week', reelsWeeks, setReelsWeeks)}
                          className={`w-10 h-10 rounded-lg border-2 flex flex-col items-center justify-center text-xs transition-all ${
                            slot
                              ? 'bg-pink-600 border-pink-600 text-white'
                              : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          <span>{getDayOfWeekLabels()[idx]}</span>
                          {slot && <span className="text-xs">✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            })()}
          </div>

          {/* Telegram */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-medium">Telegram (2/нед)</span>
            </div>
            {(() => {
              const weeksInMonth = getWeeksInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
              return weeksInMonth.map((weekKey) => {
                const slots = tgWeeks[weekKey] || Array(2).fill(null)
                const completed = completedCount(slots)
                return (
                  <div key={weekKey} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">{getWeekLabel(weekKey)}</span>
                      <span className="text-sm text-gray-600 font-medium">{completed}/2</span>
                    </div>
                    <div className="flex space-x-2">
                      {slots.map((slot, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleWeekSlot(weekKey, idx, 'tg_week', tgWeeks, setTgWeeks)}
                          className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                            slot
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {slot ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            })()}
          </div>

          {/* Threads */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-medium">Threads (1-2/нед)</span>
            </div>
            {(() => {
              const weeksInMonth = getWeeksInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
              return weeksInMonth.map((weekKey) => {
                const slots = threadsWeeks[weekKey] || Array(2).fill(null)
                const completed = completedCount(slots)
                return (
                  <div key={weekKey} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">{getWeekLabel(weekKey)}</span>
                      <span className="text-sm text-gray-600 font-medium">{completed}/2</span>
                    </div>
                    <div className="flex space-x-2">
                      {slots.map((slot, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleWeekSlot(weekKey, idx, 'threads_week', threadsWeeks, setThreadsWeeks)}
                          className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                            slot
                              ? 'bg-black border-black text-white'
                              : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {slot ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            })()}
          </div>

          {/* Мои привычки (пользовательские) */}
          {customHabits.filter((h: CustomHabit) => h.type === 'weekly').length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700 font-medium">Мои привычки</span>
                <a href="/me/habits" className="text-sm text-violet-600 hover:text-violet-800">Управление</a>
              </div>
              {customHabits.filter((h: CustomHabit) => h.type === 'weekly').map((h: CustomHabit) => (
                <div key={h.id} className="mb-6">
                  <div className="text-sm font-medium text-gray-700 mb-2">{h.name}</div>
                  {(() => {
                    const weeksInMonth = getWeeksInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
                    return weeksInMonth.map((weekKey) => {
                      const slots = (customHabitWeeks[h.id] || {})[weekKey] || Array(7).fill(null)
                      const completed = completedCount(slots)
                      return (
                        <div key={weekKey} className="mb-4 last:mb-0">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-500">{getWeekLabel(weekKey)}</span>
                            <span className="text-xs text-gray-500">{completed}/7</span>
                          </div>
                          <div className="flex space-x-1">
                            {slots.slice(0, 7).map((slot, idx) => (
                              <button
                                key={idx}
                                onClick={() => toggleCustomHabitSlot(h.id, weekKey, idx)}
                                className={`w-10 h-10 rounded-lg border-2 flex flex-col items-center justify-center text-xs transition-all ${
                                  slot ? 'bg-violet-600 border-violet-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                <span>{getDayOfWeekLabels()[idx]}</span>
                                {slot && <span className="text-xs">✓</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Социальная жизнь */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Социальная жизнь</h2>
          
          {/* Соц выходы */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-medium">Соц выходы (2/нед)</span>
            </div>
            {(() => {
              const weeksInMonth = getWeeksInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
              return weeksInMonth.map((weekKey) => {
                const slots = socialWeeks[weekKey] || Array(2).fill(null)
                const completed = completedCount(slots)
                return (
                  <div key={weekKey} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">{getWeekLabel(weekKey)}</span>
                      <span className="text-sm text-gray-600 font-medium">{completed}/2</span>
                    </div>
                    <div className="flex space-x-2">
                      {slots.map((slot, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleWeekSlot(weekKey, idx, 'social_week', socialWeeks, setSocialWeeks)}
                          className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                            slot
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {slot ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            })()}
          </div>

          {/* Поездка */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-medium">Поездка (1/квартал)</span>
              <span className="text-gray-600 text-sm">{completedCount(tripSlot)}/1</span>
            </div>
            <div className="flex space-x-2">
              {tripSlot.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleQuarterSlot(idx, 'trip_quarter', tripSlot, setTripSlot)}
                  className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                    slot
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {slot ? '✓' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Поиск клиентов */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Поиск клиентов</h2>
          <p className="text-sm text-gray-600 mb-4">5 дней в неделю</p>
          {(() => {
            const weeksInMonth = getWeeksInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
            return weeksInMonth.map((weekKey) => {
              const slots = clientSearchWeeks[weekKey] || Array(5).fill(null)
              const completed = completedCount(slots)
              return (
                <div key={weekKey} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{getWeekLabel(weekKey)}</span>
                    <span className="text-sm text-gray-600 font-medium">{completed}/5</span>
                  </div>
                  <div className="flex space-x-2">
                    {slots.map((slot, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleWeekSlot(weekKey, idx, 'client_search_week', clientSearchWeeks, setClientSearchWeeks)}
                        className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                          slot
                            ? 'bg-orange-600 border-orange-600 text-white'
                            : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {slot ? '✓' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          })()}
        </div>

        {/* Модалка редактирования дня из календаря (только 6 привычек) */}
        {calendarEditDate && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
            onClick={() => setCalendarEditDate(null)}
          >
            <div
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto z-[101]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {new Date(calendarEditDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>
                <button type="button" onClick={() => setCalendarEditDate(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Исправьте привычки за этот день, если забыли отметить.</p>
              {(() => {
                const defaultLog: DailyLog = {
                  date: calendarEditDate,
                  dayMode: null,
                  stepsDone: false,
                  proteinDone: false,
                  sleepDone: false,
                  workoutType: null,
                  alcohol: false,
                  dayOff: null,
                  junkFood: false,
                  reels: false,
                  gamesDone: false,
                  contentWritingDone: false
                }
                const log = fullYearLogsByDate.get(calendarEditDate) ?? defaultLog
                const selectedDate = new Date(calendarEditDate)
                const weekKey = getWeekKey(selectedDate)
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={async () => { await saveDailyLogForDate(calendarEditDate, { stepsDone: !log?.stepsDone }) }} className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${log?.stepsDone ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><span className="text-xl">👟</span><span>Шаги {log?.stepsDone ? '✅' : '❌'}</span></button>
                      <button type="button" onClick={async () => { await saveDailyLogForDate(calendarEditDate, { proteinDone: !log?.proteinDone }) }} className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${log?.proteinDone ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><span className="text-xl">🍗</span><span>Белок {log?.proteinDone ? '✅' : '❌'}</span></button>
                      <button type="button" onClick={async () => { await saveDailyLogForDate(calendarEditDate, { sleepDone: !log?.sleepDone }) }} className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${log?.sleepDone ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><span className="text-xl">🌙</span><span>Сон {log?.sleepDone ? '✅' : '❌'}</span></button>
                      <button type="button" onClick={async () => { await saveDailyLogForDate(calendarEditDate, { alcohol: !log?.alcohol }) }} className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${log?.alcohol ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}><span className="text-xl">🍷</span><span>{log?.alcohol ? '✅ Не было' : '❌ Был'}</span></button>
                      <button type="button" onClick={async () => { await saveDailyLogForDate(calendarEditDate, { junkFood: !log?.junkFood }) }} className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 col-span-2 ${log?.junkFood ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}><span className="text-xl">🍔</span><span>{log?.junkFood ? '✅ Вредной еды не было' : '❌ Была вредная еда'}</span></button>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-2">Тренировка</div>
                      <div className="flex gap-2">
                        <button type="button" onClick={async () => { await saveDailyLogForDate(calendarEditDate, { workoutType: 'gym' }); const slots = workoutWeeks[weekKey] || Array(3).fill(null); const idx = slots.findIndex(s => s === null); if (idx !== -1) { const newSlots = [...slots]; newSlots[idx] = 'gym'; await saveSlotProgress('workouts_week', newSlots, weekKey); setWorkoutWeeks(prev => ({ ...prev, [weekKey]: newSlots })) } }} className={`flex-1 px-3 py-2 rounded-lg font-medium ${log?.workoutType === 'gym' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>🏋️ Зал</button>
                        <button type="button" onClick={async () => { await saveDailyLogForDate(calendarEditDate, { workoutType: 'home' }); const slots = workoutWeeks[weekKey] || Array(3).fill(null); const idx = slots.findIndex(s => s === null); if (idx !== -1) { const newSlots = [...slots]; newSlots[idx] = 'home'; await saveSlotProgress('workouts_week', newSlots, weekKey); setWorkoutWeeks(prev => ({ ...prev, [weekKey]: newSlots })) } }} className={`flex-1 px-3 py-2 rounded-lg font-medium ${log?.workoutType === 'home' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>🏠 Дом</button>
                        <button type="button" onClick={async () => { await saveDailyLogForDate(calendarEditDate, { workoutType: null }) }} className={`px-3 py-2 rounded-lg font-medium ${!log?.workoutType ? 'bg-gray-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Нет</button>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>,
          document.body
        )}

        {/* Модалка для выбора тренировки — рендер в body через Portal, чтобы клики не перехватывались родителями */}
        {workoutModalDate && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
            onClick={() => setWorkoutModalDate(null)}
          >
            <div 
              className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto z-[101]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {new Date(workoutModalDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                </h3>
                <button 
                  onClick={() => setWorkoutModalDate(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              {(() => {
                const log = getLogForDate(new Date(workoutModalDate))
                const selectedDate = new Date(workoutModalDate)
                const weekKey = getWeekKey(selectedDate)
                const monthKey = getMonthKey(selectedDate)
                const dayOfWeek = selectedDate.getDay()
                const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Понедельник = 0, Воскресенье = 6
                
                return (
                  <div className="space-y-4">
                    {/* Ежедневные привычки */}
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-3">Ежедневные привычки</div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Шаги */}
                        <button
                          type="button"
                          onClick={async () => {
                            await saveDailyLogForDate(workoutModalDate, { stepsDone: !log?.stepsDone })
                          }}
                          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            log?.stepsDone
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xl">👟</span>
                          <span>Шаги {log?.stepsDone ? '✅' : '❌'}</span>
                        </button>

                        {/* Белок */}
                        <button
                          type="button"
                          onClick={async () => {
                            await saveDailyLogForDate(workoutModalDate, { proteinDone: !log?.proteinDone })
                          }}
                          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            log?.proteinDone
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xl">🍗</span>
                          <span>Белок {log?.proteinDone ? '✅' : '❌'}</span>
                        </button>

                        {/* Сон */}
                        <button
                          type="button"
                          onClick={async () => {
                            await saveDailyLogForDate(workoutModalDate, { sleepDone: !log?.sleepDone })
                          }}
                          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            log?.sleepDone
                              ? 'bg-purple-500 text-white hover:bg-purple-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xl">🌙</span>
                          <span>Сон {log?.sleepDone ? '✅' : '❌'}</span>
                        </button>

                        {/* Вредная еда */}
                        <button
                          type="button"
                          onClick={async () => {
                            await saveDailyLogForDate(workoutModalDate, { junkFood: !log?.junkFood })
                          }}
                          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            log?.junkFood
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          }`}
                        >
                          <span className="text-xl">🍔</span>
                          <span>{log?.junkFood ? '✅ Не было' : '❌ Была'}</span>
                        </button>

                        {/* Компьютерные игры */}
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            await saveDailyLogForDate(workoutModalDate, { gamesDone: !log?.gamesDone })
                          }}
                          className={`cursor-pointer relative z-10 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            log?.gamesDone
                              ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xl">🎮</span>
                          <span>Игры {log?.gamesDone ? '✅' : '❌'}</span>
                        </button>

                        {/* Написание контента */}
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            await saveDailyLogForDate(workoutModalDate, { contentWritingDone: !log?.contentWritingDone })
                          }}
                          className={`cursor-pointer relative z-10 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            log?.contentWritingDone
                              ? 'bg-teal-500 text-white hover:bg-teal-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xl">✍️</span>
                          <span>Контент {log?.contentWritingDone ? '✅' : '❌'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Тренировка */}
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-3">Тренировка</div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await saveDailyLogForDate(workoutModalDate, { workoutType: 'gym' })
                            // Обновляем недельный слот
                            const slots = workoutWeeks[weekKey] || Array(3).fill(null)
                            const firstEmptyIndex = slots.findIndex(slot => slot === null)
                            if (firstEmptyIndex !== -1) {
                              const newSlots = [...slots]
                              newSlots[firstEmptyIndex] = 'gym'
                              await saveSlotProgress('workouts_week', newSlots, weekKey)
                              const updated = { ...workoutWeeks }
                              updated[weekKey] = newSlots
                              setWorkoutWeeks(updated)
                            }
                          }}
                          className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                            log?.workoutType === 'gym'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          🏋️ Зал
                        </button>
                        <button
                          onClick={async () => {
                            await saveDailyLogForDate(workoutModalDate, { workoutType: 'home' })
                            // Обновляем недельный слот
                            const slots = workoutWeeks[weekKey] || Array(3).fill(null)
                            const firstEmptyIndex = slots.findIndex(slot => slot === null)
                            if (firstEmptyIndex !== -1) {
                              const newSlots = [...slots]
                              newSlots[firstEmptyIndex] = 'home'
                              await saveSlotProgress('workouts_week', newSlots, weekKey)
                              const updated = { ...workoutWeeks }
                              updated[weekKey] = newSlots
                              setWorkoutWeeks(updated)
                            }
                          }}
                          className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                            log?.workoutType === 'home'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          🏠 Дом
                        </button>
                        <button
                          onClick={async () => {
                            await saveDailyLogForDate(workoutModalDate, { workoutType: null })
                          }}
                          className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                            !log?.workoutType
                              ? 'bg-gray-200 text-gray-700'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          Нет
                        </button>
                      </div>
                    </div>

                    {/* Медиа */}
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-3">Медиа</div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Reels */}
                        <button
                          onClick={async () => {
                            const newValue = !log?.reels
                            await saveDailyLogForDate(workoutModalDate, { reels: newValue })
                            // Обновляем недельный слот
                            const slots = reelsWeeks[weekKey] || Array(7).fill(null)
                            const newSlots = [...slots]
                            if (dayIndex < newSlots.length) {
                              newSlots[dayIndex] = newValue
                              await saveSlotProgress('reels_week', newSlots, weekKey)
                              const updated = { ...reelsWeeks }
                              updated[weekKey] = newSlots
                              setReelsWeeks(updated)
                            }
                          }}
                          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            log?.reels
                              ? 'bg-pink-500 text-white hover:bg-pink-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xl">📹</span>
                          <span>Reels {log?.reels ? '✅' : '❌'}</span>
                        </button>

                        {/* YouTube */}
                        <button
                          onClick={async () => {
                            const slots = youtubeSlots || Array(4).fill(null)
                            const lastFilledIndex = slots.findLastIndex((slot: boolean | null) => slot === true)
                            const newSlots = [...slots]
                            if (lastFilledIndex !== -1) {
                              newSlots[lastFilledIndex] = null
                            } else {
                              const firstEmptyIndex = newSlots.findIndex((slot: boolean | null) => slot === null || slot === false)
                              if (firstEmptyIndex !== -1) {
                                newSlots[firstEmptyIndex] = true
                              }
                            }
                            await saveSlotProgress('youtube_month', newSlots, monthKey)
                            setYoutubeSlots(newSlots)
                          }}
                          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            youtubeSlots.some(slot => slot === true)
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xl">📺</span>
                          <span>YouTube {youtubeSlots.some(slot => slot === true) ? '✅' : '❌'}</span>
                        </button>

                        {/* Telegram */}
                        <button
                          onClick={async () => {
                            const slots = tgWeeks[weekKey] || Array(2).fill(null)
                            const lastFilledIndex = slots.findLastIndex((slot: boolean | null) => slot === true)
                            const newSlots = [...slots]
                            if (lastFilledIndex !== -1) {
                              newSlots[lastFilledIndex] = null
                            } else {
                              const firstEmptyIndex = newSlots.findIndex((slot: boolean | null) => slot === null || slot === false)
                              if (firstEmptyIndex !== -1) {
                                newSlots[firstEmptyIndex] = true
                              }
                            }
                            await saveSlotProgress('tg_week', newSlots, weekKey)
                            const updated = { ...tgWeeks }
                            updated[weekKey] = newSlots
                            setTgWeeks(updated)
                          }}
                          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            (tgWeeks[weekKey] || []).some(slot => slot === true)
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xl">💬</span>
                          <span>Telegram {(tgWeeks[weekKey] || []).some(slot => slot === true) ? '✅' : '❌'}</span>
                        </button>

                        {/* Threads */}
                        <button
                          onClick={async () => {
                            const slots = threadsWeeks[weekKey] || Array(2).fill(null)
                            const lastFilledIndex = slots.findLastIndex((slot: boolean | null) => slot === true)
                            const newSlots = [...slots]
                            if (lastFilledIndex !== -1) {
                              newSlots[lastFilledIndex] = null
                            } else {
                              const firstEmptyIndex = newSlots.findIndex((slot: boolean | null) => slot === null || slot === false)
                              if (firstEmptyIndex !== -1) {
                                newSlots[firstEmptyIndex] = true
                              }
                            }
                            await saveSlotProgress('threads_week', newSlots, weekKey)
                            const updated = { ...threadsWeeks }
                            updated[weekKey] = newSlots
                            setThreadsWeeks(updated)
                          }}
                          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            (threadsWeeks[weekKey] || []).some(slot => slot === true)
                              ? 'bg-gray-700 text-white hover:bg-gray-800'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xl">🧵</span>
                          <span>Threads {(threadsWeeks[weekKey] || []).some(slot => slot === true) ? '✅' : '❌'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Социальная жизнь */}
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-3">Социальная жизнь</div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Соц выход */}
                        <button
                          onClick={async () => {
                            const slots = socialWeeks[weekKey] || Array(2).fill(null)
                            const lastFilledIndex = slots.findLastIndex((slot: boolean | null) => slot === true)
                            const newSlots = [...slots]
                            if (lastFilledIndex !== -1) {
                              newSlots[lastFilledIndex] = null
                            } else {
                              const firstEmptyIndex = newSlots.findIndex((slot: boolean | null) => slot === null || slot === false)
                              if (firstEmptyIndex !== -1) {
                                newSlots[firstEmptyIndex] = true
                              }
                            }
                            await saveSlotProgress('social_week', newSlots, weekKey)
                            const updated = { ...socialWeeks }
                            updated[weekKey] = newSlots
                            setSocialWeeks(updated)
                          }}
                          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            (socialWeeks[weekKey] || []).some(slot => slot === true)
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xl">🎉</span>
                          <span>Соц выход {(socialWeeks[weekKey] || []).some(slot => slot === true) ? '✅' : '❌'}</span>
                        </button>

                        {/* Поиск клиентов */}
                        <button
                          onClick={async () => {
                            const slots = clientSearchWeeks[weekKey] || Array(5).fill(null)
                            const lastFilledIndex = slots.findLastIndex((slot: boolean | null) => slot === true)
                            const newSlots = [...slots]
                            if (lastFilledIndex !== -1) {
                              newSlots[lastFilledIndex] = null
                            } else {
                              const firstEmptyIndex = newSlots.findIndex((slot: boolean | null) => slot === null || slot === false)
                              if (firstEmptyIndex !== -1) {
                                newSlots[firstEmptyIndex] = true
                              }
                            }
                            await saveSlotProgress('client_search_week', newSlots, weekKey)
                            const updated = { ...clientSearchWeeks }
                            updated[weekKey] = newSlots
                            setClientSearchWeeks(updated)
                          }}
                          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            (clientSearchWeeks[weekKey] || []).some(slot => slot === true)
                              ? 'bg-orange-500 text-white hover:bg-orange-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xl">🔍</span>
                          <span>Поиск клиентов {(clientSearchWeeks[weekKey] || []).some(slot => slot === true) ? '✅' : '❌'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Дополнительно */}
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-3">Дополнительно</div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Алкоголь */}
                        <button
                          onClick={async () => {
                            await saveDailyLogForDate(workoutModalDate, { alcohol: !log?.alcohol })
                          }}
                          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            log?.alcohol
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          <span className="text-xl">🍷</span>
                          <span>{log?.alcohol ? '✅ Не было' : '❌ Был'}</span>
                        </button>

                        {/* Выходной */}
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const current = log?.dayOff || 'none'
                              let next: 'none' | 'partial' | 'full' = 'none'
                              if (current === 'none') next = 'partial'
                              else if (current === 'partial') next = 'full'
                              await saveDailyLogForDate(workoutModalDate, { dayOff: next })
                            }}
                            className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                              log?.dayOff === 'full'
                                ? 'bg-gray-600 text-white'
                                : log?.dayOff === 'partial'
                                ? 'bg-gray-300 text-gray-700'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {log?.dayOff === 'full' ? '💤 Полный' : log?.dayOff === 'partial' ? '⏳ Частичный' : '📅 Нет'}
                          </button>
                          {log?.dayOff && (
                            <button
                            onClick={async () => {
                              await saveDailyLogForDate(workoutModalDate, { dayOff: null })
                            }}
                            className="px-3 py-2 rounded-lg font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                              Сброс
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}
