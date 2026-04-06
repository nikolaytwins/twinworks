import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Типы привычек для расчёта максимума и completed
type HabitType = 'DAILY_BOOLEAN_LOG' | 'DAILY_BOOLEAN_SLOTS' | 'DAILY_BOOLEAN_PROFI' | 'MONTHLY_CAP_12' | 'YOUTUBE_MONTH'

interface HabitConfig {
  key: string
  name: string
  type: HabitType
  /** Для DAILY_BOOLEAN_LOG — поле в daily_logs */
  logField?: string
  /** Для DAILY_BOOLEAN_SLOTS — один metricKey в slot_progress (7 слотов/неделя) */
  slotKey?: string
  /** Для DAILY_BOOLEAN_PROFI — объединение profi_week + threads_week */
  slotKeysMerge?: string[]
}

// Единый конфиг: одна логика для месяца и года
const HABITS: HabitConfig[] = [
  { key: 'steps', name: 'Шаги', type: 'DAILY_BOOLEAN_LOG', logField: 'stepsDone' },
  { key: 'protein', name: 'Белок', type: 'DAILY_BOOLEAN_LOG', logField: 'proteinDone' },
  { key: 'sleep', name: 'Сон', type: 'DAILY_BOOLEAN_LOG', logField: 'sleepDone' },
  { key: 'reels', name: 'Reels', type: 'DAILY_BOOLEAN_LOG', logField: 'reels' },
  { key: 'games', name: 'Игры', type: 'DAILY_BOOLEAN_LOG', logField: 'gamesDone' },
  { key: 'content', name: 'Контент', type: 'DAILY_BOOLEAN_LOG', logField: 'contentWritingDone' },
  { key: 'dayoff', name: 'Выходные', type: 'DAILY_BOOLEAN_LOG', logField: 'dayOff' }, // dayOff not null = counted
  { key: 'alcohol', name: 'Алкоголь', type: 'DAILY_BOOLEAN_LOG', logField: 'alcohol' }, // alcohol=true = не было
  { key: 'junkFood', name: 'Вредная еда', type: 'DAILY_BOOLEAN_LOG', logField: 'junkFood' },
  { key: 'profi', name: 'Профи', type: 'DAILY_BOOLEAN_PROFI', slotKeysMerge: ['profi_week', 'threads_week'] },
  { key: 'tg_week', name: 'Telegram', type: 'DAILY_BOOLEAN_SLOTS', slotKey: 'tg_week' },
  { key: 'social_week', name: 'Социальная жизнь', type: 'DAILY_BOOLEAN_SLOTS', slotKey: 'social_week' },
  { key: 'client_search_week', name: 'Поиск клиентов', type: 'DAILY_BOOLEAN_SLOTS', slotKey: 'client_search_week' },
  { key: 'workouts_week', name: 'Тренировки', type: 'MONTHLY_CAP_12' },
  { key: 'youtube_month', name: 'YouTube', type: 'YOUTUBE_MONTH' },
]

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getWeekKey(date: Date): string {
  const year = date.getFullYear()
  const weekNumber = getWeekNumber(date)
  return `${year}-W${String(weekNumber).padStart(2, '0')}`
}

function getDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** День недели 0..6 (Пн=0, Вс=6) */
function getDayIndex(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

function getWeeksInMonth(year: number, month: number): string[] {
  const weeks: string[] = []
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const currentDate = new Date(firstDay)
  while (currentDate <= lastDay) {
    const weekKey = getWeekKey(currentDate)
    if (!weeks.includes(weekKey)) weeks.push(weekKey)
    currentDate.setDate(currentDate.getDate() + 7)
  }
  return weeks
}

/** Количество дней в году Фев–Дек (январь не участвует). 334 или 335 в високосный */
function getDaysInYearFebDec(year: number): number {
  let days = 0
  for (let m = 2; m <= 12; m++) {
    days += new Date(year, m, 0).getDate()
  }
  return days
}

function countCompleted(slots: unknown[]): number {
  return slots.filter(s => s === true || (typeof s === 'string' && s !== '')).length
}

/** Подсчёт completed по дням месяца для слотов (7 слотов/неделя): один metricKey */
function countCompletedDailyFromSlots(
  year: number,
  month: number,
  metricKey: string,
  progressByKey: Map<string, { periodKey: string; slots: unknown[] }>
): number {
  const lastDay = new Date(year, month, 0).getDate()
  let completed = 0
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day)
    const weekKey = getWeekKey(date)
    const dayIndex = getDayIndex(date)
    const row = progressByKey.get(`${weekKey}:${metricKey}`)
    const slots = row?.slots ?? []
    if (dayIndex < slots.length && (slots[dayIndex] === true || (typeof slots[dayIndex] === 'string' && slots[dayIndex] !== ''))) {
      completed++
    }
  }
  return completed
}

