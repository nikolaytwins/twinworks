import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

/** Копировать ученика (и все его расходы) на другой месяц */
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
    const student = db.prepare('SELECT * FROM ImpulseStudent WHERE id = ?').get(params.id) as any
    if (!student) {
      db.close()
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const newStudentId = `stud_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const newDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`

    db.prepare(`
      INSERT INTO ImpulseStudent (id, name, productType, totalAmount, paidAmount, deadline, status, trafficSource, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      newStudentId,
      student.name,
      student.productType,
      student.totalAmount,
      0,
      student.deadline,
      'not_paid',
      student.trafficSource ?? null,
      student.notes,
      newDate
    )

    const expenses = db.prepare('SELECT * FROM ImpulseExpense WHERE studentId = ?').all(params.id) as any[]
    for (const exp of expenses) {
      const newExpId = `impexp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      db.prepare(`
        INSERT INTO ImpulseExpense (id, studentId, employeeName, employeeRole, amount, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(newExpId, newStudentId, exp.employeeName, exp.employeeRole, exp.amount, exp.notes)
    }

    const newStudent = db.prepare('SELECT * FROM ImpulseStudent WHERE id = ?').get(newStudentId)
    db.close()

    return NextResponse.json({ success: true, student: newStudent })
  } catch (error: any) {
    console.error('Error copying student:', error)
    return NextResponse.json(
      { error: 'Failed to copy student', details: error.message },
      { status: 500 }
    )
  }
}
