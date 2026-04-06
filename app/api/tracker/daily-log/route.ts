import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET - получить лог за дату или за период
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    const db = getDb()
    
    if (date) {
      // Получить лог только за запрошенную дату (YYYY-MM-DD)
      const log = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(date) as any
      db.close()
      if (log && log.date === date) {
        // Преобразуем SQLite boolean (0/1) в JavaScript boolean
        log.stepsDone = Boolean(log.stepsDone)
        log.proteinDone = Boolean(log.proteinDone)
        log.sleepDone = Boolean(log.sleepDone)
        log.alcohol = Boolean(log.alcohol || 0)
        log.junkFood = Boolean(log.junkFood || 0)
        log.reels = Boolean(log.reels || 0)
        log.gamesDone = Boolean(log.gamesDone || 0)
        log.contentWritingDone = Boolean(log.contentWritingDone || 0)
        return NextResponse.json(log)
      }
      return NextResponse.json(null)
    } else if (startDate && endDate) {
      // Получить логи за период
      const logs = db.prepare(`
        SELECT * FROM daily_logs 
        WHERE date >= ? AND date <= ?
        ORDER BY date ASC
      `).all(startDate, endDate) as any[]
      db.close()
      // Преобразуем SQLite boolean (0/1) в JavaScript boolean
      logs.forEach(log => {
        log.stepsDone = Boolean(log.stepsDone)
        log.proteinDone = Boolean(log.proteinDone)
        log.sleepDone = Boolean(log.sleepDone)
        log.alcohol = Boolean(log.alcohol || 0)
        log.junkFood = Boolean(log.junkFood || 0)
        log.reels = Boolean(log.reels || 0)
        log.gamesDone = Boolean(log.gamesDone || 0)
        log.contentWritingDone = Boolean(log.contentWritingDone || 0)
      })
      return NextResponse.json(logs)
    } else {
      // Получить все логи
      const logs = db.prepare('SELECT * FROM daily_logs ORDER BY date DESC').all() as any[]
      db.close()
      // Преобразуем SQLite boolean (0/1) в JavaScript boolean
      logs.forEach(log => {
        log.stepsDone = Boolean(log.stepsDone)
        log.proteinDone = Boolean(log.proteinDone)
        log.sleepDone = Boolean(log.sleepDone)
        log.alcohol = Boolean(log.alcohol || 0)
        log.junkFood = Boolean(log.junkFood || 0)
        log.reels = Boolean(log.reels || 0)
        log.gamesDone = Boolean(log.gamesDone || 0)
        log.contentWritingDone = Boolean(log.contentWritingDone || 0)
      })
      return NextResponse.json(logs)
    }
  } catch (error) {
    console.error('Error fetching daily log:', error)
    return NextResponse.json({ error: 'Failed to fetch daily log' }, { status: 500 })
  }
}

// Убедиться, что в daily_logs есть колонки gamesDone и contentWritingDone (на случай если миграция не применялась)
function ensureHabitColumns(db: ReturnType<typeof getDb>) {
  const columns = db.prepare("PRAGMA table_info(daily_logs)").all() as { name: string }[]
  const names = new Set(columns.map(c => c.name))
  if (!names.has('gamesDone')) {
    db.prepare('ALTER TABLE daily_logs ADD COLUMN gamesDone INTEGER NOT NULL DEFAULT 0').run()
  }
  if (!names.has('contentWritingDone')) {
    db.prepare('ALTER TABLE daily_logs ADD COLUMN contentWritingDone INTEGER NOT NULL DEFAULT 0').run()
  }
}