/** Подсчёт для Profi: объединение profi_week + threads_week по дням */
function countCompletedProfi(
  year: number,
  month: number,
  progressByKey: Map<string, { periodKey: string; slots: unknown[] }>
): number {
  const lastDay = new Date(year, month, 0).getDate()
  let completed = 0
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day)
    const weekKey = getWeekKey(date)
    const dayIndex = getDayIndex(date)
    const profi = progressByKey.get(`${weekKey}:profi_week`)?.slots ?? []
    const threads = progressByKey.get(`${weekKey}:threads_week`)?.slots ?? []
    const p = dayIndex < profi.length && (profi[dayIndex] === true || (typeof profi[dayIndex] === 'string' && profi[dayIndex] !== ''))
    const t = dayIndex < threads.length && (threads[dayIndex] === true || (typeof threads[dayIndex] === 'string' && threads[dayIndex] !== ''))
    if (p || t) completed++
  }
  return completed
}

/** Подсчёт тренировок за месяц (слоты workouts_week по неделям) */
function countCompletedWorkoutsMonth(
  year: number,
  month: number,
  progressByKey: Map<string, { periodKey: string; slots: unknown[] }>
): number {
  const weekKeys = getWeeksInMonth(year, month)
  let completed = 0
  for (const weekKey of weekKeys) {
    const row = progressByKey.get(`${weekKey}:workouts_week`)
    const slots = row?.slots ?? []
    completed += slots.filter((s: unknown) => s !== null && s !== false).length
  }
  return completed
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const byMonth = searchParams.get('byMonth') === '1'

    const db = getDb()

    // Пользовательские привычки (недельные 7 слотов) — считаем как DAILY_BOOLEAN
    let customHabits: { id: string; name: string; slotsCount: number }[] = []
    try {
      customHabits = db.prepare(
        'SELECT id, name, slotsCount FROM habit_definitions WHERE type = ? ORDER BY "order" ASC'
      ).all('weekly') as { id: string; name: string; slotsCount: number }[]
    } catch (_) {}

    const allProgress = db.prepare(`
      SELECT periodKey, metricKey, slots FROM slot_progress
      WHERE metricKey LIKE '%_week' OR metricKey LIKE 'habit_%' OR metricKey = 'youtube_month'
    `).all() as { periodKey: string; metricKey: string; slots: string }[]

    const parseSlots = (s: string): unknown[] => {
      try {
        const arr = JSON.parse(s)
        return Array.isArray(arr) ? arr : []
      } catch {
        return []
      }
    }

    const progressByKey = new Map<string, { periodKey: string; slots: unknown[] }>()
    allProgress.forEach((p) => {
      progressByKey.set(`${p.periodKey}:${p.metricKey}`, { periodKey: p.periodKey, slots: parseSlots(p.slots) })
    })

    if (month) {
      const [y, m] = month.split('-').map(Number)
      const lastDayOfMonth = new Date(y, m, 0).getDate()
      const daysInMonth = lastDayOfMonth

      // Assert: февраль 28, март 31
      if (y === 2026 && m === 2 && daysInMonth !== 28) console.warn('Assert: Feb 2026 should have 28 days')
      if (y === 2026 && m === 3 && daysInMonth !== 31) console.warn('Assert: Mar 2026 should have 31 days')

      const startDate = `${y}-${String(m).padStart(2, '0')}-01`
      const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`

      let dailyLogs: Record<string, any>[] = []
      try {
        dailyLogs = db.prepare(`
          SELECT date, stepsDone, proteinDone, sleepDone, reels, gamesDone, contentWritingDone, dayOff, alcohol, junkFood
          FROM daily_logs WHERE date >= ? AND date <= ?
        `).all(startDate, endDate) as Record<string, any>[]
      } catch (_) {}

      const logsByDate = new Map(dailyLogs.map(l => [l.date, l]))

      let totalCompleted = 0
      let totalMax = 0
      const byHabit: { key: string; name: string; completed: number; max: number; pct: number }[] = []

      for (const habit of HABITS) {
        let completed = 0
        let max = 0

        if (habit.type === 'DAILY_BOOLEAN_LOG' && habit.logField) {
          max = daysInMonth
          const field = habit.logField
          if (field === 'dayOff') {
            completed = dailyLogs.filter(l => l.dayOff != null && l.dayOff !== '').length
          } else if (field === 'alcohol') {
            completed = dailyLogs.filter(l => l.alcohol === 1 || l.alcohol === true).length
          } else {
            completed = dailyLogs.filter(l => l[field] === 1 || l[field] === true).length
          }
        } else if (habit.type === 'DAILY_BOOLEAN_SLOTS' && habit.slotKey) {
          max = daysInMonth
          completed = countCompletedDailyFromSlots(y, m, habit.slotKey, progressByKey)
        } else if (habit.type === 'DAILY_BOOLEAN_PROFI') {
          max = daysInMonth
          completed = countCompletedProfi(y, m, progressByKey)
        } else if (habit.type === 'MONTHLY_CAP_12') {
          max = 12
          completed = countCompletedWorkoutsMonth(y, m, progressByKey)
        } else if (habit.type === 'YOUTUBE_MONTH') {
          const row = progressByKey.get(`${month}:youtube_month`)
          const slots = row?.slots ?? []
          completed = countCompleted(slots)
          max = 4
        }

        totalCompleted += completed
        totalMax += max
        byHabit.push({
          key: habit.key,
          name: habit.name,
          completed,
          max,
          pct: max > 0 ? Math.round((completed / max) * 1000) / 10 : 0,
        })
      }

      // Пользовательские привычки (habit_XXX): 7 слотов = по дням, max = daysInMonth
      for (const h of customHabits) {
        const key = `habit_${h.id}`
        const max = daysInMonth
        const completed = countCompletedDailyFromSlots(y, m, key, progressByKey)
        totalCompleted += completed
        totalMax += max
        byHabit.push({
          key,
          name: h.name,
          completed,
          max,
          pct: max > 0 ? Math.round((completed / max) * 1000) / 10 : 0,
        })
      }

      const overallPct = totalMax > 0 ? Math.round((totalCompleted / totalMax) * 1000) / 10 : 0
      db.close()
      return NextResponse.json({
        month,
        overallPct,
        totalCompleted,
        totalMax,
        byHabit,
      })
    }

    if (year) {
      const yearNum = parseInt(year, 10)
      const daysInYearFebDec = getDaysInYearFebDec(yearNum)
      // Assert: 2026 не високосный, фев-дек = 334
      if (yearNum === 2026 && daysInYearFebDec !== 334) console.warn('Assert: 2026 Feb-Dec should be 334 days')

      if (byMonth) {
        const byHabitPerMonth: { key: string; name: string; months: { month: string; completed: number; max: number; pct: number }[] }[] = []
        for (const habit of HABITS) {
          const months: { month: string; completed: number; max: number; pct: number }[] = []
          for (let mo = 2; mo <= 12; mo++) {
            const monthKey = `${yearNum}-${String(mo).padStart(2, '0')}`
            const lastDay = new Date(yearNum, mo, 0).getDate()
            const startDate = `${yearNum}-${String(mo).padStart(2, '0')}-01`
            const endDate = `${yearNum}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

            let completed = 0
            let max = 0

            if (habit.type === 'DAILY_BOOLEAN_LOG' && habit.logField) {
              max = lastDay
              let rows: Record<string, any>[] = []
              try {
                rows = db.prepare(
                  `SELECT date, stepsDone, proteinDone, sleepDone, reels, gamesDone, contentWritingDone, dayOff, alcohol, junkFood FROM daily_logs WHERE date >= ? AND date <= ?`
                ).all(startDate, endDate) as Record<string, any>[]
              } catch (_) {}
              const field = habit.logField
              if (field === 'dayOff') completed = rows.filter(r => r.dayOff != null && r.dayOff !== '').length
              else if (field === 'alcohol') completed = rows.filter(r => r.alcohol === 1 || r.alcohol === true).length
              else completed = rows.filter(r => r[field] === 1 || r[field] === true).length
            } else if (habit.type === 'DAILY_BOOLEAN_SLOTS' && habit.slotKey) {
              max = lastDay
              completed = countCompletedDailyFromSlots(yearNum, mo, habit.slotKey, progressByKey)
            } else if (habit.type === 'DAILY_BOOLEAN_PROFI') {
              max = lastDay
              completed = countCompletedProfi(yearNum, mo, progressByKey)
            } else if (habit.type === 'MONTHLY_CAP_12') {
              max = 12
              completed = countCompletedWorkoutsMonth(yearNum, mo, progressByKey)
            } else if (habit.type === 'YOUTUBE_MONTH') {
              const row = progressByKey.get(`${monthKey}:youtube_month`)
              completed = countCompleted(row?.slots ?? [])
              max = 4
            }

            months.push({
              month: monthKey,
              completed,
              max,
              pct: max > 0 ? Math.round((completed / max) * 1000) / 10 : 0,
            })
          }
          byHabitPerMonth.push({ key: habit.key, name: habit.name, months })
        }
        for (const h of customHabits) {
          const months: { month: string; completed: number; max: number; pct: number }[] = []
          for (let mo = 2; mo <= 12; mo++) {
            const lastDay = new Date(yearNum, mo, 0).getDate()
            const completed = countCompletedDailyFromSlots(yearNum, mo, `habit_${h.id}`, progressByKey)
            months.push({
              month: `${yearNum}-${String(mo).padStart(2, '0')}`,
              completed,
              max: lastDay,
              pct: lastDay > 0 ? Math.round((completed / lastDay) * 1000) / 10 : 0,
            })
          }
          byHabitPerMonth.push({ key: `habit_${h.id}`, name: h.name, months })
        }
        db.close()
        return NextResponse.json({ year: yearNum, byHabitPerMonth })
      }

      // Год: сводка
      let totalCompleted = 0
      let totalMax = 0
      const byHabit: { key: string; name: string; completed: number; max: number; pct: number }[] = []

      for (const habit of HABITS) {
        let completed = 0
        let max = 0

        if (habit.type === 'DAILY_BOOLEAN_LOG' && habit.logField) {
          max = daysInYearFebDec
          for (let mo = 2; mo <= 12; mo++) {
            const lastDay = new Date(yearNum, mo, 0).getDate()
            const startDate = `${yearNum}-${String(mo).padStart(2, '0')}-01`
            const endDate = `${yearNum}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
            let rows: Record<string, any>[] = []
            try {
              rows = db.prepare(
                `SELECT stepsDone, proteinDone, sleepDone, reels, gamesDone, contentWritingDone, dayOff, alcohol, junkFood FROM daily_logs WHERE date >= ? AND date <= ?`
              ).all(startDate, endDate) as Record<string, any>[]
            } catch (_) {}
            const field = habit.logField
            if (field === 'dayOff') completed += rows.filter(r => r.dayOff != null && r.dayOff !== '').length
            else if (field === 'alcohol') completed += rows.filter(r => r.alcohol === 1 || r.alcohol === true).length
            else completed += rows.filter(r => r[field] === 1 || r[field] === true).length
          }
        } else if (habit.type === 'DAILY_BOOLEAN_SLOTS' && habit.slotKey) {
          max = daysInYearFebDec
          for (let mo = 2; mo <= 12; mo++) {
            completed += countCompletedDailyFromSlots(yearNum, mo, habit.slotKey, progressByKey)
          }
        } else if (habit.type === 'DAILY_BOOLEAN_PROFI') {
          max = daysInYearFebDec
          for (let mo = 2; mo <= 12; mo++) {
            completed += countCompletedProfi(yearNum, mo, progressByKey)
          }
        } else if (habit.type === 'MONTHLY_CAP_12') {
          max = 12 * 11
          for (let mo = 2; mo <= 12; mo++) {
            completed += countCompletedWorkoutsMonth(yearNum, mo, progressByKey)
          }
        } else if (habit.type === 'YOUTUBE_MONTH') {
          for (let mo = 2; mo <= 12; mo++) {
            const monthKey = `${yearNum}-${String(mo).padStart(2, '0')}`
            const row = progressByKey.get(`${monthKey}:youtube_month`)
            completed += countCompleted(row?.slots ?? [])
          }
          max = 4 * 11
        }

        totalCompleted += completed
        totalMax += max
        byHabit.push({
          key: habit.key,
          name: habit.name,
          completed,
          max,
          pct: max > 0 ? Math.round((completed / max) * 1000) / 10 : 0,
        })
      }

      for (const h of customHabits) {
        let completed = 0
        for (let mo = 2; mo <= 12; mo++) {
          completed += countCompletedDailyFromSlots(yearNum, mo, `habit_${h.id}`, progressByKey)
        }
        const max = daysInYearFebDec
        totalCompleted += completed
        totalMax += max
        byHabit.push({
          key: `habit_${h.id}`,
          name: h.name,
          completed,
          max,
          pct: max > 0 ? Math.round((completed / max) * 1000) / 10 : 0,
        })
      }

      const overallPct = totalMax > 0 ? Math.round((totalCompleted / totalMax) * 1000) / 10 : 0
      db.close()
      return NextResponse.json({
        year: yearNum,
        overallPct,
        totalCompleted,
        totalMax,
        byHabit,
      })
    }

    db.close()
    return NextResponse.json({ error: 'Need month=YYYY-MM or year=YYYY' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching habit stats:', error)
    return NextResponse.json({ error: 'Failed to fetch habit stats' }, { status: 500 })
  }
}
