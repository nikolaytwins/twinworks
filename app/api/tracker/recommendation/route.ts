import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET - получить рекомендацию на сегодня
export async function GET() {
  try {
    const db = getDb()
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    
    // Получаем лог за сегодня
    const todayLog = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(todayStr) as any
    
    // Получаем логи за последние 4 дня
    const fourDaysAgo = new Date(today)
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4)
    const startDate = fourDaysAgo.toISOString().split('T')[0]
    
    const recentLogs = db.prepare(`
      SELECT * FROM daily_logs 
      WHERE date >= ? AND date < ?
      ORDER BY date ASC
    `).all(startDate, todayStr) as any[]
    
    db.close()
    
    // Если режим дня уже выбран на сегодня
    if (todayLog?.dayMode) {
      return NextResponse.json({ 
        recommendation: null,
        dayMode: todayLog.dayMode,
        message: `Сегодня выбран режим: ${getDayModeLabel(todayLog.dayMode)}`
      })
    }
    
    // Проверяем вчерашний день
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const yesterdayLog = recentLogs.find(l => l.date === yesterdayStr)
    
    // Если вчера был "Сильный" → сегодня "Отдых" (приоритет) или "Лёгкий"
    if (yesterdayLog?.dayMode === 'strong') {
      return NextResponse.json({
        recommendation: 'rest',
        priority: 'high',
        message: 'Вчера был сильный день. Сегодня отдых: прогулка + восстановление, без сильных задач',
        dayMode: null
      })
    }
    
    // Проверяем последние 3 дня на отсутствие отдыха
    const lastThreeDays = recentLogs.slice(-3)
    const hasRest = lastThreeDays.some(l => l.dayMode === 'rest')
    
    if (!hasRest && lastThreeDays.length >= 3) {
      return NextResponse.json({
        recommendation: 'rest',
        priority: 'critical',
        message: 'Отдых обязателен: 3 дня подряд без отдыха. Сегодня восстановление и легкие задачи',
        dayMode: null
      })
    }
    
    // Если вчера был "Лёгкий" → сегодня можно "Сильный" или "Лёгкий"
    if (yesterdayLog?.dayMode === 'light') {
      return NextResponse.json({
        recommendation: 'strong',
        priority: 'medium',
        message: 'Сегодня сильный день: 2–3 глубоких блока + контент',
        dayMode: null
      })
    }
    
    // Если вчера был "Отдых" → сегодня "Сильный" или "Лёгкий"
    if (yesterdayLog?.dayMode === 'rest') {
      return NextResponse.json({
        recommendation: 'strong',
        priority: 'medium',
        message: 'Сегодня сильный день: 2–3 глубоких блока + контент',
        dayMode: null
      })
    }
    
    // По умолчанию
    return NextResponse.json({
      recommendation: 'light',
      priority: 'low',
      message: 'Выбери режим дня: сильный/лёгкий/отдых',
      dayMode: null
    })
  } catch (error) {
    console.error('Error fetching recommendation:', error)
    return NextResponse.json({ error: 'Failed to fetch recommendation' }, { status: 500 })
  }
}

function getDayModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    strong: 'Сильный',
    light: 'Лёгкий',
    rest: 'Отдых'
  }
  return labels[mode] || mode
}
