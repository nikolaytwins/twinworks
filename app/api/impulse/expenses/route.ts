import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    
    const db = getDb()
    let query = 'SELECT * FROM ImpulseExpense'
    const params: any[] = []
    
    if (studentId) {
      query += ' WHERE studentId = ?'
      params.push(studentId)
    }
    
    query += ' ORDER BY createdAt DESC'
    
    const expenses = db.prepare(query).all(...params)
    db.close()
    
    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, employeeName, employeeRole, amount, notes } = body
    
    const db = getDb()
    const id = `exp_imp_${Date.now()}`
    
    db.prepare(`
      INSERT INTO ImpulseExpense (id, studentId, employeeName, employeeRole, amount, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, studentId, employeeName, employeeRole, amount, notes || null)
    
    const expense = db.prepare('SELECT * FROM ImpulseExpense WHERE id = ?').get(id)
    db.close()
    
    return NextResponse.json({ success: true, expense })
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
