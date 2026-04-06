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
    const { employeeName, employeeRole, amount, notes } = body
    
    const db = getDb()
    db.prepare(`
      UPDATE AgencyExpense 
      SET employeeName = ?, employeeRole = ?, amount = ?, notes = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(employeeName, employeeRole, amount, notes || null, params.id)
    
    const expense = db.prepare('SELECT * FROM AgencyExpense WHERE id = ?').get(params.id)
    db.close()
    
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true, expense })
  } catch (error) {
    console.error('Error updating expense:', error)
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const db = getDb()
    db.prepare('DELETE FROM AgencyExpense WHERE id = ?').run(params.id)
    db.close()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}
