import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

/** Копировать проект (и все его расходы) на другой месяц */
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
    const project = db.prepare('SELECT * FROM AgencyProject WHERE id = ?').get(params.id) as any
    if (!project) {
      db.close()
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const newProjectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const newDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`

    db.prepare(`
      INSERT INTO AgencyProject (id, name, totalAmount, paidAmount, deadline, status, serviceType, clientType, paymentMethod, clientContact, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      newProjectId,
      project.name,
      project.totalAmount,
      0,
      project.deadline,
      'not_paid',
      project.serviceType,
      project.clientType,
      project.paymentMethod,
      project.clientContact,
      project.notes,
      newDate
    )

    const expenses = db.prepare('SELECT * FROM AgencyExpense WHERE projectId = ?').all(params.id) as any[]
    for (const exp of expenses) {
      const newExpId = `agexp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      db.prepare(`
        INSERT INTO AgencyExpense (id, projectId, employeeName, employeeRole, amount, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(newExpId, newProjectId, exp.employeeName, exp.employeeRole, exp.amount, exp.notes)
    }

    const newProject = db.prepare('SELECT * FROM AgencyProject WHERE id = ?').get(newProjectId)
    db.close()

    return NextResponse.json({ success: true, project: newProject })
  } catch (error: any) {
    console.error('Error copying project:', error)
    return NextResponse.json(
      { error: 'Failed to copy project', details: error.message },
      { status: 500 }
    )
  }
}
