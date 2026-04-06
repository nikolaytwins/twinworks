import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()
    const { field, value } = body

    if (!field || value === undefined) {
      return NextResponse.json({ error: 'Field and value are required' }, { status: 400 })
    }

    const db = getDb()
    
    // Проверяем, что запись существует
    const existing = db.prepare('SELECT * FROM monthly_history WHERE id = ?').get(params.id) as any
    if (!existing) {
      db.close()
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    // Обновляем конкретное поле
    const allowedFields = [
      'totalAccounts', 'cushionAmount', 'goalsAmount',
      'agencyExpectedRevenue', 'agencyActualRevenue', 'agencyExpectedProfit', 'agencyActualProfit',
      'impulseExpectedRevenue', 'impulseActualRevenue', 'impulseExpectedProfit', 'impulseActualProfit',
      'totalExpectedProfit', 'totalRevenue'
    ]

    if (!allowedFields.includes(field)) {
      db.close()
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
    }

    db.prepare(`
      UPDATE monthly_history 
      SET ${field} = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(value, params.id)

    // Если изменилась прибыль агентства или импульса, пересчитываем общую прибыль
    if (field === 'agencyActualProfit' || field === 'impulseActualProfit') {
      const updated = db.prepare('SELECT * FROM monthly_history WHERE id = ?').get(params.id) as any
      const totalProfit = (updated.agencyActualProfit || 0) + (updated.impulseActualProfit || 0)
      db.prepare(`
        UPDATE monthly_history 
        SET totalExpectedProfit = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(totalProfit, params.id)
    }
    
    // Если изменилась выручка агентства или импульса, пересчитываем общую выручку
    if (field === 'agencyExpectedRevenue' || field === 'impulseExpectedRevenue') {
      const updated = db.prepare('SELECT * FROM monthly_history WHERE id = ?').get(params.id) as any
      const totalRevenue = (updated.agencyExpectedRevenue || 0) + (updated.impulseExpectedRevenue || 0)
      db.prepare(`
        UPDATE monthly_history 
        SET totalRevenue = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(totalRevenue, params.id)
    }

    const updated = db.prepare('SELECT * FROM monthly_history WHERE id = ?').get(params.id)
    db.close()

    return NextResponse.json({ success: true, record: updated })
  } catch (error) {
    console.error('Error updating history record:', error)
    return NextResponse.json({ error: 'Failed to update history record' }, { status: 500 })
  }
}