// POST/PUT - создать или обновить лог
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, dayMode, stepsDone, proteinDone, sleepDone, workoutType, alcohol, dayOff, junkFood, reels, gamesDone, contentWritingDone } = body
    
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }
    
    const db = getDb()
    ensureHabitColumns(db)
    
    // Проверяем, существует ли запись
    const existing = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(date) as any

    // Преобразуем boolean в 0/1; при UPDATE используем существующие значения, если поле не передано
    const stepsDoneValue = stepsDone === true || stepsDone === 1 || stepsDone === 'true' ? 1 : (stepsDone === false || stepsDone === 0 ? 0 : (existing?.stepsDone ?? 0))
    const proteinDoneValue = proteinDone === true || proteinDone === 1 || proteinDone === 'true' ? 1 : (proteinDone === false || proteinDone === 0 ? 0 : (existing?.proteinDone ?? 0))
    const sleepDoneValue = sleepDone === true || sleepDone === 1 || sleepDone === 'true' ? 1 : (sleepDone === false || sleepDone === 0 ? 0 : (existing?.sleepDone ?? 0))
    const alcoholValue = alcohol === true || alcohol === 1 || alcohol === 'true' ? 1 : (alcohol === false || alcohol === 0 ? 0 : (existing?.alcohol ?? 0))
    const junkFoodValue = junkFood === true || junkFood === 1 || junkFood === 'true' ? 1 : (junkFood === false || junkFood === 0 ? 0 : (existing?.junkFood ?? 0))
    const reelsValue = reels === true || reels === 1 || reels === 'true' ? 1 : (reels === false || reels === 0 ? 0 : (existing?.reels ?? 0))
    const gamesDoneValue = gamesDone === true || gamesDone === 1 || gamesDone === 'true' ? 1 : (gamesDone === false || gamesDone === 0 ? 0 : (existing?.gamesDone ?? 0))
    const contentWritingDoneValue = contentWritingDone === true || contentWritingDone === 1 || contentWritingDone === 'true' ? 1 : (contentWritingDone === false || contentWritingDone === 0 ? 0 : (existing?.contentWritingDone ?? 0))
    const dayModeVal = dayMode !== undefined && dayMode !== null ? dayMode : (existing?.dayMode ?? null)
    const workoutTypeVal = workoutType !== undefined && workoutType !== null ? workoutType : (existing?.workoutType ?? null)
    const dayOffVal = dayOff !== undefined && dayOff !== null ? dayOff : (existing?.dayOff ?? null)

    if (existing) {
      // Обновляем (частичное обновление: непереданные поля берём из existing)
      db.prepare(`
        UPDATE daily_logs 
        SET dayMode = ?, stepsDone = ?, proteinDone = ?, sleepDone = ?, workoutType = ?, alcohol = ?, dayOff = ?, junkFood = ?, reels = ?, gamesDone = ?, contentWritingDone = ?, updatedAt = datetime('now')
        WHERE date = ?
      `).run(
        dayModeVal,
        stepsDoneValue,
        proteinDoneValue,
        sleepDoneValue,
        workoutTypeVal,
        alcoholValue,
        dayOffVal,
        junkFoodValue,
        reelsValue,
        gamesDoneValue,
        contentWritingDoneValue,
        date
      )
    } else {
      // Создаем (для новой записи непереданные поля = 0/null)
      db.prepare(`
        INSERT INTO daily_logs (id, date, dayMode, stepsDone, proteinDone, sleepDone, workoutType, alcohol, dayOff, junkFood, reels, gamesDone, contentWritingDone, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        crypto.randomUUID(),
        date,
        dayModeVal,
        stepsDoneValue,
        proteinDoneValue,
        sleepDoneValue,
        workoutTypeVal,
        alcoholValue,
        dayOffVal,
        junkFoodValue,
        reelsValue,
        gamesDoneValue,
        contentWritingDoneValue
      )
    }
    
    const log = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(date) as any
    db.close()
    
    if (log) {
      // Преобразуем SQLite boolean (0/1) в JavaScript boolean
      log.stepsDone = Boolean(log.stepsDone)
      log.proteinDone = Boolean(log.proteinDone)
      log.sleepDone = Boolean(log.sleepDone)
      log.alcohol = Boolean(log.alcohol || 0)
      log.junkFood = Boolean(log.junkFood || 0)
      log.reels = Boolean(log.reels || 0)
      log.gamesDone = Boolean(log.gamesDone || 0)
      log.contentWritingDone = Boolean(log.contentWritingDone || 0)
    }
    
    if (!log) {
      console.error('Failed to retrieve log after save')
      return NextResponse.json({ success: false, error: 'Failed to retrieve saved log' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, log })
  } catch (error: any) {
    console.error('Error saving daily log:', error)
    return NextResponse.json({ error: 'Failed to save daily log', details: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  return POST(request)
}
