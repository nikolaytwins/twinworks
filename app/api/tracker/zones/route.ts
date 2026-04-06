import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET - получить зоны внимания (предупреждения)
export async function GET() {
  try {
    const db = getDb()
    const warnings: string[] = []
    
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    
    // Получаем логи за последние 3 дня
    const threeDaysAgo = new Date(today)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const startDate = threeDaysAgo.toISOString().split('T')[0]
    
    const logs = db.prepare(`
      SELECT * FROM daily_logs 
      WHERE date >= ? AND date <= ?
      ORDER BY date ASC
    `).all(startDate, todayStr) as any[]
    
    // Проверка ежедневных привычек (2 дня подряд без выполнения)
    const recentLogs = logs.slice(-2)
    if (recentLogs.length >= 2) {
      const lastTwo = recentLogs.slice(-2)
      // Преобразуем SQLite boolean (0/1) в JavaScript boolean
      if (lastTwo.every(l => !Boolean(l.stepsDone))) {
        warnings.push('2 дня без шагов')
      }
      if (lastTwo.every(l => !Boolean(l.proteinDone))) {
        warnings.push('2 дня без белка')
      }
      if (lastTwo.every(l => !Boolean(l.sleepDone))) {
        warnings.push('2 дня без сна')
      }
      
      // Тренировки
      const hasWorkout = lastTwo.some(l => l.workoutType && l.workoutType !== 'none')
      if (!hasWorkout && lastTwo.length === 2) {
        warnings.push('2 дня без тренировок')
      }
    }
    
    // Проверка медиа метрик
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
    
    // YouTube (месяц)
    const dayOfMonth = today.getDate()
    const youtubeProgress = db.prepare(`
      SELECT * FROM slot_progress 
      WHERE periodKey = ? AND metricKey = ?
    `).get(monthKey, 'youtube_month') as any
    
    if (youtubeProgress) {
      const slots = JSON.parse(youtubeProgress.slots) as boolean[]
      const completed = slots.filter(s => s).length
      
      if (dayOfMonth >= 10 && completed === 0) {
        warnings.push('YouTube отстаёт')
      } else if (dayOfMonth >= 20 && completed <= 1) {
        warnings.push('YouTube критически отстаёт')
      }
    } else if (dayOfMonth >= 10) {
      warnings.push('YouTube отстаёт')
    }
    
    // Недельные метрики
    const weekKey = getWeekKey(today)
    const dayOfWeek = today.getDay() // 0 = воскресенье, 1 = понедельник
    const isThursdayOrLater = dayOfWeek >= 4 || dayOfWeek === 0 // Четверг или позже
    
    if (isThursdayOrLater) {
      // Reels
      const reelsProgress = db.prepare(`
        SELECT * FROM slot_progress 
        WHERE periodKey = ? AND metricKey = ?
      `).get(weekKey, 'reels_week') as any
      
      if (reelsProgress) {
        const slots = JSON.parse(reelsProgress.slots) as boolean[]
        const completed = slots.filter(s => s).length
        if (completed <= 1) {
          warnings.push('Reels отстают')
        }
      }
      
      // Telegram
      const tgProgress = db.prepare(`
        SELECT * FROM slot_progress 
        WHERE periodKey = ? AND metricKey = ?
      `).get(weekKey, 'tg_week') as any
      
      if (tgProgress) {
        const slots = JSON.parse(tgProgress.slots) as boolean[]
        const completed = slots.filter(s => s).length
        if (completed === 0) {
          warnings.push('Telegram отстаёт')
        }
      }
      
      // Соц выходы
      const socialProgress = db.prepare(`
        SELECT * FROM slot_progress 
        WHERE periodKey = ? AND metricKey = ?
      `).get(weekKey, 'social_week') as any
      
      if (socialProgress) {
        const slots = JSON.parse(socialProgress.slots) as boolean[]
        const completed = slots.filter(s => s).length
        if (completed === 0) {
          warnings.push('Социалка просела')
        }
      }
    }
    
    db.close()
    
    return NextResponse.json({ warnings })
  } catch (error) {
    console.error('Error fetching zones:', error)
    return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 })
  }
}

// Функция для получения номера недели (ISO week)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Функция для получения weekKey
function getWeekKey(date: Date): string {
  const year = date.getFullYear()
  const weekNumber = getWeekNumber(date)
  return `${year}-W${String(weekNumber).padStart(2, '0')}`
}
