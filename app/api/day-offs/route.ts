import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    const db = getDb()
    const rows = db.prepare(`
      SELECT date FROM day_offs
      WHERE date >= ? AND date <= ?
      ORDER BY date ASC
    `).all(startDate, endDate) as { date: string }[]
    db.close()

    const dates = rows.map((r) => r.date)
    return NextResponse.json(dates)
  } catch (error) {
    console.error('Error fetching day offs:', error)
    return NextResponse.json({ error: 'Failed to fetch day offs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date } = body

    if (!date || typeof date !== 'string') {
      return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
    }

    const dateStr = date.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    const db = getDb()
    try {
      db.prepare('INSERT INTO day_offs (date) VALUES (?)').run(dateStr)
    } catch (e: any) {
      if (e && e.code === 'SQLITE_CONSTRAINT') {
        db.close()
        return NextResponse.json({ error: 'This date is already marked as day off' }, { status: 409 })
      }
      throw e
    }
    db.close()

    return NextResponse.json({ success: true, date: dateStr })
  } catch (error) {
    console.error('Error adding day off:', error)
    return NextResponse.json({ error: 'Failed to add day off' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare('DELETE FROM day_offs WHERE date = ?').run(date)
    db.close()

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Day off not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing day off:', error)
    return NextResponse.json({ error: 'Failed to remove day off' }, { status: 500 })
  }
}
