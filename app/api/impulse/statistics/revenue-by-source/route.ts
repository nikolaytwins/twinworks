import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

/** Выручка по источникам трафика за ВСЕ время (все ученики) */
export async function GET() {
  try {
    const db = getDb()
    let rows: Array<{ trafficSource: string; totalAmount: number; count: number }> = []
    try {
      rows = db.prepare(`
        SELECT COALESCE(trafficSource, '') as trafficSource, SUM(totalAmount) as totalAmount, COUNT(*) as count
        FROM ImpulseStudent
        GROUP BY COALESCE(trafficSource, '')
        ORDER BY totalAmount DESC
      `).all() as Array<{ trafficSource: string; totalAmount: number; count: number }>
    } catch (_) {}
    db.close()

    const total = rows.reduce((s, r) => s + r.totalAmount, 0)
    const items = rows.map(r => ({
      trafficSource: r.trafficSource,
      totalAmount: r.totalAmount,
      count: r.count,
      percent: total > 0 ? Math.round((r.totalAmount / total) * 1000) / 10 : 0,
    }))

    return NextResponse.json({ items, total })
  } catch (error) {
    console.error('Error fetching revenue by source:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
