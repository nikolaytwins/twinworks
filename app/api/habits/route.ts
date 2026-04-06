import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const db = getDb()
    let rows: any[] = []
    try {
      rows = db.prepare(
        'SELECT * FROM habit_definitions ORDER BY "order" ASC, name ASC'
      ).all() as any[]
    } catch (e) {
      // Таблица может ещё не существовать
    }
    db.close()
    const habits = rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      slotsCount: r.slotsCount ?? 7,
      order: r.order ?? 0,
      isMain: r.isMain === 1 || r.isMain === true,
    }))
    return NextResponse.json(habits)
  } catch (error) {
    console.error('Error fetching habits:', error)
    return NextResponse.json({ error: 'Failed to fetch habits' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type = 'weekly', slotsCount, isMain = false } = body
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Название привычки обязательно' }, { status: 400 })
    }
    const db = getDb()
    const id = `habit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const typeVal = type === 'monthly' ? 'monthly' : 'weekly'
    const count = typeVal === 'weekly' ? 7 : Math.min(31, Math.max(1, parseInt(String(slotsCount), 10) || 4))
    const order = parseInt(String(body.order), 10) || 0
    const isMainVal = isMain === true || isMain === 1 ? 1 : 0
    try {
      db.prepare(`
        INSERT INTO habit_definitions (id, name, type, slotsCount, "order", isMain, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, name.trim(), typeVal, count, order, isMainVal)
    } catch (e: any) {
      db.close()
      if (e.message?.includes('no such table')) {
        return NextResponse.json({ error: 'Таблица привычек не создана. Выполните миграцию.' }, { status: 500 })
      }
      throw e
    }
    const row = db.prepare('SELECT * FROM habit_definitions WHERE id = ?').get(id) as any
    db.close()
    const habit = {
      id: row.id,
      name: row.name,
      type: row.type,
      slotsCount: row.slotsCount ?? 7,
      order: row.order ?? 0,
      isMain: row.isMain === 1 || row.isMain === true,
    }
    return NextResponse.json({ success: true, habit })
  } catch (error) {
    console.error('Error creating habit:', error)
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 })
  }
}
