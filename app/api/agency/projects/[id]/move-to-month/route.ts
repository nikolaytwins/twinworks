import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

/** Перенос проекта на другой месяц (меняем createdAt на первый день целевого месяца) */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()
    const year = Number(body.year)
    const month = Number(body.month)

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid year or month' },
        { status: 400 }
      )
    }

    const db = getDb()
    const project = db.prepare('SELECT id FROM AgencyProject WHERE id = ?').get(params.id)
    if (!project) {
      db.close()
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const newDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`
    db.prepare(
      `UPDATE AgencyProject SET createdAt = ?, updatedAt = datetime('now') WHERE id = ?`
    ).run(newDate, params.id)
    db.close()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error moving project:', error)
    return NextResponse.json(
      { error: 'Failed to move project', details: error.message },
      { status: 500 }
    )
  }
}
