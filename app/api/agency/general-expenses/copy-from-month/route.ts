import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

/** Скопировать общие расходы с одного месяца на другой (дубликаты с новой датой) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const fromYear = Number(body.fromYear)
    const fromMonth = Number(body.fromMonth)
    const toYear = Number(body.toYear)
    const toMonth = Number(body.toMonth)

    if (!fromYear || !fromMonth || !toYear || !toMonth || fromMonth < 1 || fromMonth > 12 || toMonth < 1 || toMonth > 12) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
    }

    const fromStart = `${fromYear}-${String(fromMonth).padStart(2, '0')}-01 00:00:00`
    const fromEnd = new Date(fromYear, fromMonth, 0, 23, 59, 59)
    const fromEndStr = `${fromEnd.getFullYear()}-${String(fromEnd.getMonth() + 1).padStart(2, '0')}-${String(fromEnd.getDate()).padStart(2, '0')} 23:59:59`
    const toDate = `${toYear}-${String(toMonth).padStart(2, '0')}-01 00:00:00`

    const db = getDb()
    const expenses = db.prepare(`
      SELECT * FROM AgencyGeneralExpense
      WHERE createdAt >= ? AND createdAt <= ?
      ORDER BY createdAt
    `).all(fromStart, fromEndStr) as any[]

    let copied = 0
    for (const exp of expenses) {
      const newId = `agexp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      db.prepare(`
        INSERT INTO AgencyGeneralExpense (id, employeeName, employeeRole, amount, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(newId, exp.employeeName, exp.employeeRole, exp.amount, exp.notes, toDate)
      copied++
    }
    db.close()

    return NextResponse.json({ success: true, copied })
  } catch (error: any) {
    console.error('Error copying general expenses:', error)
    return NextResponse.json(
      { error: 'Failed to copy expenses', details: error.message },
      { status: 500 }
    )
  }
}
