import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

/** Выручка по типам клиентов за ВСЕ месяцы (все проекты) */
export async function GET() {
  try {
    const db = getDb()
    const rows = db.prepare(`
      SELECT COALESCE(clientType, '') as clientType, SUM(totalAmount) as totalAmount, COUNT(*) as count
      FROM AgencyProject
      GROUP BY COALESCE(clientType, '')
      ORDER BY totalAmount DESC
    `).all() as Array<{ clientType: string; totalAmount: number; count: number }>
    db.close()

    const total = rows.reduce((s, r) => s + r.totalAmount, 0)
    const items = rows.map(r => ({
      clientType: r.clientType,
      totalAmount: r.totalAmount,
      count: r.count,
      percent: total > 0 ? Math.round((r.totalAmount / total) * 1000) / 10 : 0,
    }))

    return NextResponse.json({ items, total })
  } catch (error) {
    console.error('Error fetching revenue by client:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
