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
    const employeeName = body.employeeName != null ? String(body.employeeName) : null
    const employeeRole = body.employeeRole != null ? String(body.employeeRole) : null
    const amount = body.amount != null ? Number(body.amount) : undefined
    const notes = body.notes != null ? String(body.notes) : null

    const db = getDb()
    const existing = db.prepare('SELECT * FROM AgencyGeneralExpense WHERE id = ?').get(params.id) as any
    if (!existing) {
      db.close()
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const finalAmount = amount != null ? amount : existing.amount
    const finalName = employeeName != null ? employeeName : existing.employeeName
    const finalRole = employeeRole != null ? employeeRole : existing.employeeRole
    const finalNotes = notes != null ? notes : existing.notes

    db.prepare(`
      UPDATE AgencyGeneralExpense
      SET employeeName = ?, employeeRole = ?, amount = ?, notes = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(finalName, finalRole, finalAmount, finalNotes, params.id)

    const expense = db.prepare('SELECT * FROM AgencyGeneralExpense WHERE id = ?').get(params.id)
    db.close()
    return NextResponse.json({ success: true, expense })
  } catch (error: any) {
    console.error('Error updating general expense:', error)
    return NextResponse.json({ error: 'Failed to update expense', details: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const db = getDb()
    db.prepare('DELETE FROM AgencyGeneralExpense WHERE id = ?').run(params.id)
    db.close()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}
