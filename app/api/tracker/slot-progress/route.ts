import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

function getWeeksInYearFebDec(year: number): string[] {
  const set = new Set<string>()
  for (let m = 2; m <= 12; m++) {
    const first = new Date(year, m - 1, 1)
    const last = new Date(year, m, 0)
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      set.add(getWeekKey(new Date(d)))
    }
  }
  return Array.from(set)
}

// GET - получить прогресс по периоду и метрике, либо за год (Feb-Dec)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const periodKey = searchParams.get('periodKey')
    const metricKey = searchParams.get('metricKey')
    const yearParam = searchParams.get('year')
    
    const db = getDb()
    
    if (yearParam) {
      const year = parseInt(yearParam, 10)
      if (isNaN(year)) {
        db.close()
        return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
      }
      const weekKeys = getWeeksInYearFebDec(year)
      if (weekKeys.length === 0) {
        db.close()
        return NextResponse.json({ byWeek: {} })
      }
      const placeholders = weekKeys.map(() => '?').join(',')
      const rows = db.prepare(`
        SELECT periodKey, metricKey, slots FROM slot_progress
        WHERE periodKey IN (${placeholders}) AND (metricKey LIKE '%_week' OR metricKey LIKE 'habit_%')
      `).all(...weekKeys) as { periodKey: string; metricKey: string; slots: string }[]
      db.close()
      const byWeek: Record<string, Record<string, unknown[]>> = {}
      for (const r of rows) {
        if (!byWeek[r.periodKey]) byWeek[r.periodKey] = {}
        try {
          byWeek[r.periodKey][r.metricKey] = JSON.parse(r.slots) as unknown[]
        } catch {
          byWeek[r.periodKey][r.metricKey] = []
        }
      }
      return NextResponse.json({ byWeek })
    }
    
    if (periodKey && metricKey) {
      // Получить конкретный прогресс
      const progress = db.prepare(`
        SELECT * FROM slot_progress 
        WHERE periodKey = ? AND metricKey = ?
      `).get(periodKey, metricKey) as any
      
      db.close()
      
      if (progress) {
        // Парсим JSON slots
        progress.slots = JSON.parse(progress.slots)
      }
      
      return NextResponse.json(progress || null)
    } else if (periodKey) {
      // Получить все метрики за период
      const progresses = db.prepare(`
        SELECT * FROM slot_progress 
        WHERE periodKey = ?
      `).all(periodKey) as any[]
      
      db.close()
      
      // Парсим JSON slots для каждого
      progresses.forEach(p => {
        p.slots = JSON.parse(p.slots)
      })
      
      return NextResponse.json(progresses)
    } else {
      // Получить все
      const progresses = db.prepare('SELECT * FROM slot_progress ORDER BY periodKey DESC, metricKey ASC').all() as any[]
      db.close()
      
      progresses.forEach(p => {
        p.slots = JSON.parse(p.slots)
      })
      
      return NextResponse.json(progresses)
    }
  } catch (error) {
    console.error('Error fetching slot progress:', error)
    return NextResponse.json({ error: 'Failed to fetch slot progress' }, { status: 500 })
  }
}

// POST/PUT - создать или обновить прогресс
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { periodKey, metricKey, slots } = body
    
    if (!periodKey || !metricKey || !Array.isArray(slots)) {
      return NextResponse.json({ error: 'periodKey, metricKey, and slots array are required' }, { status: 400 })
    }
    
    const db = getDb()
    
    // Проверяем, существует ли запись
    const existing = db.prepare(`
      SELECT * FROM slot_progress 
      WHERE periodKey = ? AND metricKey = ?
    `).get(periodKey, metricKey) as any
    
    const slotsJson = JSON.stringify(slots)
    
    if (existing) {
      // Обновляем
      db.prepare(`
        UPDATE slot_progress 
        SET slots = ?, updatedAt = datetime('now')
        WHERE periodKey = ? AND metricKey = ?
      `).run(slotsJson, periodKey, metricKey)
    } else {
      // Создаем
      db.prepare(`
        INSERT INTO slot_progress (id, periodKey, metricKey, slots, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        crypto.randomUUID(),
        periodKey,
        metricKey,
        slotsJson
      )
    }
    
    const progress = db.prepare(`
      SELECT * FROM slot_progress 
      WHERE periodKey = ? AND metricKey = ?
    `).get(periodKey, metricKey) as any
    
    db.close()
    
    if (progress) {
      progress.slots = JSON.parse(progress.slots)
    }
    
    return NextResponse.json({ success: true, progress })
  } catch (error) {
    console.error('Error saving slot progress:', error)
    return NextResponse.json({ error: 'Failed to save slot progress' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  return POST(request)
}
